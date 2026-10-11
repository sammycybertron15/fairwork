"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { usePersona } from "@/lib/demo/persona-context";
import { Spinner } from "@/components/Spinner";
import { TxStatus } from "@/components/TxStatus";
import { useAvailableOf } from "@/lib/chain/hooks";
import { useLedgerWrite } from "@/lib/chain/useLedgerWrite";
import { formatCredits, shortHex } from "@/lib/format";
import { hashCanonical, type Terms } from "@/lib/terms";

// ---- Hardhat demo accounts (spec section 5) ----
// Resolver choices: resolver is never buyer or freelancer; here we offer accounts #9 and #0.
const DEMO_RESOLVER_OPTIONS: { label: string; address: Address }[] = [
  {
    label: "Account #9 (demo resolver)",
    address: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
  },
  {
    label: "Account #0 (deployer)",
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  },
];

// Min 1 hour, max 30 days (contract constants). Values in seconds.
const MIN_REVIEW_WINDOW = 3600;
const MAX_REVIEW_WINDOW = 30 * 24 * 3600;

// ---- types ----

type MilestoneInput = {
  title: string;
  deliverables: string; // one per line → split on save
  acceptanceCriteria: string; // one per line → split on save
  credits: string;
  deadline: string; // datetime-local string
  revisionLimit: string;
};

const EMPTY_MILESTONE: MilestoneInput = {
  title: "",
  deliverables: "",
  acceptanceCriteria: "",
  credits: "",
  deadline: "",
  revisionLimit: "2",
};

type FormState = {
  title: string;
  description: string;
  freelancerAddress: string;
  resolverAddress: string;
  reviewWindowHours: string;
  milestones: MilestoneInput[];
};

// ---- helpers ----

function toLines(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseDatetimeLocal(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function nowPlusMinutes(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60 * 1000);
  // Format for datetime-local: "YYYY-MM-DDTHH:MM"
  return d.toISOString().slice(0, 16);
}

/** Generate a 16-byte random nonce as hex. */
function randomNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** POST /api/blobs and return the hash, or throw. */
async function storeBlob(kind: string, json: unknown): Promise<string> {
  const res = await fetch("/api/blobs", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, json }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Blob store failed: ${res.status}`);
  }
  const { hash } = (await res.json()) as { hash: string };
  return hash;
}

// ---- prefill from package query param ----

type PackageData = {
  name: string;
  description: string;
  priceCredits: number;
  deliveryDays: number;
  revisions: number;
  freelancerAddress?: string;
};

async function fetchPackage(packageId: string): Promise<PackageData | null> {
  try {
    const res = await fetch(`/api/freelancers?package=${packageId}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { package: PackageData };
    return data.package ?? null;
  } catch {
    return null;
  }
}

// ---- component ----

export default function NewAgreementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const router = useRouter();
  const { address } = usePersona();
  const { data: availableCredits } = useAvailableOf(address);
  const tx = useLedgerWrite();

  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    freelancerAddress: "",
    resolverAddress: DEMO_RESOLVER_OPTIONS[0].address,
    reviewWindowHours: "72", // 3 days default
    milestones: [{ ...EMPTY_MILESTONE }],
  });
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [termsHashPreview, setTermsHashPreview] = useState<string | null>(null);
  const prefillRan = useRef(false);

  const [fromStorefront, setFromStorefront] = useState(false);

  // Load ?package= or ?freelancer= prefill on mount
  useEffect(() => {
    if (prefillRan.current) return;
    prefillRan.current = true;
    void (async () => {
      const params = await searchParams;
      if (params.package) {
        setFromStorefront(true);
        setPrefillLoading(true);
        const pkg = await fetchPackage(params.package);
        setPrefillLoading(false);
        if (pkg) {
          const deadlineUnix = Date.now() / 1000 + pkg.deliveryDays * 86400;
          const deadlineLocal = new Date(deadlineUnix * 1000).toISOString().slice(0, 16);
          setForm((prev) => ({
            ...prev,
            title: pkg.name,
            description: pkg.description,
            freelancerAddress: pkg.freelancerAddress ?? "",
            milestones: [
              {
                title: pkg.name,
                deliverables: pkg.description,
                acceptanceCriteria: "",
                credits: String(pkg.priceCredits),
                deadline: deadlineLocal,
                revisionLimit: String(pkg.revisions),
              },
            ],
          }));
        }
      } else if (params.freelancer) {
        setFromStorefront(true);
        setForm((prev) => ({
          ...prev,
          freelancerAddress: params.freelancer ?? "",
          title: params.title ?? prev.title,
        }));
      }
    })();
  }, [searchParams]);

  // Recompute hash preview whenever form data changes (best-effort)
  useEffect(() => {
    if (!address) {
      setTermsHashPreview(null);
      return;
    }
    try {
      const reviewWindowSeconds = Math.round(parseFloat(form.reviewWindowHours) * 3600);
      const milestonesTerms = form.milestones.map((m) => ({
        title: m.title.trim(),
        deliverables: toLines(m.deliverables),
        acceptanceCriteria: toLines(m.acceptanceCriteria),
        credits: parseInt(m.credits, 10) || 0,
        deadline: parseDatetimeLocal(m.deadline) ?? 0,
        revisionLimit: parseInt(m.revisionLimit, 10) || 0,
      }));
      const terms = {
        version: 1,
        chainId: 31337,
        unit: "demo-credits",
        title: form.title.trim(),
        description: form.description.trim(),
        buyer: address as string,
        freelancer: form.freelancerAddress.trim(),
        resolver: form.resolverAddress,
        reviewWindowSeconds,
        milestones: milestonesTerms,
        nonce: "00000000000000000000000000000000", // placeholder for preview
      };
      setTermsHashPreview(hashCanonical(terms));
    } catch {
      setTermsHashPreview(null);
    }
  }, [form, address]);

  // ---- form helpers ----

  function updateField(field: keyof Omit<FormState, "milestones">, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateMilestone(index: number, field: keyof MilestoneInput, value: string) {
    setForm((prev) => {
      const milestones = [...prev.milestones];
      milestones[index] = { ...milestones[index], [field]: value };
      return { ...prev, milestones };
    });
  }

  function addMilestone() {
    if (form.milestones.length >= 5) return;
    // Default deadline = previous deadline + 3 days
    const prev = form.milestones[form.milestones.length - 1];
    const prevDeadlineMs = prev.deadline ? new Date(prev.deadline).getTime() : Date.now();
    const nextDeadline = new Date(prevDeadlineMs + 3 * 24 * 3600 * 1000).toISOString().slice(0, 16);
    setForm((prev) => ({
      ...prev,
      milestones: [...prev.milestones, { ...EMPTY_MILESTONE, deadline: nextDeadline }],
    }));
  }

  function removeMilestone(index: number) {
    if (form.milestones.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index),
    }));
  }

  // ---- derived values ----

  const totalCredits = form.milestones.reduce((sum, m) => {
    const n = parseInt(m.credits, 10);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);

  const balanceExceeded = availableCredits !== undefined && BigInt(totalCredits) > availableCredits;

  // ---- submission ----

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!address) {
      setSubmitError("Connect your wallet first.");
      return;
    }

    const reviewWindowSeconds = Math.round(parseFloat(form.reviewWindowHours) * 3600);
    if (reviewWindowSeconds < MIN_REVIEW_WINDOW || reviewWindowSeconds > MAX_REVIEW_WINDOW) {
      setSubmitError("Review window must be between 1 hour and 30 days.");
      return;
    }

    const freelancer = form.freelancerAddress.trim() as Address;
    if (!/^0x[0-9a-fA-F]{40}$/.test(freelancer)) {
      setSubmitError("Freelancer address is not a valid 0x address.");
      return;
    }
    if (freelancer.toLowerCase() === address.toLowerCase()) {
      setSubmitError("Buyer and freelancer must be different addresses.");
      return;
    }

    // Validate milestones
    const milestoneInputs: {
      credits: bigint;
      deadline: bigint;
      revisionLimit: number;
    }[] = [];
    const milestonesTerms: Terms["milestones"] = [];

    let prevDeadline = Math.floor(Date.now() / 1000);
    for (let i = 0; i < form.milestones.length; i++) {
      const m = form.milestones[i];
      const credits = parseInt(m.credits, 10);
      const deadline = parseDatetimeLocal(m.deadline);
      const revisionLimit = parseInt(m.revisionLimit, 10);
      const deliverables = toLines(m.deliverables);
      const acceptanceCriteria = toLines(m.acceptanceCriteria);

      if (!m.title.trim()) {
        setSubmitError(`Milestone ${i + 1}: title is required.`);
        return;
      }
      if (!Number.isFinite(credits) || credits <= 0) {
        setSubmitError(`Milestone ${i + 1}: credits must be a positive integer.`);
        return;
      }
      if (deadline === null || deadline <= prevDeadline) {
        setSubmitError(
          `Milestone ${i + 1}: deadline must be in the future and after the previous milestone.`,
        );
        return;
      }
      if (!Number.isFinite(revisionLimit) || revisionLimit < 0 || revisionLimit > 255) {
        setSubmitError(`Milestone ${i + 1}: revision limit must be 0–255.`);
        return;
      }
      if (deliverables.length === 0) {
        setSubmitError(`Milestone ${i + 1}: at least one deliverable is required.`);
        return;
      }
      if (acceptanceCriteria.length === 0) {
        setSubmitError(`Milestone ${i + 1}: at least one acceptance criterion is required.`);
        return;
      }

      prevDeadline = deadline;
      milestoneInputs.push({
        credits: BigInt(credits),
        deadline: BigInt(deadline),
        revisionLimit,
      });
      milestonesTerms.push({
        title: m.title.trim(),
        deliverables,
        acceptanceCriteria,
        credits,
        deadline,
        revisionLimit,
      });
    }

    const nonce = randomNonce();
    const termsJson: Terms = {
      version: 1,
      chainId: 31337,
      unit: "demo-credits",
      title: form.title.trim(),
      description: form.description.trim(),
      buyer: address,
      freelancer,
      resolver: form.resolverAddress as Address,
      reviewWindowSeconds,
      milestones: milestonesTerms,
      nonce,
    };

    let termsHash: string;
    try {
      termsHash = await storeBlob("terms", termsJson);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to store terms.");
      return;
    }

    await tx.send("propose", [
      address,
      freelancer,
      form.resolverAddress as Address,
      termsHash as `0x${string}`,
      reviewWindowSeconds,
      milestoneInputs,
    ]);

    if (tx.state.status === "confirmed") {
      router.push("/dashboard");
    }
  }

  // After tx confirms, redirect
  useEffect(() => {
    if (tx.state.status === "confirmed") {
      router.push("/dashboard");
    }
  }, [tx.state.status, router]);

  const busy = tx.state.status === "awaitingWallet" || tx.state.status === "pending";

  // ---- render ----

  return (
    <div className="max-w-2xl">
      <h1 className="text-title">New agreement</h1>
      <p className="mt-2 max-w-measure text-muted-on-light">
        Propose a milestone-based agreement. The other party must approve before any credits are
        locked.
      </p>

      {prefillLoading && (
        <p className="mt-4 text-caption text-muted-on-light">Loading package details…</p>
      )}

      {!fromStorefront && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-stone-soft bg-canvas p-4 text-caption text-muted-on-light">
          <p>💡 Agreements typically start directly from a creator&apos;s storefront.</p>
          <Link href="/" className="font-medium text-ink underline hover:text-lime-deep">
            Browse Storefronts →
          </Link>
        </div>
      )}

      {!address && (
        <div className="mt-6 border border-stone-soft p-4 text-muted-on-light">
          Connect your wallet to create an agreement.
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 flex flex-col gap-8">
        {/* Agreement fields */}
        <fieldset className="flex flex-col gap-4">
          <legend className="text-lead font-medium">Agreement details</legend>

          <div>
            <label htmlFor="title" className="mb-1 block text-caption font-medium">
              Title
            </label>
            <input
              id="title"
              type="text"
              required
              className="field"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="e.g. Brand identity for Lumen Coffee"
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-caption font-medium">
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              className="field"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Scope, goals, context…"
            />
          </div>

          <div>
            <label htmlFor="freelancerAddress" className="mb-1 block text-caption font-medium">
              Freelancer address
            </label>
            <input
              id="freelancerAddress"
              type="text"
              required
              className="field font-mono text-caption"
              value={form.freelancerAddress}
              onChange={(e) => updateField("freelancerAddress", e.target.value)}
              placeholder="0x…"
              spellCheck={false}
            />
          </div>

          <div>
            <label htmlFor="resolverAddress" className="mb-1 block text-caption font-medium">
              Resolver
            </label>
            <select
              id="resolverAddress"
              required
              className="field"
              value={form.resolverAddress}
              onChange={(e) => updateField("resolverAddress", e.target.value)}
            >
              {DEMO_RESOLVER_OPTIONS.map((opt) => (
                <option key={opt.address} value={opt.address}>
                  {opt.label} ({shortHex(opt.address)})
                </option>
              ))}
            </select>
            <p className="mt-1 text-caption text-muted-on-light">
              The resolver can only settle a disputed milestone. They are approved by both parties
              via the terms hash.
            </p>
          </div>

          <div>
            <label htmlFor="reviewWindowHours" className="mb-1 block text-caption font-medium">
              Review window (hours)
            </label>
            <input
              id="reviewWindowHours"
              type="number"
              required
              min={1}
              max={720}
              step={1}
              className="field"
              value={form.reviewWindowHours}
              onChange={(e) => updateField("reviewWindowHours", e.target.value)}
            />
            <p className="mt-1 text-caption text-muted-on-light">
              How long the buyer has to review submitted work, and how long the freelancer gets per
              revision (1–720 hours).
            </p>
          </div>
        </fieldset>

        {/* Milestones */}
        <fieldset className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <legend className="text-lead font-medium">
              Milestones ({form.milestones.length}/5)
            </legend>
          </div>

          {form.milestones.map((m, i) => (
            <div key={i} className="flex flex-col gap-4 rounded-card border border-stone-soft p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Milestone {i + 1}</span>
                {form.milestones.length > 1 && (
                  <button
                    type="button"
                    className="btn-destructive px-3 text-caption"
                    onClick={() => removeMilestone(i)}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div>
                <label htmlFor={`m-title-${i}`} className="mb-1 block text-caption font-medium">
                  Title
                </label>
                <input
                  id={`m-title-${i}`}
                  type="text"
                  required
                  className="field"
                  value={m.title}
                  onChange={(e) => updateMilestone(i, "title", e.target.value)}
                  placeholder="e.g. Logo concepts"
                />
              </div>

              <div>
                <label
                  htmlFor={`m-deliverables-${i}`}
                  className="mb-1 block text-caption font-medium"
                >
                  Deliverables (one per line)
                </label>
                <textarea
                  id={`m-deliverables-${i}`}
                  rows={2}
                  className="field"
                  value={m.deliverables}
                  onChange={(e) => updateMilestone(i, "deliverables", e.target.value)}
                  placeholder="3 logo concepts as SVG&#10;One-page usage guide"
                />
              </div>

              <div>
                <label htmlFor={`m-criteria-${i}`} className="mb-1 block text-caption font-medium">
                  Acceptance criteria (one per line)
                </label>
                <textarea
                  id={`m-criteria-${i}`}
                  rows={2}
                  className="field"
                  value={m.acceptanceCriteria}
                  onChange={(e) => updateMilestone(i, "acceptanceCriteria", e.target.value)}
                  placeholder="Concepts are original&#10;Delivered as vector files"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor={`m-credits-${i}`} className="mb-1 block text-caption font-medium">
                    Credits
                  </label>
                  <input
                    id={`m-credits-${i}`}
                    type="number"
                    required
                    min={1}
                    max={6000}
                    step={1}
                    className="field"
                    value={m.credits}
                    onChange={(e) => updateMilestone(i, "credits", e.target.value)}
                    placeholder="500"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`m-deadline-${i}`}
                    className="mb-1 block text-caption font-medium"
                  >
                    Deadline
                  </label>
                  <input
                    id={`m-deadline-${i}`}
                    type="datetime-local"
                    required
                    className="field text-caption"
                    min={nowPlusMinutes(5)}
                    value={m.deadline}
                    onChange={(e) => updateMilestone(i, "deadline", e.target.value)}
                  />
                </div>

                <div>
                  <label
                    htmlFor={`m-revisions-${i}`}
                    className="mb-1 block text-caption font-medium"
                  >
                    Max revisions
                  </label>
                  <input
                    id={`m-revisions-${i}`}
                    type="number"
                    required
                    min={0}
                    max={255}
                    step={1}
                    className="field"
                    value={m.revisionLimit}
                    onChange={(e) => updateMilestone(i, "revisionLimit", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          {form.milestones.length < 5 && (
            <button type="button" className="btn-secondary self-start" onClick={addMilestone}>
              + Add milestone
            </button>
          )}
        </fieldset>

        {/* Summary and hash preview */}
        <div className="flex flex-col gap-3 rounded-card border border-stone-soft p-4">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium">Total credits locked</span>
            <span className={`font-medium ${balanceExceeded ? "text-danger" : ""}`}>
              {totalCredits.toLocaleString()} credits
            </span>
          </div>

          {availableCredits !== undefined && (
            <div className="flex items-center justify-between text-caption text-muted-on-light">
              <span>Your available balance</span>
              <span>{formatCredits(availableCredits)}</span>
            </div>
          )}

          {balanceExceeded && (
            <div role="alert" className="border border-danger px-3 py-2 text-caption text-danger">
              Total milestone credits exceed your available balance. You can still propose, but
              funding will fail until you have enough credits.
            </div>
          )}

          {termsHashPreview && (
            <div className="mt-2 border-t border-stone-soft pt-3">
              <p className="mb-1 text-caption font-medium">Terms hash preview (keccak256)</p>
              <p className="break-all font-mono text-caption text-muted-on-light">
                {termsHashPreview}
              </p>
              <p className="mt-1 text-caption text-muted-on-light">
                A real nonce is generated on submit. The counterparty will see "Verified" when this
                matches the on-chain hash.
              </p>
            </div>
          )}
        </div>

        {/* No monetary value notice */}
        <p className="text-caption text-muted-on-light">
          @ 2026 Fairwork. Flower Incorporerated.
        </p>

        {/* Errors */}
        {submitError && (
          <p role="alert" className="text-caption text-danger">
            {submitError}
          </p>
        )}

        <TxStatus state={tx.state} />

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={busy || !address || tx.disabled}>
            {busy ? (
              <>
                <Spinner className="mr-2 size-4 animate-spin text-ink" />
                Submitting…
              </>
            ) : (
              "Propose agreement"
            )}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

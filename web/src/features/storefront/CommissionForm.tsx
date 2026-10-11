"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { usePersona } from "@/lib/demo/persona-context";
import { Spinner } from "@/components/Spinner";
import { shortHex } from "@/lib/format";

type Status =
  { kind: "idle" } | { kind: "submitting" } | { kind: "sent" } | { kind: "error"; message: string };

const errorBodySchema = z.object({ error: z.object({ message: z.string() }) });

async function readErrorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = errorBodySchema.safeParse(body);
  return parsed.success ? parsed.data.error.message : "The request could not be saved";
}

export function CommissionForm({
  handle,
  name,
  freelancerAddress,
}: {
  handle: string;
  name: string;
  freelancerAddress?: string;
}) {
  const { address } = usePersona();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus({ kind: "submitting" });
    try {
      const response = await fetch("/api/commission-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          title: data.get("title"),
          description: data.get("description"),
          budgetCredits: Number(data.get("budget")),
          requesterAddress: address,
        }),
      });
      if (!response.ok) {
        setStatus({ kind: "error", message: await readErrorMessage(response) });
        return;
      }
      setStatus({ kind: "sent" });
    } catch {
      setStatus({ kind: "error", message: "Could not reach the server" });
    }
  }

  if (status.kind === "sent") {
    return (
      <div role="status" className="rounded-card border border-stone-soft p-6">
        <p className="text-lead">Request sent to {name}</p>
        <p className="mt-1 text-muted-on-light">
          It is stored as unverified. Nothing was signed and no credits moved.
        </p>
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => setStatus({ kind: "idle" })}
        >
          Send another request
        </button>
      </div>
    );
  }

  const submitting = status.kind === "submitting";
  return (
    <form onSubmit={onSubmit} className="flex max-w-measure flex-col gap-4">
      <div>
        <label htmlFor="commission-title" className="mb-1 block font-medium">
          What do you need?
        </label>
        <input
          id="commission-title"
          name="title"
          required
          maxLength={120}
          className="field"
          placeholder="Menu redesign for a bakery"
        />
      </div>
      <div>
        <label htmlFor="commission-description" className="mb-1 block font-medium">
          Details
        </label>
        <textarea
          id="commission-description"
          name="description"
          required
          maxLength={2000}
          rows={5}
          className="field"
        />
      </div>
      <div>
        <label htmlFor="commission-budget" className="mb-1 block font-medium">
          Budget in credits
        </label>
        <input
          id="commission-budget"
          name="budget"
          type="number"
          required
          min={1}
          max={6000}
          step={1}
          inputMode="numeric"
          className="field sm:max-w-48"
        />
      </div>
      <p className="text-caption text-muted-on-light">
        {address
          ? `Sent with your wallet address ${shortHex(address)}.`
          : "No wallet connected, so the request is sent without an address."}
      </p>
      {status.kind === "error" ? (
        <p role="alert" className="text-danger">
          {status.message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner className="mr-2 size-4 animate-spin text-ink" />
              Sending…
            </>
          ) : (
            "Send request"
          )}
        </button>
        {freelancerAddress ? (
          <Link
            href={`/agreements/new?freelancer=${freelancerAddress}&title=${encodeURIComponent(`Custom project with ${name}`)}`}
            className="btn-secondary"
          >
            Start Custom Agreement On-Chain →
          </Link>
        ) : null}
      </div>
    </form>
  );
}

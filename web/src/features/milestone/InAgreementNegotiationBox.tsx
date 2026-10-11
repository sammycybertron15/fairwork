"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import type { DisputeMessage } from "@/lib/db/blobs";
import { shortHex } from "@/lib/format";

type InAgreementNegotiationBoxProps = {
  agreementId: bigint;
  milestoneIndex: number;
  role: "buyer" | "freelancer" | "resolver" | "viewer";
  senderAddress?: string;
  status: string;
  canSettleAmicably?: boolean;
  canEscalate?: boolean;
  onSettleAmicably?: () => void;
  onEscalateToSupport?: () => void;
  isSettling?: boolean;
};

export function InAgreementNegotiationBox({
  agreementId,
  milestoneIndex,
  role,
  senderAddress,
  status,
  canSettleAmicably,
  canEscalate,
  onSettleAmicably,
  onEscalateToSupport,
  isSettling,
}: InAgreementNegotiationBoxProps) {
  const toast = useToast();
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newText, setNewText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agreementIdStr = agreementId.toString();

  useEffect(() => {
    let cancelled = false;
    async function fetchMessages() {
      try {
        const res = await fetch(
          `/api/dispute-messages?agreementId=${encodeURIComponent(agreementIdStr)}&milestoneIndex=${milestoneIndex}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.messages) {
            setMessages(data.messages);
            // Auto open if messages exist
            if (data.messages.length > 0) {
              setIsOpen(true);
            }
          }
        }
      } catch {
        // Fallback silently if offline
      }
    }

    void fetchMessages();
    return () => {
      cancelled = true;
    };
  }, [agreementIdStr, milestoneIndex]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    const cleanText = newText.trim();
    if (!cleanText || !senderAddress) return;

    setIsSending(true);
    setError(null);

    try {
      const res = await fetch("/api/dispute-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId: agreementIdStr,
          milestoneIndex,
          senderAddress,
          senderRole: role === "viewer" ? "buyer" : role,
          message: cleanText,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to post message");
      }

      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setNewText("");
      toast.success("Negotiation note saved to immutable blob storage");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to post message";
      setError(msg);
    } finally {
      setIsSending(false);
    }
  }

  const isDisputed = status === "Disputed";

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-card border border-stone-soft bg-canvas p-4 text-caption shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`inline-block size-2 ${isDisputed ? "bg-danger" : "bg-warning"}`}
          />
          <h4 className="font-heading font-medium text-ink">Discuss Issue & Direct Negotiation</h4>
          {messages.length > 0 && (
            <span className="rounded-tag border border-stone-soft px-2 py-0.5 font-mono text-[0.75rem] text-muted-on-light">
              {messages.length} {messages.length === 1 ? "note" : "notes"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="text-caption font-medium text-ink underline underline-offset-4 hover:text-lime-deep"
        >
          {isOpen ? "Hide Discussion ▲" : "Discuss Issue ▼"}
        </button>
      </div>

      <p className="text-[0.8rem] text-muted-on-light leading-relaxed">
        Discuss deliverable concerns directly before formal arbitration. All notes are
        cryptographically hashed and saved into content-addressed blob storage under agreement #
        {agreementIdStr}.
      </p>

      {isOpen && (
        <div className="flex flex-col gap-4 border-t border-stone-soft pt-3">
          {/* Messages list */}
          {messages.length === 0 ? (
            <div className="rounded-tag border border-stone-soft/70 bg-stone/5 p-3 text-[0.8rem] text-muted-on-light italic">
              No notes exchanged yet. Post below to communicate changes, request partial
              adjustments, or resolve questions amicably.
            </div>
          ) : (
            <div className="flex max-h-60 flex-col gap-2.5 overflow-y-auto pr-1">
              {messages.map((m) => {
                const isMe =
                  senderAddress && m.senderAddress.toLowerCase() === senderAddress.toLowerCase();
                const roleBadge =
                  m.senderRole === "buyer"
                    ? "Buyer"
                    : m.senderRole === "freelancer"
                      ? "Freelancer"
                      : "Support Desk";

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col gap-1 rounded-card border p-3 ${
                      isMe
                        ? "border-lime/30 bg-lime/5 self-end max-w-[85%]"
                        : "border-stone-soft bg-canvas self-start max-w-[85%]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[0.75rem]">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span
                          className={`rounded-tag px-1.5 py-0.2 font-mono ${
                            m.senderRole === "buyer"
                              ? "bg-ink text-lime"
                              : m.senderRole === "freelancer"
                                ? "bg-stone-soft text-ink"
                                : "bg-danger text-canvas"
                          }`}
                        >
                          {roleBadge}
                        </span>
                        <span className="font-mono text-muted-on-light">
                          {shortHex(m.senderAddress)}
                        </span>
                      </div>
                      <span className="text-muted-on-light">
                        {new Date(m.createdAt * 1000).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-body text-ink leading-relaxed whitespace-pre-wrap mt-0.5">
                      {m.message}
                    </p>
                    {m.blobHash && (
                      <span
                        className="font-mono text-[0.68rem] text-muted-on-light"
                        title={m.blobHash}
                      >
                        Blob keccak256: {m.blobHash.slice(0, 10)}…{m.blobHash.slice(-8)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* New message input */}
          <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
            <textarea
              rows={2}
              required
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Post a note or propose an amicable adjustment..."
              className="field text-caption leading-relaxed"
              disabled={isSending}
            />
            {error && <p className="text-[0.8rem] text-danger">{error}</p>}
            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={isSending || !newText.trim() || !senderAddress}
                className="btn-secondary text-caption inline-flex items-center gap-2"
              >
                {isSending && <Spinner className="size-3.5" />}
                Post Note to Thread
              </button>
            </div>
          </form>

          {/* Action buttons bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-soft pt-3">
            <div className="flex items-center gap-2">
              {canSettleAmicably && onSettleAmicably && (
                <button
                  type="button"
                  onClick={onSettleAmicably}
                  disabled={isSettling}
                  className="btn-primary text-caption inline-flex items-center gap-1.5"
                >
                  {isSettling && <Spinner className="size-3.5" />}✓ Settle Amicably (Accept &
                  Release Escrow)
                </button>
              )}
            </div>

            <div>
              {canEscalate && onEscalateToSupport && !isDisputed && (
                <button
                  type="button"
                  onClick={onEscalateToSupport}
                  className="btn-destructive text-caption inline-flex items-center gap-1.5"
                >
                  ⚠ Escalate to Customer Support
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

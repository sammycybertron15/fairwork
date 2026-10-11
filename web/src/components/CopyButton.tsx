"use client";

import { useState } from "react";

/** Copies a value (address or hash) and says so in text. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className="rounded-tag border border-muted-on-light px-2 text-caption"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

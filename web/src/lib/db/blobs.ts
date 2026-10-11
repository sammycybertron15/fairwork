import type { Hex } from "viem";
import { z } from "zod";
import { canonicalize, hashCanonical, termsSchema } from "@/lib/terms";
import { getDb } from "./index";

export const BLOB_KINDS = ["terms", "evidence", "reason", "rationale", "negotiation"] as const;
export type BlobKind = (typeof BLOB_KINDS)[number];

/** Blobs are small text documents; anything bigger is a mistake or abuse. */
export const MAX_BLOB_BYTES = 64 * 1024;

export const putBlobBodySchema = z.object({
  kind: z.enum(BLOB_KINDS),
  json: z.record(z.string(), z.unknown()),
});

export type StoredBlob = { hash: Hex; kind: BlobKind; json: unknown; createdAt: number };

export type DisputeMessage = {
  id: number;
  agreementId: string;
  milestoneIndex: number;
  senderAddress: string;
  senderRole: string;
  message: string;
  blobHash?: string;
  createdAt: number;
};

/**
 * Canonicalizes, hashes and stores. Idempotent: the same content always lands on the same row.
 * Terms are checked against the terms schema; the other kinds only have to be JSON objects.
 */
export function putBlob(kind: BlobKind, json: unknown): Hex {
  const value = kind === "terms" ? termsSchema.parse(json) : json;
  const canonical = canonicalize(value);
  if (Buffer.byteLength(canonical, "utf8") > MAX_BLOB_BYTES) throw new RangeError("Blob too large");
  const hash = hashCanonical(value);
  getDb()
    .prepare("INSERT OR IGNORE INTO blobs (hash, kind, json, created_at) VALUES (?, ?, ?, ?)")
    .run(hash, kind, canonical, Math.floor(Date.now() / 1000));
  return hash;
}

export function getBlob(hash: string): StoredBlob | undefined {
  const row = getDb()
    .prepare("SELECT hash, kind, json, created_at AS createdAt FROM blobs WHERE hash = ?")
    .get(hash.toLowerCase()) as
    { hash: Hex; kind: BlobKind; json: string; createdAt: number } | undefined;
  if (!row) return undefined;
  return { hash: row.hash, kind: row.kind, json: JSON.parse(row.json), createdAt: row.createdAt };
}

export function saveDisputeMessage(params: {
  agreementId: string;
  milestoneIndex: number;
  senderAddress: string;
  senderRole: string;
  message: string;
}): DisputeMessage {
  // Store the message as an immutable content-addressed negotiation blob
  const blobHash = putBlob("negotiation", {
    agreementId: params.agreementId,
    milestoneIndex: params.milestoneIndex,
    senderAddress: params.senderAddress,
    senderRole: params.senderRole,
    message: params.message,
    timestamp: Date.now(),
  });

  const createdAt = Math.floor(Date.now() / 1000);
  const db = getDb();
  const res = db
    .prepare(
      `INSERT INTO dispute_messages (agreement_id, milestone_index, sender_address, sender_role, message, blob_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.agreementId,
      params.milestoneIndex,
      params.senderAddress,
      params.senderRole,
      params.message,
      blobHash,
      createdAt,
    );

  return {
    id: typeof res?.lastInsertRowid === "number" ? res.lastInsertRowid : 1,
    agreementId: params.agreementId,
    milestoneIndex: params.milestoneIndex,
    senderAddress: params.senderAddress,
    senderRole: params.senderRole,
    message: params.message,
    blobHash,
    createdAt,
  };
}

export function getDisputeMessages(agreementId: string, milestoneIndex: number): DisputeMessage[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, agreement_id AS agreementId, milestone_index AS milestoneIndex,
              sender_address AS senderAddress, sender_role AS senderRole,
              message, blob_hash AS blobHash, created_at AS createdAt
         FROM dispute_messages
        WHERE agreement_id = ? AND milestone_index = ?
        ORDER BY created_at ASC, id ASC`,
    )
    .all(agreementId, milestoneIndex) as DisputeMessage[];
}

import { keccak256, toBytes, type Hex } from "viem";
import { z } from "zod";

/** Largest credit amount a milestone may carry: the demo buyer's whole grant (spec 7.1). */
export const MAX_CREDITS = 6000;

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Expected a 0x address");
const nonEmptyText = z.string().trim().min(1);
const nonEmptyList = z.array(nonEmptyText).min(1);

export const milestoneTermsSchema = z
  .object({
    title: nonEmptyText,
    deliverables: nonEmptyList,
    acceptanceCriteria: nonEmptyList,
    credits: z.number().int().positive().max(MAX_CREDITS),
    deadline: z.number().int().positive(),
    revisionLimit: z.number().int().min(0).max(255),
  })
  .strict();

export const termsSchema = z
  .object({
    version: z.literal(1),
    chainId: z.literal(31337),
    unit: z.literal("demo-credits"),
    title: nonEmptyText,
    description: z.string(),
    buyer: addressSchema,
    freelancer: addressSchema,
    resolver: addressSchema,
    reviewWindowSeconds: z.number().int().positive(),
    milestones: z.array(milestoneTermsSchema).min(1).max(5),
    nonce: z.string().regex(/^[0-9a-f]{32}$/, "Expected 16 random bytes as hex"),
  })
  .strict();

export type Terms = z.infer<typeof termsSchema>;
export type MilestoneTerms = z.infer<typeof milestoneTermsSchema>;

/**
 * Deterministic JSON: object keys sorted recursively, no whitespace. Keys whose value is
 * `undefined` are dropped, exactly as JSON.stringify would. Anything JSON cannot represent throws.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeys(record[key])]),
    );
  }
  if (typeof value === "bigint") throw new TypeError("bigint is not JSON: convert it first");
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError("Non-finite numbers are not JSON");
  }
  return value;
}

/** keccak256 over the UTF-8 bytes of the canonical JSON. Used for terms and every off-chain blob. */
export function hashCanonical(value: unknown): Hex {
  return keccak256(toBytes(canonicalize(value)));
}

/** Validates, then hashes. Throws a ZodError for terms that do not match the schema. */
export function hashTerms(terms: unknown): Hex {
  return hashCanonical(termsSchema.parse(terms));
}

/** True when `json` hashes to `expected`. This is the check behind "Verified / Hash mismatch". */
export function matchesHash(json: unknown, expected: string): boolean {
  try {
    return hashCanonical(json).toLowerCase() === expected.toLowerCase();
  } catch {
    return false;
  }
}

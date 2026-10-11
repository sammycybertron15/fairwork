import { z } from "zod";
import { isAddress } from "viem";
import { getDb } from "./index";

/** Largest amount of credits that exists (spec 6.1), so no request can ask for more. */
const MAX_BUDGET_CREDITS = 6000;

export const commissionRequestSchema = z.object({
  handle: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  budgetCredits: z.number().int().positive().max(MAX_BUDGET_CREDITS),
  requesterAddress: z
    .string()
    .refine((value) => isAddress(value, { strict: false }))
    .optional(),
});

export type CommissionRequestInput = z.infer<typeof commissionRequestSchema>;

/** Stores an unverified request and returns its id. The caller checks the handle exists. */
export function createCommissionRequest(input: CommissionRequestInput): number {
  const result = getDb()
    .prepare(
      `INSERT INTO commission_requests
         (handle, requester_address, title, description, budget_credits, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.handle,
      input.requesterAddress ?? null,
      input.title,
      input.description,
      input.budgetCredits,
      Math.floor(Date.now() / 1000),
    );
  return Number(result.lastInsertRowid);
}

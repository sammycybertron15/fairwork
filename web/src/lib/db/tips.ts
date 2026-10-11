import { getDb } from "./index";

export type Tip = {
  id: number;
  agreementId: string;
  buyerAddress: string;
  freelancerAddress: string;
  amountCredits: number;
  createdAt: number;
};

export function getTipsForAgreement(agreementId: string): Tip[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, agreement_id AS agreementId, buyer_address AS buyerAddress,
              freelancer_address AS freelancerAddress, amount_credits AS amountCredits,
              created_at AS createdAt
         FROM tips WHERE agreement_id = ?`,
    )
    .all(agreementId) as Tip[];
}

export function getTipsForFreelancer(freelancerAddress: string): Tip[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, agreement_id AS agreementId, buyer_address AS buyerAddress,
              freelancer_address AS freelancerAddress, amount_credits AS amountCredits,
              created_at AS createdAt
         FROM tips WHERE freelancer_address = ?`,
    )
    .all(freelancerAddress) as Tip[];
}

export function createTip(data: {
  agreementId: string;
  buyerAddress: string;
  freelancerAddress: string;
  amountCredits: number;
}): Tip {
  const db = getDb();
  const createdAt = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(
    `INSERT INTO tips (agreement_id, buyer_address, freelancer_address, amount_credits, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const res = stmt.run(
    data.agreementId,
    data.buyerAddress,
    data.freelancerAddress,
    data.amountCredits,
    createdAt,
  );

  return {
    id: typeof res?.lastInsertRowid === "number" ? res.lastInsertRowid : 1,
    agreementId: data.agreementId,
    buyerAddress: data.buyerAddress,
    freelancerAddress: data.freelancerAddress,
    amountCredits: data.amountCredits,
    createdAt,
  };
}

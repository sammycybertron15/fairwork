import type { Address } from "viem";
import { getDb } from "./index";

export type Freelancer = {
  handle: string;
  address: Address;
  name: string;
  headline: string;
  bio: string;
  avatarUrl?: string;
};

export type PortfolioItem = {
  id: number;
  title: string;
  description: string;
  tag: string;
  imageUrl?: string;
};

export type StorefrontPackage = {
  id: number;
  name: string;
  description: string;
  priceCredits: number;
  deliveryDays: number;
  revisions: number;
};

export type Review = {
  id: number;
  agreementId: string | null;
  freelancerHandle: string;
  reviewerAddress: string;
  rating: number;
  comment: string;
  createdAt: number;
};

export type FreelancerReputation = {
  rating: number;
  completedJobs: number;
  reviewCount: number;
  trustBadges: string[];
};

export type StorefrontSummary = Freelancer & {
  packageCount: number;
  fromCredits: number;
  reputation: FreelancerReputation;
  previewImages?: string[];
};

export type Storefront = {
  freelancer: Freelancer;
  portfolio: PortfolioItem[];
  packages: StorefrontPackage[];
  reviews: Review[];
  reputation: FreelancerReputation;
};

const BASE_REPUTATION: Record<string, { rating: number; jobs: number; badges: string[] }> = {
  alexdesign: {
    rating: 4.9,
    jobs: 14,
    badges: ["On-Time Delivery", "100% Milestone Completion", "Quick Responder"],
  },
  devmalik: {
    rating: 5.0,
    jobs: 19,
    badges: ["On-Time Delivery", "100% Milestone Completion", "Quick Responder"],
  },
  saracreative: {
    rating: 4.8,
    jobs: 11,
    badges: ["On-Time Delivery", "100% Milestone Completion", "Quick Responder"],
  },
  "ines-varga": {
    rating: 4.9,
    jobs: 14,
    badges: ["On-Time Delivery", "100% Milestone Completion", "Quick Responder"],
  },
};

export function computeReputation(handle: string, reviews: Review[] = []): FreelancerReputation {
  const base = BASE_REPUTATION[handle] ?? {
    rating: 5.0,
    jobs: 8,
    badges: ["On-Time Delivery", "100% Milestone Completion", "Quick Responder"],
  };

  if (reviews.length === 0) {
    return {
      rating: base.rating,
      completedJobs: base.jobs,
      reviewCount: 0,
      trustBadges: base.badges,
    };
  }

  const reviewSum = reviews.reduce((sum, r) => sum + r.rating, 0);
  const blendedRating = Number(
    ((base.rating * base.jobs + reviewSum) / (base.jobs + reviews.length)).toFixed(1),
  );

  return {
    rating: blendedRating,
    completedJobs: base.jobs + reviews.length,
    reviewCount: reviews.length,
    trustBadges: base.badges,
  };
}

/** All demo storefronts in seed order, each with its cheapest package price and reputation. */
export function listStorefronts(): StorefrontSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT f.handle, f.address, f.name, f.headline, f.bio, f.avatar_url AS avatarUrl,
              COUNT(p.id) AS packageCount, COALESCE(MIN(p.price_credits), 0) AS fromCredits
         FROM freelancers f
         LEFT JOIN packages p ON p.handle = f.handle
        GROUP BY f.handle
        ORDER BY f.rowid`,
    )
    .all() as Array<
    Freelancer & { packageCount: number; fromCredits: number; previewImages?: string[] }
  >;

  return rows.map((row) => {
    const reviews = getReviewsForFreelancer(row.handle);
    const reputation = computeReputation(row.handle, reviews);
    return {
      ...row,
      reputation,
    };
  });
}

export function getStorefront(handle: string): Storefront | undefined {
  const db = getDb();
  const freelancer = db
    .prepare(
      "SELECT handle, address, name, headline, bio, avatar_url AS avatarUrl FROM freelancers WHERE handle = ?",
    )
    .get(handle) as Freelancer | undefined;
  if (!freelancer) return undefined;

  const portfolio = db
    .prepare(
      "SELECT id, title, description, tag, image_url AS imageUrl FROM portfolio_items WHERE handle = ? ORDER BY id",
    )
    .all(handle) as PortfolioItem[];
  const packages = db
    .prepare(
      `SELECT id, name, description, price_credits AS priceCredits,
              delivery_days AS deliveryDays, revisions
         FROM packages WHERE handle = ? ORDER BY price_credits, id`,
    )
    .all(handle) as StorefrontPackage[];

  const reviews = getReviewsForFreelancer(handle);
  const reputation = computeReputation(handle, reviews);

  return { freelancer, portfolio, packages, reviews, reputation };
}

export function getFreelancerByAddress(address?: string): Freelancer | undefined {
  if (!address) return undefined;
  const db = getDb();
  return db
    .prepare(
      "SELECT handle, address, name, headline, bio, avatar_url AS avatarUrl FROM freelancers WHERE address = ?",
    )
    .get(address) as Freelancer | undefined;
}

export function getReviewsForFreelancer(handle: string): Review[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, agreement_id AS agreementId, freelancer_handle AS freelancerHandle,
              reviewer_address AS reviewerAddress, rating, comment, created_at AS createdAt
         FROM reviews WHERE freelancer_handle = ? ORDER BY created_at DESC`,
    )
    .all(handle) as Review[];
}

export function getReviewForAgreement(agreementId: string): Review | undefined {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, agreement_id AS agreementId, freelancer_handle AS freelancerHandle,
              reviewer_address AS reviewerAddress, rating, comment, created_at AS createdAt
         FROM reviews WHERE agreement_id = ?`,
    )
    .get(agreementId) as Review | undefined;
}

export function createReview(data: {
  agreementId?: string | null;
  freelancerHandle: string;
  reviewerAddress: string;
  rating: number;
  comment: string;
}): Review {
  const db = getDb();
  const createdAt = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(
    `INSERT INTO reviews (agreement_id, freelancer_handle, reviewer_address, rating, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const res = stmt.run(
    data.agreementId ?? null,
    data.freelancerHandle,
    data.reviewerAddress,
    data.rating,
    data.comment,
    createdAt,
  );

  return {
    id: typeof res?.lastInsertRowid === "number" ? res.lastInsertRowid : 1,
    agreementId: data.agreementId ?? null,
    freelancerHandle: data.freelancerHandle,
    reviewerAddress: data.reviewerAddress,
    rating: data.rating,
    comment: data.comment,
    createdAt,
  };
}

export function updateStorefrontProfile(
  handle: string,
  update: {
    headline?: string;
    bio?: string;
    packages?: Array<{ id: number; priceCredits: number; deliveryDays: number }>;
  },
): void {
  const db = getDb();
  if (update.headline !== undefined || update.bio !== undefined) {
    const existing = db
      .prepare("SELECT headline, bio FROM freelancers WHERE handle = ?")
      .get(handle) as { headline: string; bio: string } | undefined;
    if (existing) {
      const newHeadline = update.headline ?? existing.headline;
      const newBio = update.bio ?? existing.bio;
      db.prepare("UPDATE freelancers SET headline = ?, bio = ? WHERE handle = ?").run(
        newHeadline,
        newBio,
        handle,
      );
    }
  }

  if (update.packages && update.packages.length > 0) {
    const updatePkg = db.prepare(
      "UPDATE packages SET price_credits = ?, delivery_days = ? WHERE id = ?",
    );
    for (const pkg of update.packages) {
      updatePkg.run(pkg.priceCredits, pkg.deliveryDays, pkg.id);
    }
  }
}

export type PackageWithFreelancer = StorefrontPackage & { freelancerAddress: Address };

/** Look up a single package by id, including the owning freelancer's address (for agreement prefill). */
export function getPackageWithFreelancer(packageId: number): PackageWithFreelancer | undefined {
  const row = getDb()
    .prepare(
      `SELECT p.id, p.name, p.description, p.price_credits AS priceCredits,
              p.delivery_days AS deliveryDays, p.revisions,
              f.address AS freelancerAddress
         FROM packages p
         JOIN freelancers f ON f.handle = p.handle
        WHERE p.id = ?`,
    )
    .get(packageId) as PackageWithFreelancer | undefined;
  return row;
}

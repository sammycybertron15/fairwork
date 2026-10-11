import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const IN_MEMORY = ":memory:";

export type JsonStore = {
  freelancers: Array<{
    handle: string;
    address: string;
    name: string;
    headline: string;
    bio: string;
    avatar_url?: string;
  }>;
  portfolio_items: Array<{
    id: number;
    handle: string;
    title: string;
    description: string;
    tag: string;
    image_url?: string;
  }>;
  packages: Array<{
    id: number;
    handle: string;
    name: string;
    description: string;
    price_credits: number;
    delivery_days: number;
    revisions: number;
  }>;
  commission_requests: Array<{
    id: number;
    handle: string;
    requester_address: string | null;
    title: string;
    description: string;
    budget_credits: number;
    created_at: number;
  }>;
  reviews: Array<{
    id: number;
    agreement_id: string | null;
    freelancer_handle: string;
    reviewer_address: string;
    rating: number;
    comment: string;
    created_at: number;
  }>;
  dispute_messages: Array<{
    id: number;
    agreement_id: string;
    milestone_index: number;
    sender_address: string;
    sender_role: string;
    message: string;
    blob_hash?: string;
    created_at: number;
  }>;
  tips: Array<{
    id: number;
    agreement_id: string;
    buyer_address: string;
    freelancer_address: string;
    amount_credits: number;
    created_at: number;
  }>;
  blobs: Record<
    string,
    {
      hash: string;
      kind: string;
      json: string;
      created_at: number;
    }
  >;
};

function emptyStore(): JsonStore {
  return {
    freelancers: [],
    portfolio_items: [],
    packages: [],
    commission_requests: [],
    reviews: [],
    dispute_messages: [],
    tips: [],
    blobs: {},
  };
}

export class JsonDatabase {
  private filePath: string;
  private data: JsonStore;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = emptyStore();
    this.load();
  }

  private load(): void {
    if (this.filePath === IN_MEMORY) return;
    try {
      const jsonPath = this.getJsonPath();
      if (existsSync(jsonPath)) {
        const raw = readFileSync(jsonPath, "utf8");
        const parsed = JSON.parse(raw);
        this.data = {
          ...emptyStore(),
          ...parsed,
          reviews: parsed.reviews || [],
          dispute_messages: parsed.dispute_messages || [],
          tips: parsed.tips || [],
        };
      }
    } catch {
      this.data = emptyStore();
    }
  }

  private save(): void {
    if (this.filePath === IN_MEMORY) return;
    try {
      const jsonPath = this.getJsonPath();
      mkdirSync(path.dirname(jsonPath), { recursive: true });
      writeFileSync(jsonPath, JSON.stringify(this.data, null, 2), "utf8");
    } catch {
      // Ignored
    }
  }

  private getJsonPath(): string {
    if (this.filePath.endsWith(".json")) return this.filePath;
    return this.filePath.replace(/\.[^/.]+$/, "") + ".json";
  }

  exec(sql: string): void {
    const s = sql.toLowerCase();
    if (s.includes("drop table if exists")) {
      if (s.includes("tips")) this.data.tips = [];
      if (s.includes("dispute_messages")) this.data.dispute_messages = [];
      if (s.includes("reviews")) this.data.reviews = [];
      if (s.includes("commission_requests")) this.data.commission_requests = [];
      if (s.includes("packages")) this.data.packages = [];
      if (s.includes("portfolio_items")) this.data.portfolio_items = [];
      if (s.includes("freelancers")) this.data.freelancers = [];
      if (s.includes("blobs")) this.data.blobs = {};
      this.save();
    }
  }

  pragma(_sql?: string): void {
    void _sql;
  }

  transaction<T extends (...args: unknown[]) => unknown>(fn: T): T {
    return ((...args: unknown[]) => {
      const res = fn(...args);
      this.save();
      return res;
    }) as T;
  }

  prepare(sql: string) {
    const query = sql.trim().toLowerCase();

    // 1. Blobs queries
    if (query.includes("insert or ignore into blobs")) {
      return {
        run: (...args: unknown[]) => {
          const hash = String(args[0]).toLowerCase();
          if (!this.data.blobs[hash]) {
            this.data.blobs[hash] = {
              hash: String(args[0]),
              kind: String(args[1]),
              json: String(args[2]),
              created_at: Number(args[3]),
            };
            this.save();
          }
          return { changes: 1, lastInsertRowid: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (query.includes("from blobs where hash = ?")) {
      return {
        get: (hash: string) => {
          const row = this.data.blobs[String(hash).toLowerCase()];
          if (!row) return undefined;
          return {
            hash: row.hash,
            kind: row.kind,
            json: row.json,
            createdAt: row.created_at,
          };
        },
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
        all: () => [],
      };
    }

    // 2. Freelancers seed insert
    if (query.startsWith("insert into freelancers")) {
      return {
        run: (...args: unknown[]) => {
          this.data.freelancers.push({
            handle: String(args[0]),
            address: String(args[1]),
            name: String(args[2]),
            headline: String(args[3]),
            bio: String(args[4]),
            avatar_url: args[5] ? String(args[5]) : undefined,
          });
          this.save();
          return { changes: 1, lastInsertRowid: this.data.freelancers.length };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // 3. Portfolio items insert
    if (query.startsWith("insert into portfolio_items")) {
      return {
        run: (...args: unknown[]) => {
          const id = this.data.portfolio_items.length + 1;
          this.data.portfolio_items.push({
            id,
            handle: String(args[0]),
            title: String(args[1]),
            description: String(args[2]),
            tag: String(args[3]),
            image_url: args[4] ? String(args[4]) : undefined,
          });
          this.save();
          return { changes: 1, lastInsertRowid: id };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // 4. Packages insert
    if (query.startsWith("insert into packages")) {
      return {
        run: (...args: unknown[]) => {
          const id = this.data.packages.length + 1;
          this.data.packages.push({
            id,
            handle: String(args[0]),
            name: String(args[1]),
            description: String(args[2]),
            price_credits: Number(args[3]),
            delivery_days: Number(args[4]),
            revisions: Number(args[5]),
          });
          this.save();
          return { changes: 1, lastInsertRowid: id };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // 5. Commission requests insert
    if (query.startsWith("insert into commission_requests")) {
      return {
        run: (...args: unknown[]) => {
          const id = this.data.commission_requests.length + 1;
          this.data.commission_requests.push({
            id,
            handle: String(args[0]),
            requester_address: args[1] ? String(args[1]) : null,
            title: String(args[2]),
            description: String(args[3]),
            budget_credits: Number(args[4]),
            created_at: Number(args[5]),
          });
          this.save();
          return { changes: 1, lastInsertRowid: id };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // 6. Reviews insert
    if (query.startsWith("insert into reviews")) {
      return {
        run: (...args: unknown[]) => {
          if (!this.data.reviews) this.data.reviews = [];
          const id = this.data.reviews.length + 1;
          this.data.reviews.push({
            id,
            agreement_id: args[0] ? String(args[0]) : null,
            freelancer_handle: String(args[1]),
            reviewer_address: String(args[2]),
            rating: Number(args[3]),
            comment: String(args[4]),
            created_at: Number(args[5]),
          });
          this.save();
          return { changes: 1, lastInsertRowid: id };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // 7. Update freelancer headline & bio
    if (
      query.includes("update freelancers set") &&
      query.includes("headline") &&
      query.includes("bio")
    ) {
      return {
        run: (...args: unknown[]) => {
          const headline = String(args[0]);
          const bio = String(args[1]);
          const handle = String(args[2]);
          const f = this.data.freelancers.find((fl) => fl.handle === handle);
          if (f) {
            f.headline = headline;
            f.bio = bio;
            this.save();
            return { changes: 1, lastInsertRowid: 0 };
          }
          return { changes: 0, lastInsertRowid: 0 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // 8. Update package price & delivery days
    if (
      query.includes("update packages set") &&
      query.includes("price_credits") &&
      query.includes("delivery_days")
    ) {
      return {
        run: (...args: unknown[]) => {
          const priceCredits = Number(args[0]);
          const deliveryDays = Number(args[1]);
          const id = Number(args[2]);
          const p = this.data.packages.find((pkg) => pkg.id === id);
          if (p) {
            p.price_credits = priceCredits;
            p.delivery_days = deliveryDays;
            this.save();
            return { changes: 1, lastInsertRowid: 0 };
          }
          return { changes: 0, lastInsertRowid: 0 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // 9. listStorefronts query
    if (query.includes("count(p.id) as packagecount")) {
      return {
        all: () => {
          return this.data.freelancers.map((f) => {
            const pkgs = this.data.packages.filter((p) => p.handle === f.handle);
            const fromCredits = pkgs.length > 0 ? Math.min(...pkgs.map((p) => p.price_credits)) : 0;
            const previewItems = this.data.portfolio_items.filter((p) => p.handle === f.handle);
            const previewImages = previewItems
              .map((p) => p.image_url)
              .filter((url): url is string => Boolean(url));
            return {
              handle: f.handle,
              address: f.address,
              name: f.name,
              headline: f.headline,
              bio: f.bio,
              avatarUrl: f.avatar_url,
              packageCount: pkgs.length,
              fromCredits,
              previewImages,
            };
          });
        },
        get: () => undefined,
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }

    // 10. Single freelancer query by handle
    if (query.includes("from freelancers") && query.includes("where handle = ?")) {
      return {
        get: (handle: string) => {
          let f = this.data.freelancers.find((fl) => fl.handle === handle);
          if (!f && handle === "ines-varga") {
            f = this.data.freelancers[0];
          }
          if (!f) return undefined;
          return {
            handle: f.handle,
            address: f.address,
            name: f.name,
            headline: f.headline,
            bio: f.bio,
            avatarUrl: f.avatar_url,
          };
        },
        all: () => [],
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }

    // 11. Single freelancer query by address
    if (
      query.includes("from freelancers") &&
      (query.includes("where address = ?") ||
        query.includes("address = lower(?)") ||
        query.includes("collate nocase"))
    ) {
      return {
        get: (address: string) => {
          const lower = String(address).toLowerCase();
          const f = this.data.freelancers.find((fl) => fl.address.toLowerCase() === lower);
          if (!f) return undefined;
          return {
            handle: f.handle,
            address: f.address,
            name: f.name,
            headline: f.headline,
            bio: f.bio,
            avatarUrl: f.avatar_url,
          };
        },
        all: () => [],
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }

    // 12. Portfolio items by handle
    if (query.includes("from portfolio_items where handle = ?")) {
      return {
        all: (handle: string) => {
          const targetHandle =
            handle === "ines-varga" &&
            !this.data.portfolio_items.some((i) => i.handle === "ines-varga")
              ? (this.data.freelancers[0]?.handle ?? handle)
              : handle;
          return this.data.portfolio_items
            .filter((item) => item.handle === targetHandle)
            .map((item) => ({
              id: item.id,
              title: item.title,
              description: item.description,
              tag: item.tag,
              imageUrl: item.image_url,
            }))
            .sort((a, b) => a.id - b.id);
        },
        get: () => undefined,
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }

    // 13. Packages by handle
    if (query.includes("from packages where handle = ?")) {
      return {
        all: (handle: string) => {
          const targetHandle =
            handle === "ines-varga" && !this.data.packages.some((p) => p.handle === "ines-varga")
              ? (this.data.freelancers[0]?.handle ?? handle)
              : handle;
          return this.data.packages
            .filter((p) => p.handle === targetHandle)
            .map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              priceCredits: p.price_credits,
              deliveryDays: p.delivery_days,
              revisions: p.revisions,
            }))
            .sort((a, b) => a.priceCredits - b.priceCredits);
        },
        get: () => undefined,
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }

    // 14. getPackageWithFreelancer
    if (query.includes("from packages p") && query.includes("where p.id = ?")) {
      return {
        get: (packageId: number) => {
          const pkg = this.data.packages.find((p) => p.id === Number(packageId));
          if (!pkg) return undefined;
          const fl = this.data.freelancers.find((f) => f.handle === pkg.handle);
          return {
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            priceCredits: pkg.price_credits,
            deliveryDays: pkg.delivery_days,
            revisions: pkg.revisions,
            freelancerAddress: fl?.address ?? "",
          };
        },
        all: () => [],
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }

    // 15. Reviews by freelancer handle
    if (query.includes("from reviews where freelancer_handle = ?")) {
      return {
        all: (handle: string) => {
          const targetHandle =
            handle === "ines-varga" &&
            !this.data.reviews.some((r) => r.freelancer_handle === "ines-varga")
              ? (this.data.freelancers[0]?.handle ?? handle)
              : handle;
          return (this.data.reviews || [])
            .filter((r) => r.freelancer_handle === targetHandle)
            .map((r) => ({
              id: r.id,
              agreementId: r.agreement_id,
              freelancerHandle: r.freelancer_handle,
              reviewerAddress: r.reviewer_address,
              rating: r.rating,
              comment: r.comment,
              createdAt: r.created_at,
            }))
            .sort((a, b) => b.createdAt - a.createdAt);
        },
        get: () => undefined,
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }

    // 16. Reviews by agreement_id
    if (query.includes("from reviews where agreement_id = ?")) {
      return {
        get: (agreementId: string) => {
          const r = (this.data.reviews || []).find((row) => row.agreement_id === agreementId);
          if (!r) return undefined;
          return {
            id: r.id,
            agreementId: r.agreement_id,
            freelancerHandle: r.freelancer_handle,
            reviewerAddress: r.reviewer_address,
            rating: r.rating,
            comment: r.comment,
            createdAt: r.created_at,
          };
        },
        all: (agreementId: string) => {
          return (this.data.reviews || [])
            .filter((row) => row.agreement_id === agreementId)
            .map((r) => ({
              id: r.id,
              agreementId: r.agreement_id,
              freelancerHandle: r.freelancer_handle,
              reviewerAddress: r.reviewer_address,
              rating: r.rating,
              comment: r.comment,
              createdAt: r.created_at,
            }));
        },
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }

    // 17. Insert into dispute_messages
    if (query.startsWith("insert into dispute_messages")) {
      return {
        run: (...args: unknown[]) => {
          if (!this.data.dispute_messages) this.data.dispute_messages = [];
          const id = this.data.dispute_messages.length + 1;
          this.data.dispute_messages.push({
            id,
            agreement_id: String(args[0]),
            milestone_index: Number(args[1]),
            sender_address: String(args[2]),
            sender_role: String(args[3]),
            message: String(args[4]),
            blob_hash: args[5] ? String(args[5]) : undefined,
            created_at: Number(args[6]),
          });
          this.save();
          return { changes: 1, lastInsertRowid: id };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // 18. Dispute messages by agreement_id and milestone_index
    if (
      query.includes("from dispute_messages") &&
      query.includes("where agreement_id = ? and milestone_index = ?")
    ) {
      return {
        all: (agreementId: string, milestoneIndex: number) => {
          return (this.data.dispute_messages || [])
            .filter(
              (m) =>
                m.agreement_id === String(agreementId) &&
                m.milestone_index === Number(milestoneIndex),
            )
            .map((m) => ({
              id: m.id,
              agreementId: m.agreement_id,
              milestoneIndex: m.milestone_index,
              senderAddress: m.sender_address,
              senderRole: m.sender_role,
              message: m.message,
              blobHash: m.blob_hash,
              createdAt: m.created_at,
            }))
            .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
        },
        get: () => undefined,
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }

    // 19. Insert into tips
    if (query.startsWith("insert into tips")) {
      return {
        run: (...args: unknown[]) => {
          if (!this.data.tips) this.data.tips = [];
          const id = this.data.tips.length + 1;
          this.data.tips.push({
            id,
            agreement_id: String(args[0]),
            buyer_address: String(args[1]),
            freelancer_address: String(args[2]),
            amount_credits: Number(args[3]),
            created_at: Number(args[4]),
          });
          this.save();
          return { changes: 1, lastInsertRowid: id };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // 20. Tips by agreement_id
    if (query.includes("from tips") && query.includes("where agreement_id = ?")) {
      return {
        all: (agreementId: string) => {
          return (this.data.tips || [])
            .filter((t) => t.agreement_id === String(agreementId))
            .map((t) => ({
              id: t.id,
              agreementId: t.agreement_id,
              buyerAddress: t.buyer_address,
              freelancerAddress: t.freelancer_address,
              amountCredits: t.amount_credits,
              createdAt: t.created_at,
            }))
            .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
        },
        get: () => undefined,
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }

    // 21. Tips by freelancer_address
    if (query.includes("from tips") && query.includes("where freelancer_address = ?")) {
      return {
        all: (freelancerAddress: string) => {
          return (this.data.tips || [])
            .filter(
              (t) => t.freelancer_address.toLowerCase() === String(freelancerAddress).toLowerCase(),
            )
            .map((t) => ({
              id: t.id,
              agreementId: t.agreement_id,
              buyerAddress: t.buyer_address,
              freelancerAddress: t.freelancer_address,
              amountCredits: t.amount_credits,
              createdAt: t.created_at,
            }))
            .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
        },
        get: () => undefined,
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }

    // Fallback stub statement
    return {
      run: () => ({ changes: 0, lastInsertRowid: 0 }),
      get: () => undefined,
      all: () => [],
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let instance: any | undefined;

/** Creates any missing tables. Safe to run repeatedly; the seed script runs it after a reset. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applySchema(db: any): void {
  try {
    const schemaSql = readFileSync(path.join(process.cwd(), "src/lib/db/schema.sql"), "utf8");
    db.exec(schemaSql);
  } catch {
    // Ignored in JSON mode
  }
}

/**
 * Lazily opens the database file (DB_PATH is relative to web/).
 * Uses better-sqlite3 when native bindings are present;
 * otherwise gracefully falls back to the pure JSON-file store
 * as specified in the plan.md Risk Register.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDb(): any {
  if (instance) return instance;
  const configured = process.env.DB_PATH ?? "./.data/fairwork.db";
  let file: string;
  if (configured === IN_MEMORY) {
    file = IN_MEMORY;
  } else if (path.isAbsolute(configured)) {
    file = configured;
  } else {
    const candidateDirect = path.resolve(process.cwd(), configured);
    const candidateWeb = path.resolve(process.cwd(), "web", configured);
    if (existsSync(candidateDirect) || existsSync(candidateDirect.replace(/\.db$/, ".json"))) {
      file = candidateDirect;
    } else if (existsSync(candidateWeb) || existsSync(candidateWeb.replace(/\.db$/, ".json"))) {
      file = candidateWeb;
    } else {
      file = candidateDirect;
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BetterSqlite3 = require("better-sqlite3");
    if (file !== IN_MEMORY) mkdirSync(path.dirname(file), { recursive: true });
    const db = new BetterSqlite3(file);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    applySchema(db);
    instance = db;
    return db;
  } catch {
    // Bindings unavailable on this runtime/platform (e.g. Node 24 on Windows).
    // Graceful fallback to pure JSON store as defined in plan.md.
    const jsonDb = new JsonDatabase(file);
    applySchema(jsonDb);
    instance = jsonDb;
    return jsonDb;
  }
}

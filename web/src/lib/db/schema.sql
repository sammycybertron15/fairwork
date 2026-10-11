-- Off-chain words only: balances and state live on chain (spec 3.1).
-- Content-addressed blobs: `hash` is keccak256 of the canonical JSON stored in `json`.
CREATE TABLE IF NOT EXISTS blobs (
  hash       TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('terms', 'evidence', 'reason', 'rationale', 'negotiation')),
  json       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Storefronts (spec 7.2). Demo data only; none of it is authoritative for credits.
CREATE TABLE IF NOT EXISTS freelancers (
  handle     TEXT PRIMARY KEY,
  address    TEXT NOT NULL,
  name       TEXT NOT NULL,
  headline   TEXT NOT NULL,
  bio        TEXT NOT NULL,
  avatar_url TEXT
);

CREATE TABLE IF NOT EXISTS portfolio_items (
  id          INTEGER PRIMARY KEY,
  handle      TEXT NOT NULL REFERENCES freelancers (handle),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  tag         TEXT NOT NULL,
  image_url   TEXT
);

CREATE TABLE IF NOT EXISTS packages (
  id            INTEGER PRIMARY KEY,
  handle        TEXT NOT NULL REFERENCES freelancers (handle),
  name          TEXT NOT NULL,
  description   TEXT NOT NULL,
  price_credits INTEGER NOT NULL CHECK (price_credits > 0),
  delivery_days INTEGER NOT NULL CHECK (delivery_days > 0),
  revisions     INTEGER NOT NULL CHECK (revisions >= 0)
);

-- Unverified inbox: requests are unsigned and never move credits.
CREATE TABLE IF NOT EXISTS commission_requests (
  id                INTEGER PRIMARY KEY,
  handle            TEXT NOT NULL REFERENCES freelancers (handle),
  requester_address TEXT,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  budget_credits    INTEGER NOT NULL CHECK (budget_credits > 0),
  created_at        INTEGER NOT NULL
);

-- Buyer reviews and reputation
CREATE TABLE IF NOT EXISTS reviews (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  agreement_id      TEXT,
  freelancer_handle TEXT NOT NULL REFERENCES freelancers (handle),
  reviewer_address  TEXT NOT NULL,
  rating            INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment           TEXT NOT NULL,
  created_at        INTEGER NOT NULL
);

-- In-agreement negotiation & dispute messages
CREATE TABLE IF NOT EXISTS dispute_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  agreement_id    TEXT NOT NULL,
  milestone_index INTEGER NOT NULL,
  sender_address  TEXT NOT NULL,
  sender_role     TEXT NOT NULL,
  message         TEXT NOT NULL,
  blob_hash       TEXT,
  created_at      INTEGER NOT NULL
);

-- Post-completion tips
CREATE TABLE IF NOT EXISTS tips (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  agreement_id       TEXT NOT NULL,
  buyer_address      TEXT NOT NULL,
  freelancer_address TEXT NOT NULL,
  amount_credits     INTEGER NOT NULL CHECK (amount_credits > 0),
  created_at         INTEGER NOT NULL
);

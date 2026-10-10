# Fairwork: Implementation Plan

**Workflow:** Specification → Implementation Plan → Implementation
**Timebox:** 5-6 hours. Phases total **5h40**; the remaining 20 minutes are unallocated float.
**Spec:** [`spec.md`](./spec.md) (v2) is the source of truth. This file says *in what order, in how much time, and when to stop*.
**Model reminder:** Fairwork demonstrates blockchain-enforced accounting and conditional settlement with **local-only demo credits** (buyer starts with 6,000). No ETH, no payable functions, no withdrawals, no token standard, no real assets.

---

## 0. How we work

### The three stages
1. **Specification (`spec.md`)**: scope, contract rules, invariants, verification, boundaries. Changes are committed *before* the code that depends on them.
2. **Plan (this file)**: phases, tasks, exit criteria, checkpoints, cut rules.
3. **Implementation**: one phase at a time, thin vertical slices, a runnable demo at every checkpoint.

### Scope focus
Everything serves two flows. If time runs short, protect these and cut the rest.

- **Golden path (GP):** propose → approve → fund → submit → (revision → resubmit) → accept.
- **Dispute path (DP):** fund → submit → dispute → resolver settles with a partial split; other milestones untouched.

| Tier | Contents | Rule |
|------|----------|------|
| A | Contract (all of spec 6), storefront page (minimal), agreement create/approve/fund, submit/revise/accept, dispute and resolver settlement, hash verification | Must work at the demo |
| B | Dashboard page, timeout and refund buttons, per-agreement history polish, commission inbox view, file-hash helper | Cut in reverse order if behind |
| C | AI assessment, reviews | Only after tier A and B exit criteria pass |

### Rules of the build
- **Risk first, priority second.** The contract and wallet integration are the riskiest part, so they come before storefronts. The skeleton must work by the end of P2.
- **Vertical slices:** each phase ends with something a human can click.
- **Definition of done for a task:** code written, test or manual check passes, `lint` and `typecheck` clean, committed with a conventional message.
- **Timebox discipline:** compare the clock at every checkpoint. Behind by more than 15 minutes → apply that phase's cut rule immediately.
- **Commit at every exit criterion**, tag at every phase end (`checkpoint-pN`).
- **Using an AI coding assistant?** Give it `spec.md` and only the current phase of this file, one task at a time. Review diffs against the invariants (spec 6.6). Never accept code that skips a failing test.

### Time budget

| Phase | Name | Minutes | Cumulative |
|-------|------|---------|------------|
| P0 | Foundations | 30 | 0:30 |
| P1 | Ledger contract + tests | 75 | 1:45 |
| P2 | Web foundation + walking skeleton | 35 | 2:20 |
| P3 | Storefronts (F1, minimal) | 35 | 2:55 |
| P4 | Agreements, milestones, funding UI (F2, F3) | 55 | 3:50 |
| P5 | Deliverables, revisions, disputes UI (F4, F5) | 50 | 4:40 |
| P6 | Dashboard + history (F6) | 30 | 5:10 |
| P7 | Hardening, demo prep | 30 | 5:40 |
| | Float | 20 | 6:00 |

Spend banked time on P1 or P7 first, never on tier C.

---

## P0: Foundations (30 min)

**Goal:** a wired empty repo using the single setup chosen in spec section 4.

- [ ] `git init`, `.gitignore`, `.nvmrc` (20), `.prettierrc`, root `package.json` with `"workspaces": ["chain", "web"]` and `engines.node`
- [ ] `chain/`: Hardhat 2.x TypeScript project + `@nomicfoundation/hardhat-toolbox-viem`; Solidity pinned; `localhost` network at `http://127.0.0.1:8545`; scripts `node`, `deploy`, `test`, `typecheck`
- [ ] `web/`: Next.js App Router, TypeScript strict, Tailwind v4 (tokens in `@theme` in `globals.css`), ESLint, Vitest; scripts `dev`, `build`, `seed`, `test`, `lint`, `typecheck`; `next.config` with `serverExternalPackages: ["better-sqlite3"]`
- [ ] Install `wagmi`, `viem`, `@tanstack/react-query`, `zod`, `better-sqlite3`, `tsx` (web); `concurrently`, `wait-on`, `prettier` (root); pin exact versions; one `viem` version across workspaces
- [ ] Design tokens exactly as spec 8.4; fonts via `next/font` (Outfit, DM Sans, JetBrains Mono)
- [ ] Root scripts exactly as spec section 10 (`chain`, `deploy:local`, `seed`, `dev`, `demo`, `test`, `test:chain`, `test:web`, `lint`, `typecheck`, `format`)
- [ ] App shell: header with nav and connect placeholder, canvas background, footer line "Demo credits are local accounting entries with no monetary value."

**Exit criteria:** `npm run lint && npm run typecheck && npm run test` pass on empty suites; `npm run dev` shows the shell in the right palette and fonts.
**Tag:** `checkpoint-p0`.
**Cut rule:** skip Prettier polish; keep tokens, fonts and the footer line.

---

## P1: Ledger contract + tests (75 min) · riskiest phase

**Goal:** `FairworkLedger.sol` implements spec section 6 completely; tests T1-T9 pass. After this phase the contract is **frozen** (changes need the "Ask first" rule).

Work test-first by behavior; commit after each step:

1. [ ] **Scaffold:** constants, constructor with `LocalChainOnly` guard and 6,000-credit grant, enums, structs, storage, events, errors, NatSpec stubs; `helpers.ts` with the deploy fixture and conservation check (10 min)
2. [ ] **`propose`, `approve`, `cancelProposal`** + T1, T2 (15 min)
3. [ ] **`fundMilestone`** (sequential, deadline, credits check) + T3 (8 min)
4. [ ] **`submitWork`, `acceptWork`, `requestRevision`** + T4 (12 min)
5. [ ] **`claimAfterReviewTimeout`, `reclaimMissedDeadline`** + T5 with time travel (8 min)
6. [ ] **`raiseDispute`, `resolveDispute`** + T6, T7 (10 min)
7. [ ] **Permissions sweep T8** and **conservation T9** wired into every scenario (7 min)
8. [ ] **`deploy-local.ts`:** deploy with account #4 as the demo buyer; write `web/src/generated/abi.ts` and `deployment.json` (address, deployBlock, chainId) (5 min)

**Exit criteria:**
- [ ] T1-T9 pass via `npm run test:chain`
- [ ] Conservation (I1) asserted after every transaction in scenario tests
- [ ] `npm run chain` then `npm run deploy:local` produces both generated files; buyer reads 6,000 credits
- [ ] `grep -rn "payable\|msg.value\|receive()\|fallback()" chain/contracts` returns nothing

**Checkpoint (1:10 on the clock):** steps 1-4 must be done. If not, push T5 (timeouts) to the end of P1 and implement it last; never defer T8 or T9.
**Cut rule:** if the clock is at 1:45 and timeouts are unfinished, ship without `claimAfterReviewTimeout` and `reclaimMissedDeadline`, log it in the spec decision log, and drop demo step 6.
**Tag:** `checkpoint-p1`. This is the fallback demo (contract plus tests).

---

## P2: Web foundation + walking skeleton (35 min)

**Goal:** one real transaction from the browser, and a clean seam between pure logic and UI.

- [ ] wagmi config: local Hardhat chain only, `injected` connector, `ssr: true`, `NEXT_PUBLIC_RPC_URL`; wrong-network control (8 min)
- [ ] Connect/disconnect, short address, role detection (buyer, freelancer, resolver, viewer) per agreement (4 min)
- [ ] `lib/chain/`: typed reads (`availableOf`, `getAgreement`, `getMilestones`) and a write wrapper with the four tx states (awaiting wallet, pending, confirmed, failed with decoded error name) (10 min)
- [ ] `lib/terms.ts`: zod schema, canonicalize, keccak hash, **unit test** (stable under key order, changes with any field) (6 min)
- [ ] `lib/actions.ts`: `availableActions(...)` with a unit test of the spec 8.2 matrix (5 min)
- [ ] DB: `schema.sql`, blobs table, `PUT /api/blobs`, `GET /api/blobs/[hash]` (2 min; trim if needed)

**Exit criteria:**
- [ ] Connect the demo buyer and see **6,000 credits** read from the chain
- [ ] A hard-coded button calls `propose` and the agreement reads back from the chain
- [ ] `terms` and `actions` unit tests pass; blob put/get round-trips and re-verifies

**Checkpoint (2:20):** if the skeleton does not work, stop and fix it; everything after depends on it.
**Cut rule:** hard-code UI around the skeleton, but keep the hash logic and the tx-state wrapper.
**Tag:** `checkpoint-p2`.

---

## P3: Storefronts, F1 minimal (35 min)

**Goal:** a shareable, good-looking storefront that leads into an agreement.

- [ ] `scripts/seed.ts`: reset DB; 3 demo freelancers (accounts #1-#3; for example design, web development, motion), 3 portfolio items each, 2 packages each with price in credits and delivery days; addresses read from the node (8 min)
- [ ] `GET /api/freelancers` and `/[handle]` (4 min)
- [ ] `/f/[handle]`: header, portfolio grid (flat `--stone-soft` and `--ink` blocks, no stock imagery, no gradients), package cards (price in credits, delivery estimate), **Start agreement** → `/agreements/new?package=<id>` (13 min)
- [ ] Custom commission form → `POST /api/commission-requests`; success state; "unverified" label (6 min)
- [ ] `/`: three storefront cards and the connect entry (4 min)

**Exit criteria:** all 3 storefronts load by URL with no wallet; package → "Start agreement" carries the prefill; a commission request saves.
**Cut rule:** 2 portfolio items per profile; the commission form stores and confirms only (no inbox, no `?request=` prefill).
**Tag:** `checkpoint-p3`.

---

## P4: Agreements, milestones, funding UI (55 min)

**Goal:** propose, approve and fund with accurate statuses and verified terms (GP part 1).

- [ ] `/agreements/new`: form (title, description, resolver select from demo, review window, 1-5 milestones each with title, deliverables, acceptance criteria as one textarea split by line, credits, deadline, revision limit); prefill from package; live hash preview; warn if total credits exceed the buyer's available credits; submit = `PUT /api/blobs` then `propose` (18 min)
- [ ] `/agreements/[id]`: terms from blob, **Verified / Hash mismatch** marker (spec 7.1), roles, Approve for the counterparty (13 min)
- [ ] Milestone timeline: status marker, credits, payment state label (spec 3.5), deadline countdown, revisions used / limit; progress summary ("1 of 3 accepted · 500 of 1,500 credits released") from chain fields (14 min)
- [ ] Fund action (current milestone only) with the "no monetary value" line; tx states and tx hash copy; balances shown from `availableOf` (7 min)
- [ ] Action panel rendered from `availableActions` with disabled reasons (3 min)

**Exit criteria:** with two wallets: propose, switch, verify, approve, fund milestone 1; buyer shows 5,500 available and 500 locked; the UI matches the chain; tampering with the stored blob blocks Approve and Fund.
**Cut rule:** reduce to 3 milestones in the form; never cut hash verification.
**Tag:** `checkpoint-p4`.

---

## P5: Deliverables, revisions, disputes UI (50 min)

**Goal:** the rest of GP, plus DP.

- [ ] Evidence form (note and references with label/url or pasted sha256); store blob, then `submitWork(hash)` (9 min)
- [ ] Buyer review panel: evidence with hash check, **Accept**, **Request revision** (reason textarea → blob → tx), disabled reasons for window and limit rules (10 min)
- [ ] Freelancer resubmit and revision counter (4 min)
- [ ] Dispute: raise (reason blob + tx), "Locked: in dispute" state, resolver panel (visible only to that agreement's resolver): slider 0-100% mapped to an exact integer credit split plus rationale → `resolveDispute`; settled milestone shows paid and refunded amounts (15 min)
- [ ] Timeout and refund buttons from `availableActions` plus the dev-only advance-time control (viem test client) (tier B, 8 min)
- [ ] Wire settled states into the timeline; confirm the isolation visually (4 min)

**Exit criteria:** demo script steps 4 and 5 pass with the exact balances in spec 9.4 (freelancer 990, buyer 5,010 after the dispute); a paid milestone cannot be paid again from the UI or by a direct contract call.
**Cut rule:** drop the file-hash helper first, then the timeout buttons and the advance-time control (keep the contract functions). Keep the resolver panel and the dispute lock.
**Tag:** `checkpoint-p5`.

---

## P6: Dashboard + history (30 min)

**Goal:** separate Buyer and Freelancer views on one page, with verified history on each agreement.

- [ ] `lib/chain/events.ts`: `AgreementProposed` logs filtered by `buyer` and by `freelancer`, then batch reads of agreements and milestones; per-agreement events with block timestamps (10 min)
- [ ] `lib/selectors.ts` (pure, unit-tested): available, locked (escrow), released, refunded totals; next deadlines; disputes; per-agreement progress (7 min)
- [ ] `/dashboard?view=buyer|freelancer` in the `--ink` container: metric row with lime highlights, agreements table, deadlines, dispute list (10 min)
- [ ] History list on the agreement page: event name, plain sentence, credits, tx hash with copy, block time (3 min)

**Exit criteria:** after the E2E flow both views show totals that match chain reads (buyer 4,710 available at the end of the full script; freelancer 1,290 received) and the history lists every event in order.
**Cut rule:** drop deadlines and aggregated dashboard history; keep totals, disputes and per-agreement history.
**Tag:** `checkpoint-p6`.

---

## P7: Hardening and demo prep (30 min)

- [ ] Full manual E2E from a **fresh clone** using `npm run demo`; fix blockers only (12 min)
- [ ] Empty, loading and error states on every page: no wallet, wrong network, no agreements (6 min)
- [ ] Audit: no gradients or pills, tokens only, no ETH/wei wording (`grep` checks in spec 9.3), footer line present (4 min)
- [ ] README: quickstart, wallet import steps and nonce-reset note, demo script, diagram, honesty statement (5 min)
- [ ] Final `lint`, `typecheck`, `test`; tag `v0.1.0`; optional 2-minute screen recording (3 min)

**Definition of Done (project):**
- [ ] GP and DP pass end to end with the expected balances (spec 9.4)
- [ ] Tier A acceptance criteria in spec section 2 pass; tier B as far as built
- [ ] `npm run test` green (T1-T9 plus three web suites); `lint` and `typecheck` clean
- [ ] Credits-only grep checks clean; contract holds no ETH
- [ ] Fresh-clone `npm run demo` works; no secrets committed; `main` green and tagged

---

## Stretch (tier C, only after tier A and B pass)

1. **Advisory AI assessment (30 min):** `POST /api/disputes/[key]/assessment` summarizes terms, evidence and reasons and suggests a split. The UI labels it "Advisory, not binding"; the resolver form is prefilled only if they press a button; the server never touches the chain.
2. **Reviews (20 min):** stored off chain, tied to a completed agreement.

Removed from the earlier plan: testnet deployment (the contract is local-only by construction) and tips (they would need free credit transfers, which the ledger does not allow).

## Risk register

| Risk | Early signal | Response |
|------|--------------|----------|
| Contract runs past 75 min | Checkpoint at 1:10 missed | Move timeouts to last in P1; protect T8 and T9; apply the P1 cut rule at 1:45 |
| Wallet or network trouble | Skeleton fails at P2 | Fix first; reset the wallet account after node restarts; check the "Switch to Hardhat Local" control |
| `better-sqlite3` native build fails | Install error in P0 | Switch to a JSON-file store behind the same `db/` module |
| Scope creep into tier C | Working on AI or reviews before P6 passes | Stop; tiers above are the gate |
| UI slop creeping in | Gradients, fully rounded shapes, raw hex in components | Audit in P7; tokens only |
| Demo waits on time windows | Review windows are hours or days | Use the advance-time control, or skip step 6 |
| Credits run out | Buyer (#4) has 6,000 total | Restart with `npm run demo` for a fresh ledger |

## Demo script (2-3 minutes)

Start: buyer 6,000, freelancer 0. Agreement: 3 milestones of 500, 700 and 300 credits.

1. Open a storefront, pick a package, **Start agreement**.
2. Buyer proposes; switch to the freelancer; show **Verified**; approve.
3. **GP:** fund milestone 1 (buyer 5,500, locked 500); submit evidence; request a revision with a reason; resubmit; accept (freelancer 500).
4. **DP:** fund milestone 2 (buyer 4,800); submit; buyer disputes; credits locked; resolver settles 70/30 (freelancer 990, buyer 5,010); milestone 1 unchanged.
5. **Timeout (if built):** fund milestone 3; submit; advance time; freelancer claims (freelancer 1,290, buyer 4,710).
6. Show both dashboard views and the event history with tx hashes. Close on conservation: 4,710 + 1,290 = 6,000 credits, nothing created or lost, and no real asset ever involved.

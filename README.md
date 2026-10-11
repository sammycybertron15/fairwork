# Fairwork

> Milestone-based freelance agreements with blockchain-enforced credit accounting on a local Hardhat chain.

Fairwork solves the classic freelance trust dilemma—who delivers or pays first—by pairing off-chain, content-addressed terms and deliverable storage with an on-chain, conservation-invariant smart contract ledger.

---

## Honesty Statement on Demo Credits

> **Important:** Demo credits are local accounting entries inside an isolated, non-custodial smart contract deployed strictly to a local Hardhat node (`chainId 31337`).
>
> - They have **zero monetary value**.
> - They cannot be withdrawn, transferred outside agreements, or exchanged for real currency.
> - The contract contains no payable functions, no token wrappers, no mint/burn functions, and holds 0 ETH at all times.

---

## System Overview

1. **Smart Contract Ledger (`chain/contracts/FairworkLedger.sol`)**:
   - Pinned Solidity 0.8.24 running on Hardhat Local.
   - Enforces mathematical conservation: $\text{Available} + \text{Escrow} = \text{Total Issued} = 6,000\text{ credits}$.
   - Manages agreement proposals, mutual approvals, milestone escrow funding, deliverable submissions, revisions, disputes, resolver settlements, and timeouts.
2. **Deterministic Content Addressing (`web/src/lib/terms.ts`, `blobs.ts`)**:
   - Canonicalizes JSON terms and evidence payloads (sorted keys, strict schemas, zero whitespace).
   - Generates deterministic Keccak-256 hashes verified on-chain.
3. **Frontend Application (`web/`)**:
   - Next.js 15 App Router, React 19, Wagmi, Viem, and Tailwind CSS.
   - Follows strict design system tokens: off-white canvas (`#F7F7F2`), `--ink` container (`#080A05`), vivid `--lime` highlights (`#A0C82F`), 8px square status markers, and no pills or gradients.

---

## Quickstart

### Prerequisites

- Node.js 20 or 22+
- npm 10+
- A Web3 browser wallet (e.g. MetaMask)

### 1. Install Dependencies

```bash
npm install
```

### 2. Launch Full Demo Environment

Run the entire demo sequence with a single command:

```bash
npm run demo
```

This concurrently starts:

1. Hardhat node on `http://127.0.0.1:8545` (Chain ID `31337`).
2. Deploys `FairworkLedger.sol` and grants the demo buyer 6,000 credits.
3. Seeds SQLite with demo freelancer profiles and packages.
4. Starts Next.js development server on `http://localhost:3000`.

_Alternatively, run the services individually:_

```bash
# Terminal 1: Start local node
npm run chain

# Terminal 2: Deploy contract and seed database
npm run deploy:local
npm run seed

# Terminal 3: Start frontend
npm run dev
```

---

## Wallet Setup Guide

Connect your browser wallet (e.g., MetaMask) to the local node:

- **Network Name**: Hardhat Local
- **RPC URL**: `http://127.0.0.1:8545`
- **Chain ID**: `31337`
- **Currency Symbol**: `ETH` (used only for zero-cost local gas)

### Import Demo Accounts

Import these well-known Hardhat accounts using their private keys:

| Role                         | Account Index | Public Address                               | Private Key                                                          |
| :--------------------------- | :-----------: | :------------------------------------------- | :------------------------------------------------------------------- |
| **Demo Buyer**               |     `#4`      | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |
| **Freelancer (Ines Varga)**  |     `#1`      | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| **Freelancer (Tomas Reyes)** |     `#2`      | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| **Resolver**                 |     `#9`      | `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` | `0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6` |

> **Crucial Wallet Note (Resetting Nonces):**
> Whenever the Hardhat node restarts, local transaction counts reset to 0. In MetaMask, go to **Settings → Advanced → Clear activity tab data** (or **Reset account**) for each imported account to prevent RPC nonce errors.

---

## 2-to-3 Minute Demo Walk-Through Script

Follow this script to verify all lifecycle paths and mathematical conservation ($6,000\text{ credits}$ total):

### Initial State

- **Buyer (#4)** holds **6,000 available credits**.
- **Freelancer (#1)** holds **0 credits**.

### Step 1: Proposal & Verification

1. Connect with **Buyer (#4)**.
2. Go to `/f/ines-varga`, pick a package, and click **Start agreement**.
3. Create 3 milestones:
   - Milestone 1: **500 credits** (2 revisions)
   - Milestone 2: **700 credits** (1 revision)
   - Milestone 3: **300 credits** (0 revisions)
     _(Total: 1,500 credits)_
4. Submit the proposal.
5. Switch wallet to **Freelancer (#1)**. Navigate to the agreement link:
   - Notice the green **Verified** badge (terms hash recomputed and verified).
   - Click **Approve agreement**. Agreement becomes **Active**.

### Step 2: Golden Path (Milestone 1)

1. Switch to **Buyer (#4)**. Click **Fund milestone 1: lock 500 credits**.
   - _Balances:_ Buyer = 5,500, Escrow = 500, Freelancer = 0.
2. Switch to **Freelancer (#1)**. Enter deliverable note and references, then click **Submit work**.
3. Switch to **Buyer (#4)**:
   - Review submitted evidence with verified hash.
   - Click **Request revision**, provide feedback, and confirm.
4. Switch to **Freelancer (#1)**:
   - Notice revision status tag and revision counter (`1 / 2 used`).
   - Enter revised note and click **Resubmit work**.
5. Switch to **Buyer (#4)**:
   - Click **Accept work & release credits**.
   - _Balances:_ Buyer = 5,500, Escrow = 0, Freelancer = **500**. Milestone 1 payment state shows **Released**.

### Step 3: Dispute & Resolver Settlement (Milestone 2)

1. Switch to **Buyer (#4)**. Click **Fund milestone 2: lock 700 credits**.
   - _Balances:_ Buyer = 4,800, Escrow = 700, Freelancer = 500.
2. Switch to **Freelancer (#1)** and submit deliverable work.
3. Switch to **Buyer (#4)**. Click **Dispute deliverable**, enter dispute reason, and confirm.
   - Milestone payment state enters **Locked: in dispute**. All standard actions are locked out.
4. Switch wallet to **Resolver (#9)**:
   - Notice the **Resolver Settlement Panel** appears.
   - Adjust the slider to a **70% / 30% split** (490 credits to Freelancer, 210 credits refund to Buyer).
   - Provide written rationale and click **Confirm Settlement**.
   - _Balances:_ Freelancer = 500 + 490 = **990 credits**, Buyer = 4,800 + 210 = **5,010 credits**, Escrow = 0. Milestone 1 remains untouched.

### Step 4: Timeout Safeguard (Milestone 3)

1. Switch to **Buyer (#4)**. Click **Fund milestone 3: lock 300 credits**.
   - _Balances:_ Buyer = 4,710, Escrow = 300, Freelancer = 990.
2. Switch to **Freelancer (#1)** and submit work.
3. Advance time past the review window using the Dev Time Control in the footer: click **+7 Days**.
4. With **Freelancer (#1)** connected, click **Claim payment: release 300 credits**.
   - _Final Balances:_ Freelancer = **1,290 credits**, Buyer = **4,710 credits**, Escrow = 0.
   - $\text{Total: } 1,290 + 4,710 = 6,000\text{ credits}$ (strict conservation verified).

### Step 5: Dashboard Overview

1. Navigate to `/dashboard`.
2. Inspect the **Financial Metric Row** inside the dark container with vivid lime highlights:
   - **Buyer View**: 4,710 available, 0 in escrow, 990 released to freelancer, 210 refunded.
   - **Freelancer View**: 1,290 available, 0 in escrow, 990 earned & released.
3. Review the agreements table and verified chronological on-chain event history.

---

## Verification & Testing

Run all automated test suites and typechecks across both workspaces:

```bash
# Full test suite (Solidity + Web unit tests)
npm run test

# Solidity test groups T1–T9 (including conservation invariants)
npm run test:chain

# Vitest unit suites (terms, actions matrix, dashboard selectors)
npm run test:web

# TypeScript check across chain and web
npm run typecheck

# Code style and formatting check
npm run lint
```

# Fairwork

A decentralized freelance escrow and milestone-based agreement platform running on a local EVM chain. 

Fairwork eliminates payment uncertainty for both sides: buyers deposit credits into an escrow smart contract, funds release incrementally as milestone deliverables are approved, and a Fairwork Desk resolver arbitrates disputes if needed.

---

## Key Features

- **Milestone-Based Smart Contract Escrow**: Client funds are locked securely on-chain in escrow contracts and released in tranches upon milestone completion.
- **Closed-Ledger Credit Accounting**: Track available balances, locked escrow amounts, released payments, and dispute-refunded credits in real time.
- **Role-Based Workflows**: Instant persona switching directly from the top navigation bar to test multi-party interactions.
- **Freelancer Storefronts**: Dedicated showcase profiles for available talent, including service offerings, pricing, and profile assets.
- **Dispute Resolution & Arbitrator Role**: Built-in resolution mechanisms allowing the Fairwork Desk to review stuck milestones, issue refunds, or release payouts.
- **Dev Time Controls**: Fast-forward blockchain time on local nodes to test milestone deadlines, expirations, and timeout handling.

---

## Demo Personas

The application comes pre-configured with local test accounts:

| Persona | Account | Role / Responsibilities |
| :--- | :--- | :--- |
| **Demo Buyer** | `Account #4` (`0x15d3...`) | Funded with 6,000 demo credits to browse storefronts, hire talent, and fund escrow milestones. |
| **Leon Lobo** | `Account #1` (`0x7099...`) | Freelancer profile. Submits milestone proof of work and claims payouts upon buyer approval. |
| **Samuel Ratna** | Storefront Profile | Freelancer storefront listing available for milestone agreements. |
| **Ian Dsouza** | Storefront Profile | Freelancer storefront listing available for milestone agreements. |
| **Fairwork Desk / Resolver** | `Account #9` (`0xa0Ee...`) | Impartial dispute arbitrator with administrative contract authority to resolve contested escrow deposits. |

---

## Tech Stack

- **Frontend**: Next.js 15, React, Tailwind CSS
- **Smart Contracts & Blockchain**: Solidity, Hardhat, Viem
- **State & Database**: SQLite (off-chain metadata & agreement indexing)
- **Tooling**: TypeScript, Node.js

---

## Quick Start

### Prerequisites
- Node.js (v18+)
- npm

### 1. Install Dependencies
```bash
npm install

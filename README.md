# Fairwork

Milestone-based freelance agreements with blockchain-enforced accounting on a local Hardhat chain.
Demo credits are local accounting entries with no monetary value.

Spec: [`spec.md`](./spec.md). Build order: [`plan.md`](./plan.md). Status: phase P0 (foundations).

## Quickstart

```bash
nvm use            # Node 20
npm install
npm run format     # once, normalizes formatting
npm run lint && npm run typecheck && npm run test
npm run dev        # http://localhost:3000
```

`npm run deploy:local`, `npm run seed` and `npm run demo` need files that arrive in later phases
(`chain/scripts/deploy-local.ts` in P1, `web/scripts/seed.ts` in P3).

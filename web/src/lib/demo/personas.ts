import type { Address } from "viem";

export type DemoPersonaId = "buyer" | "leon" | "freelancer" | "resolver" | "ian" | "samuel";

export interface DemoPersona {
  id: DemoPersonaId;
  label: string;
  name: string;
  accountNumber: number;
  address: Address;
  privateKey: `0x${string}`;
  connectorId: string;
  role: "buyer" | "freelancer" | "resolver";
  roleDescription: string;
  handle?: string;
  isPrimary?: boolean;
}

export const DEMO_PERSONAS: Record<string, DemoPersona> = {
  buyer: {
    id: "buyer",
    label: "Buyer (Account #4 - 6,000 Credits)",
    name: "Demo Buyer",
    accountNumber: 4,
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    privateKey: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
    connectorId: "mock-buyer",
    role: "buyer",
    roleDescription: "Hiring talent & funding escrow",
    isPrimary: true,
  },
  leon: {
    id: "leon",
    label: "Freelancer: Leon Lobo (Account #1)",
    name: "Leon Lobo",
    accountNumber: 1,
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    connectorId: "mock-freelancer",
    role: "freelancer",
    roleDescription: "Motion Graphics & 3D Renders",
    handle: "leoncreative",
    isPrimary: true,
  },
  resolver: {
    id: "resolver",
    label: "Resolver / Fairwork Desk (Account #9)",
    name: "Fairwork Desk",
    accountNumber: 9,
    address: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
    privateKey: "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
    connectorId: "mock-resolver",
    role: "resolver",
    roleDescription: "Arbitrating disputes & splitting escrow",
    isPrimary: true,
  },
  ian: {
    id: "ian",
    label: "Ian Dsouza (Account #2)",
    name: "Ian Dsouza",
    accountNumber: 2,
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    connectorId: "mock-ian",
    role: "freelancer",
    roleDescription: "Web Applications & React Frontends",
    handle: "ian-chii",
    isPrimary: false,
  },
  samuel: {
    id: "samuel",
    label: "Samuel Ratna (Account #3)",
    name: "Samuel Ratna",
    accountNumber: 3,
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
    connectorId: "mock-samuel",
    role: "freelancer",
    roleDescription: "Brand Identity & Vector Design",
    handle: "sammydesign",
    isPrimary: false,
  },
};

// Alias for backwards compatibility
DEMO_PERSONAS.freelancer = DEMO_PERSONAS.leon;

export const PRIMARY_PERSONAS: DemoPersona[] = [
  DEMO_PERSONAS.buyer,
  DEMO_PERSONAS.leon,
  DEMO_PERSONAS.resolver,
];

export const SECONDARY_PERSONAS: DemoPersona[] = [DEMO_PERSONAS.ian, DEMO_PERSONAS.samuel];

export const DEMO_PERSONA_LIST: DemoPersona[] = [
  DEMO_PERSONAS.buyer,
  DEMO_PERSONAS.leon,
  DEMO_PERSONAS.resolver,
  DEMO_PERSONAS.ian,
  DEMO_PERSONAS.samuel,
];

export function getPersonaById(id?: string | null): DemoPersona {
  if (!id) return DEMO_PERSONAS.buyer;
  if (id === "freelancer") return DEMO_PERSONAS.leon;
  return DEMO_PERSONAS[id] ?? DEMO_PERSONAS.buyer;
}

export function getPersonaByAddress(address?: string): DemoPersona | undefined {
  if (!address) return undefined;
  const lower = address.toLowerCase();
  return DEMO_PERSONA_LIST.find((p) => p.address.toLowerCase() === lower);
}

import { describe, expect, it } from "vitest";
import { canonicalize, hashCanonical, hashTerms, matchesHash, termsSchema } from "@/lib/terms";
import type { Terms } from "@/lib/terms";

const BUYER = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
const FREELANCER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const RESOLVER = "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720";

function sampleTerms(): Terms {
  return {
    version: 1,
    chainId: 31337,
    unit: "demo-credits",
    title: "Brand identity for Lumen Coffee",
    description: "Logo and basic identity.",
    buyer: BUYER,
    freelancer: FREELANCER,
    resolver: RESOLVER,
    reviewWindowSeconds: 259200,
    milestones: [
      {
        title: "Logo concepts",
        deliverables: ["3 logo concepts as SVG"],
        acceptanceCriteria: ["Concepts are original", "Delivered as vector files"],
        credits: 500,
        deadline: 1760000000,
        revisionLimit: 2,
      },
      {
        title: "Final files",
        deliverables: ["Chosen logo, all formats"],
        acceptanceCriteria: ["PNG and SVG"],
        credits: 700,
        deadline: 1760600000,
        revisionLimit: 1,
      },
    ],
    nonce: "00112233445566778899aabbccddeeff",
  };
}

/** Same data with every object's keys inserted in reverse order. */
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([k, v]) => [k, reverseKeys(v)]),
    );
  }
  return value;
}

describe("canonicalize", () => {
  it("sorts keys recursively and uses no whitespace", () => {
    expect(canonicalize({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: "x" } })).toBe(
      '{"a":{"c":"x","d":[2,{"y":2,"z":1}]},"b":1}',
    );
  });

  it("keeps array order", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });

  it("rejects values JSON cannot carry", () => {
    expect(() => canonicalize({ credits: 5n })).toThrow(TypeError);
    expect(() => canonicalize({ credits: Infinity })).toThrow(TypeError);
  });
});

describe("hashTerms", () => {
  it("returns a 32-byte keccak hash", () => {
    expect(hashTerms(sampleTerms())).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("is stable under key order", () => {
    expect(hashTerms(reverseKeys(sampleTerms()))).toBe(hashTerms(sampleTerms()));
  });

  it("changes when any top-level field changes", () => {
    const base = hashTerms(sampleTerms());
    const changes: Partial<Terms>[] = [
      { title: "Other title" },
      { description: "Other description" },
      { buyer: FREELANCER },
      { freelancer: BUYER },
      { resolver: BUYER },
      { reviewWindowSeconds: 3600 },
      { nonce: "ffeeddccbbaa99887766554433221100" },
    ];
    for (const change of changes) {
      expect(hashTerms({ ...sampleTerms(), ...change })).not.toBe(base);
    }
  });

  it("changes when any milestone field changes", () => {
    const base = hashTerms(sampleTerms());
    const changes = [
      { title: "Other" },
      { deliverables: ["Something else"] },
      { acceptanceCriteria: ["Something else"] },
      { credits: 501 },
      { deadline: 1760000001 },
      { revisionLimit: 3 },
    ];
    for (const change of changes) {
      const terms = sampleTerms();
      terms.milestones[0] = { ...terms.milestones[0], ...change };
      expect(hashTerms(terms)).not.toBe(base);
    }
  });

  it("changes when a milestone is added or reordered", () => {
    const base = hashTerms(sampleTerms());
    const swapped = sampleTerms();
    swapped.milestones.reverse();
    expect(hashTerms(swapped)).not.toBe(base);
  });
});

describe("termsSchema", () => {
  it("accepts the sample", () => {
    expect(termsSchema.safeParse(sampleTerms()).success).toBe(true);
  });

  it("rejects bad credits", () => {
    for (const credits of [0, -1, 1.5, 6001]) {
      const terms = sampleTerms();
      terms.milestones[0].credits = credits;
      expect(termsSchema.safeParse(terms).success).toBe(false);
    }
  });

  it("rejects 0 or more than 5 milestones, bad addresses, unknown keys and wrong unit", () => {
    const none = { ...sampleTerms(), milestones: [] };
    const tooMany = { ...sampleTerms(), milestones: Array(6).fill(sampleTerms().milestones[0]) };
    expect(termsSchema.safeParse(none).success).toBe(false);
    expect(termsSchema.safeParse(tooMany).success).toBe(false);
    expect(termsSchema.safeParse({ ...sampleTerms(), buyer: "0x123" }).success).toBe(false);
    expect(termsSchema.safeParse({ ...sampleTerms(), extra: true }).success).toBe(false);
    expect(termsSchema.safeParse({ ...sampleTerms(), unit: "eth" }).success).toBe(false);
  });

  it("makes hashTerms throw for invalid terms", () => {
    expect(() => hashTerms({ ...sampleTerms(), version: 2 })).toThrow();
  });
});

describe("matchesHash", () => {
  it("verifies content against a hash, ignoring key order and hex case", () => {
    const hash = hashTerms(sampleTerms());
    expect(matchesHash(reverseKeys(sampleTerms()), hash)).toBe(true);
    expect(matchesHash(sampleTerms(), hash.toUpperCase().replace("0X", "0x"))).toBe(true);
  });

  it("flags tampered content", () => {
    const hash = hashTerms(sampleTerms());
    const tampered = sampleTerms();
    tampered.milestones[0].credits = 5000;
    expect(matchesHash(tampered, hash)).toBe(false);
  });

  it("is a plain keccak of the canonical text for non-terms blobs", () => {
    const blob = { note: "done", references: [{ label: "file", sha256: "ab" }] };
    expect(matchesHash(blob, hashCanonical(blob))).toBe(true);
  });
});

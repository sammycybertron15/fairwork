import { beforeAll, describe, expect, it } from "vitest";
import { getBlob, putBlob } from "@/lib/db/blobs";
import { matchesHash } from "@/lib/terms";

// Open an in-memory database before the lazy singleton is first created.
beforeAll(() => {
  process.env.DB_PATH = ":memory:";
});

describe("blobs", () => {
  it("round-trips and re-verifies", () => {
    const evidence = { references: [{ label: "Draft", url: "https://example.com" }], note: "v1" };
    const hash = putBlob("evidence", evidence);
    const stored = getBlob(hash);
    expect(stored?.kind).toBe("evidence");
    expect(stored?.json).toEqual(evidence);
    expect(matchesHash(stored?.json, hash)).toBe(true);
  });

  it("is idempotent and independent of key order", () => {
    const a = putBlob("reason", { text: "Too late", extra: 1 });
    const b = putBlob("reason", { extra: 1, text: "Too late" });
    expect(a).toBe(b);
  });

  it("returns undefined for an unknown hash", () => {
    expect(getBlob(`0x${"0".repeat(64)}`)).toBeUndefined();
  });

  it("rejects terms that fail the schema", () => {
    expect(() => putBlob("terms", { title: "nope" })).toThrow();
  });
});

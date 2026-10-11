import { beforeAll, describe, expect, it } from "vitest";
import { createTip, getTipsForAgreement, getTipsForFreelancer } from "@/lib/db/tips";

beforeAll(() => {
  process.env.DB_PATH = ":memory:";
});

describe("tips", () => {
  it("creates and retrieves tips for an agreement", () => {
    const tip1 = createTip({
      agreementId: "42",
      buyerAddress: "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
      freelancerAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      amountCredits: 25,
    });

    const tip2 = createTip({
      agreementId: "42",
      buyerAddress: "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
      freelancerAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      amountCredits: 50,
    });

    expect(tip1.amountCredits).toBe(25);
    expect(tip2.amountCredits).toBe(50);

    const tips = getTipsForAgreement("42");
    expect(tips.length).toBeGreaterThanOrEqual(2);
    const sum = tips.reduce((acc, t) => acc + t.amountCredits, 0);
    expect(sum).toBeGreaterThanOrEqual(75);
  });

  it("retrieves tips by freelancer address", () => {
    const tips = getTipsForFreelancer("0x70997970c51812dc3a010c7d01b50e0d17dc79c8");
    expect(tips.length).toBeGreaterThanOrEqual(2);
    expect(
      tips.every((t) => t.freelancerAddress === "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"),
    ).toBe(true);
  });
});

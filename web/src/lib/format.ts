/** "6,000 credits": integers with thousands separators, never a currency symbol (spec 8.3). */
export function formatCredits(credits: bigint | number): string {
  const amount = new Intl.NumberFormat("en-US").format(credits);
  return `${amount} ${BigInt(credits) === 1n ? "credit" : "credits"}`;
}

/** 0x1234…abcd, for addresses and hashes. */
export function shortHex(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

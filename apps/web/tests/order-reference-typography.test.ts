import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const billing = readFileSync(
  new URL("../app/dashboard/billing/page.tsx", import.meta.url),
  "utf8",
);
const vault = readFileSync(
  new URL("../app/dashboard/lists/page.tsx", import.meta.url),
  "utf8",
);
describe("consistent Ledger and Vault Order ID typography", () => {
  const link = billing.match(
    /<Link[\s\S]*?className="([^"]+)"[\s\S]*?\{ref\}/,
  )?.[1];
  const ids = [
    ...vault.matchAll(/<span className="([^"]+)">\s*\{purchase.referenceId\}/g),
  ].map((match) => match[1]);
  it("keeps the order reference as a sans-serif, medium-weight blue link", () => {
    expect(link).toBeDefined();
    for (const token of [
      "font-sans",
      "text-xs",
      "font-medium",
      "text-blue-600",
      "hover:text-blue-700",
    ])
      expect(link!.split(" ")).toContain(token);
    expect(link).not.toMatch(/font-mono|sm:text-sm|tracking-tight/);
    expect(billing).toContain("encodeURIComponent(tx.orderRef)");
  });
  it("matches both mobile and desktop Vault references", () => {
    expect(ids).toHaveLength(2);
    for (const classes of ids) {
      for (const token of [
        "font-sans",
        "text-xs",
        "font-medium",
        "text-blue-600",
        "hover:text-blue-700",
      ])
        expect(classes.split(" ")).toContain(token);
      expect(classes).not.toMatch(
        /font-mono|font-normal|font-semibold|text-sm/,
      );
    }
  });
});

import { describe, expect, it } from "vitest";
import { LatestRequest } from "@/lib/latest-request";
describe("Vault request supersession", () => {
  it("ignores a delayed A response after B resolves, even if transport ignores abort", async () => {
    const gate = new LatestRequest();
    let finishA!: () => void;
    let displayed = "";
    const a = gate.start();
    const responseA = new Promise<void>((r) => {
      finishA = r;
    }).then(() => {
      if (gate.isCurrent(a)) displayed = "A";
    });
    const b = gate.start();
    expect(a.signal.aborted).toBe(true);
    if (gate.isCurrent(b)) displayed = "B";
    finishA();
    await responseA;
    expect(displayed).toBe("B");
  });
  it("aborts on back-navigation/unmount and allows a fresh retry", () => {
    const gate = new LatestRequest(),
      a = gate.start();
    gate.cancel();
    expect(gate.isCurrent(a)).toBe(false);
    const b = gate.start();
    expect(gate.isCurrent(b)).toBe(true);
  });
});

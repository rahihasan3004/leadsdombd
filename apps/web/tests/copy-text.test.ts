import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "@/lib/copy-text";
afterEach(() => vi.unstubAllGlobals());
describe("clipboard failures", () => {
  it("explains unavailable clipboard support", async () => {
    vi.stubGlobal("navigator", {});
    await expect(copyText("test")).rejects.toThrow("Clipboard is unavailable");
  });
  it("explains clipboard permission rejection", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    await expect(copyText("test")).rejects.toThrow("Allow clipboard access");
  });
  it("copies through the browser clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await copyText("hello");
    expect(writeText).toHaveBeenCalledWith("hello");
  });
});

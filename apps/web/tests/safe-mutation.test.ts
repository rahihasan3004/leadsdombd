import { beforeEach, describe, expect, it, vi } from "vitest";
const controls = vi.hoisted(() => ({
  options: null as any,
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  error: vi.fn(),
}));
vi.mock("react", () => ({ useRef: (current: unknown) => ({ current }) }));
vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => {
    controls.options = options;
    return { mutate: controls.mutate, mutateAsync: controls.mutateAsync };
  },
}));
vi.mock("sonner", () => ({ toast: { error: controls.error } }));
import { useSafeMutation } from "@/hooks/use-safe-mutation";
beforeEach(() => vi.clearAllMocks());
describe("immediate mutation lock", () => {
  it("blocks same-tick duplicate submits before React pending state updates", () => {
    const mutation = useSafeMutation({ mutationFn: async () => "ok" });
    mutation.mutate();
    mutation.mutate();
    expect(controls.mutate).toHaveBeenCalledTimes(1);
  });
  it("unlocks after failure or completion so the user can retry", async () => {
    const mutation = useSafeMutation({ mutationFn: async () => "ok" });
    mutation.mutate();
    await controls.options.onSettled(
      undefined,
      new Error("failed"),
      undefined,
      undefined,
      {},
    );
    mutation.mutate();
    expect(controls.mutate).toHaveBeenCalledTimes(2);
  });
  it("shows an actionable error toast when no custom handler exists", () => {
    useSafeMutation({ mutationFn: async () => "ok" });
    controls.options.onError(
      new Error("Permission denied"),
      undefined,
      undefined,
      {},
    );
    expect(controls.error).toHaveBeenCalledWith("Permission denied");
  });
  it("preserves custom error feedback without duplicate toasts", () => {
    const onError = vi.fn();
    useSafeMutation({ mutationFn: async () => "ok", onError });
    controls.options.onError(new Error("bad"), undefined, undefined, {});
    expect(onError).toHaveBeenCalledOnce();
    expect(controls.error).not.toHaveBeenCalled();
  });
  it("releases the lock even if a custom settled callback throws", async () => {
    const mutation = useSafeMutation({
      mutationFn: async () => "ok",
      onSettled: () => {
        throw new Error("callback failed");
      },
    });
    mutation.mutate();
    await expect(
      controls.options.onSettled(null, null, undefined, undefined, {}),
    ).rejects.toThrow("callback failed");
    mutation.mutate();
    expect(controls.mutate).toHaveBeenCalledTimes(2);
  });
});

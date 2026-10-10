import { queryOptions } from "@tanstack/react-query";
/** Never substitute currency walletBalance or a fabricated number for lead credits. */
export function normalizeCreditBalance(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
export function formatCreditBalance(value: unknown): string {
  const credits = normalizeCreditBalance(value);
  return credits === null ? "—" : credits.toLocaleString("en-US");
}
export async function fetchCreditBalance(
  signal?: AbortSignal,
): Promise<number> {
  const response = await fetch("/api/user/profile", {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to refresh credit balance");
  const body: unknown = await response.json();
  const credits = normalizeCreditBalance(
    body && typeof body === "object" && "credits" in body ? body.credits : null,
  );
  if (credits === null) throw new Error("Invalid credit balance response");
  return credits;
}
export function walletCreditQueryOptions(
  userId?: string,
  sessionCredits?: number | null,
) {
  return queryOptions({
    // Account-scoped cache; existing ["wallet"] invalidations refresh this observer immediately.
    queryKey: ["wallet", "credits", userId ?? "signed-out"] as const,
    queryFn: ({ signal }) => fetchCreditBalance(signal),
    enabled: Boolean(userId),
    initialData: normalizeCreditBalance(sessionCredits) ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}

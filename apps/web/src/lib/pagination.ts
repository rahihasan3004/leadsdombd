export type PaginationItem = number | "ellipsis-start" | "ellipsis-end";

/** One-based, bounded sliding window: at most five numbers and two ellipses. */
export function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (!Number.isSafeInteger(totalPages) || totalPages < 1) return [];
  const current = Math.min(totalPages, Math.max(1, Number.isFinite(currentPage) ? Math.floor(currentPage) : 1));
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);

  let firstNeighbor = Math.max(2, current - 1);
  let lastNeighbor = Math.min(totalPages - 1, current + 1);
  if (current <= 2) lastNeighbor = 3;
  if (current >= totalPages - 1) firstNeighbor = totalPages - 2;

  const items: PaginationItem[] = [1];
  if (firstNeighbor > 2) items.push("ellipsis-start");
  for (let page = firstNeighbor; page <= lastNeighbor; page++) items.push(page);
  if (lastNeighbor < totalPages - 1) items.push("ellipsis-end");
  items.push(totalPages);
  return items;
}

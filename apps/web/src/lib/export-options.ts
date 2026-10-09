import { US_STATES } from "@fine-leads/utils";
export type LeadExportFormat = "csv" | "json";
export type LeadExportGrouping = "combined" | "split";
export class LeadExportError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
const valid = new Set<string>(US_STATES.map((state) => state.code));
export function normalizeExportStates(values: string[]): {
  all: boolean;
  states: string[];
} {
  const tokens = values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (!tokens.length) return { all: true, states: [] };
  if (
    tokens.some(
      (value) => !valid.has(value) && !/^(ALL|ALL[ _-]+STATES)$/.test(value),
    )
  )
    throw new LeadExportError("Invalid state code");
  if (tokens.some((value) => /^(ALL|ALL[ _-]+STATES)$/.test(value)))
    return { all: true, states: [] };
  return { all: false, states: [...new Set(tokens)] };
}
export function isMultiStateExport(states: string[]): boolean {
  const normalized = normalizeExportStates(states);
  return normalized.all || normalized.states.length > 1;
}
export function parseExportOptions(params: URLSearchParams) {
  const purchaseId = params.get("purchaseId")?.trim() || undefined;
  if (purchaseId && (purchaseId.length > 200 || !/^[\w-]+$/.test(purchaseId)))
    throw new LeadExportError("Invalid purchase ID");
  const values = [...params.getAll("state"), ...params.getAll("states")];
  if (!purchaseId && !values.some((value) => value.trim()))
    throw new LeadExportError("State or purchaseId is required");
  const territory = normalizeExportStates(values);
  const format = (params.get("format") ?? "csv").toLowerCase();
  const grouping = (params.get("grouping") ?? "combined").toLowerCase();
  if (format !== "csv" && format !== "json")
    throw new LeadExportError("Format must be CSV or JSON");
  if (grouping !== "combined" && grouping !== "split")
    throw new LeadExportError("Grouping must be combined or split");
  return {
    ...territory,
    purchaseId,
    format: format as LeadExportFormat,
    grouping: grouping as LeadExportGrouping,
  };
}
export function exportTerritoryLabel(all: boolean, states: string[]) {
  return all || states.length !== 1
    ? "all"
    : (US_STATES.find((state) => state.code === states[0])?.name ?? states[0]!)
        .toLowerCase()
        .replace(/\s+/g, "-");
}
export function stateExportName(code: string | null) {
  return (
    US_STATES.find(
      (state) => state.code === code?.trim().toUpperCase(),
    )?.name.replace(/\s+/g, "-") ?? "Unknown-State"
  );
}

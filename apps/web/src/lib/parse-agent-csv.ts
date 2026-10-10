export function parseAgentCsv(text: string): Record<string, string>[] {
  const matrix: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n" || c === "\r")) {
      row.push(cell.trim());
      cell = "";
      if (c !== ",") {
        if (c === "\r" && source[i + 1] === "\n") i++;
        if (row.some(Boolean)) matrix.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field");
  row.push(cell.trim());
  if (row.some(Boolean)) matrix.push(row);
  const headers = matrix.shift();
  if (!headers?.includes("fullName"))
    throw new Error("CSV must include a fullName header");
  if (
    new Set(headers).size !== headers.length ||
    headers.some(
      (h) => !h || ["__proto__", "constructor", "prototype"].includes(h),
    )
  )
    throw new Error("CSV headers must be unique valid field names");
  if (matrix.length > 10000)
    throw new Error("Import up to 10,000 rows at a time");
  return matrix.map((cells, index) => {
    if (cells.length !== headers.length || !cells[headers.indexOf("fullName")])
      throw new Error(
        `Invalid CSV row ${index + 2}: check columns and fullName`,
      );
    return Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
  });
}

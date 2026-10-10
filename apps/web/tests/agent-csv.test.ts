import { describe, expect, it } from "vitest";
import { parseAgentCsv } from "@/lib/parse-agent-csv";
describe("agent CSV import", () => {
  it("handles BOM, CRLF, quoted commas, escaped quotes and multiline fields", () => {
    expect(
      parseAgentCsv(
        '\uFEFFfullName,email,city\r\n"Jane, Doe",jane@test.dev,"New\nYork"\r\n"John ""JJ"" Doe",john@test.dev,Austin',
      ),
    ).toEqual([
      { fullName: "Jane, Doe", email: "jane@test.dev", city: "New\nYork" },
      { fullName: 'John "JJ" Doe', email: "john@test.dev", city: "Austin" },
    ]);
  });
  it("rejects unmatched quotes", () => {
    expect(() => parseAgentCsv('fullName,email\n"Jane,j@test.dev')).toThrow(
      "unclosed",
    );
  });
  it("rejects duplicate or dangerous header names", () => {
    expect(() => parseAgentCsv("fullName,fullName\nA,B")).toThrow("headers");
    expect(() => parseAgentCsv("fullName,__proto__\nA,B")).toThrow("headers");
  });
  it("rejects mismatched cells instead of silently dropping rows", () => {
    expect(() => parseAgentCsv("fullName,email\nJane")).toThrow("row 2");
  });
});

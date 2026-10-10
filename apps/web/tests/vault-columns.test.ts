import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import ts from "typescript";

// Render the actual page table JSX, without mocking the whole page's data-fetch hooks.
const source = fs.readFileSync(
  new URL("../app/dashboard/lists/page.tsx", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "page.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let table = "";
const declarations = new Map<string, string>();
function visit(node: ts.Node) {
  if (
    ts.isJsxElement(node) &&
    node.openingElement.tagName.getText(ast) === "table" &&
    node.getText(ast).includes("Verified Email")
  )
    table = node.getText(ast);
  if (
    ts.isVariableDeclaration(node) &&
    ["showEmail", "leadTableColSpan"].includes(node.name.getText(ast))
  )
    declarations.set(node.name.getText(ast), node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
if (!table || declarations.size !== 2)
  throw Error("Vault table/policy declarations not found");
const compiled = ts.transpileModule(
  `
function VaultTable({tier, timezone, agents}) {
  const selectedPurchase = {tier}, showTimezone = timezone;
  const ${declarations.get("showEmail")};
  const ${declarations.get("leadTableColSpan")};
  const paginatedLeads = agents, leadSearch = "";
  const handleOpenAgent = () => undefined;
  const formatTimezoneDisplay = value => value;
  const ExternalLink = () => null;
  return ${table};
}
`,
  {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
    },
  },
).outputText;
const VaultTable = new Function("React", compiled + "\nreturn VaultTable;")(
  React,
) as React.ComponentType<{
  tier: string;
  timezone: boolean;
  agents: unknown[];
}>;
const agent = {
  id: "a1",
  fullName: "Test Agent",
  category: "Real Estate Agent",
  phone: "+13026744220",
  email: "verified@example.com",
  city: "Dover",
  state: "DE",
  rating: 5,
  reviewCount: 290,
  timezone: "America/New_York",
  leadTier: "VERIFIED_EMAIL",
  googleMapsLink: null,
};
const cases = [
  ["PHONE_ONLY", false, 6],
  ["PHONE_ONLY", true, 7],
  ["VERIFIED_EMAIL", false, 7],
  ["VERIFIED_EMAIL", true, 8],
] as const;
describe("Vault order-tier column presentation", () => {
  it.each(cases)(
    "renders matching headers/cells for %s with timezone=%s",
    (tier, timezone, columns) => {
      const html = renderToStaticMarkup(
        React.createElement(VaultTable, { tier, timezone, agents: [agent] }),
      );
      const header = html.split("<thead")[1]!.split("</thead>")[0]!;
      const body = html.split("<tbody")[1]!.split("</tbody>")[0]!;
      expect(header.match(/<th(?:\s|>)/g)).toHaveLength(columns);
      expect(body.match(/<td(?:\s|>)/g)).toHaveLength(columns);
      if (tier === "PHONE_ONLY") {
        expect(html).not.toContain("Verified Email");
        expect(html).not.toContain(agent.email);
        expect(body).not.toMatch(/>\s*-\s*</);
      } else {
        expect(html).toContain("Verified Email");
        expect(html).toContain(agent.email);
      }
      expect(html).toContain("5.0 (290 reviews)");
      expect(html).toContain("w-full");
    },
  );
  it.each(cases)(
    "uses the correct empty-state span for %s with timezone=%s",
    (tier, timezone, columns) => {
      const html = renderToStaticMarkup(
        React.createElement(VaultTable, { tier, timezone, agents: [] }),
      );
      expect(html).toContain(`colSpan="${columns}"`);
      expect(html).toContain("No agents available for this order.");
    },
  );
  it("removes the redundant order-header tier pill and retains responsive table overflow", () => {
    expect(source).not.toContain("ColdCallingTierBadge");
    expect(source).not.toContain("Cold Calling Tier (No Email Included)");
    expect(source).toContain("overflow-x-auto");
    expect(source).toContain("md:hidden");
  });
});

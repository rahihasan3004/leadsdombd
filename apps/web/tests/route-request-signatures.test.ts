import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import ts from "typescript";

const methods = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

describe("Next.js route request signatures", () => {
  it("does not export handlers with optional request arguments", () => {
    const invalid: string[] = [];
    function inspect(
      parameters: ts.NodeArray<ts.ParameterDeclaration>,
      path: string,
      name: string,
    ) {
      const first = parameters[0];
      if (!first) return;
      const includesUndefined =
        first.type &&
        ts.isUnionTypeNode(first.type) &&
        first.type.types.some(
          (type) => type.kind === ts.SyntaxKind.UndefinedKeyword,
        );
      if (first.questionToken || includesUndefined)
        invalid.push(`${path}: ${name}`);
    }
    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name === "route.ts") {
          const file = ts.createSourceFile(
            path,
            readFileSync(path, "utf8"),
            ts.ScriptTarget.Latest,
            true,
          );
          for (const node of file.statements) {
            if (
              ts.isFunctionDeclaration(node) &&
              node.name &&
              methods.has(node.name.text)
            )
              inspect(node.parameters, path, node.name.text);
            if (ts.isVariableStatement(node)) {
              for (const declaration of node.declarationList.declarations) {
                const name = declaration.name.getText(file);
                const fn = declaration.initializer;
                if (
                  methods.has(name) &&
                  fn &&
                  (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))
                )
                  inspect(fn.parameters, path, name);
              }
            }
          }
        }
      }
    }
    walk(resolve("app/api"));
    expect(invalid).toEqual([]);
  });
});

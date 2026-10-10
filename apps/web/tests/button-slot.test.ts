import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "../../../packages/ui/src/components/button";

const link = () => createElement("a", { href: "/dashboard" }, "Dashboard");
describe("Button Slot prerendering", () => {
  it("renders a single link child without an extra placeholder sibling", () => {
    const html = renderToStaticMarkup(
      createElement(Button, { asChild: true }, link()),
    );
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain("Dashboard</a>");
    expect(html).not.toContain("<button");
  });
  it("keeps icons and text inside the slotted link", () => {
    const child = createElement(
      "a",
      { href: "/" },
      createElement("svg", { "aria-hidden": true }),
      "Go Home",
    );
    const html = renderToStaticMarkup(
      createElement(Button, { asChild: true }, child),
    );
    expect(html).toContain("</svg>Go Home</a>");
  });
  it("does not inject a sibling spinner into a busy slotted link", () => {
    const html = renderToStaticMarkup(
      createElement(Button, { asChild: true, "aria-busy": true }, link()),
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("<svg");
  });
  it("still adds a spinner and locks ordinary busy buttons", () => {
    const html = renderToStaticMarkup(
      createElement(Button, { "aria-busy": true }, "Saving..."),
    );
    expect(html).toContain("disabled");
    expect(html).toContain("animate-spin");
    expect(html).toContain("Saving...");
  });
  it("does not duplicate an existing busy icon", () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { "aria-busy": true },
        createElement("svg", { className: "animate-spin" }),
        "Saving...",
      ),
    );
    expect(html.match(/<svg/g)).toHaveLength(1);
  });
});

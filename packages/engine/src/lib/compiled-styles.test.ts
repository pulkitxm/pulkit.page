import { expect, test } from "bun:test";
import { CompiledStyles, stylesheetClasses } from "./compiled-styles.ts";
import { compileMarkup } from "./style-markup.ts";
import { compileScript, scriptClasses } from "./style-scripts.ts";

test("combinations share one class while mutable classes remain independent", () => {
  const styles = new CompiledStyles(["flex", "gap-4", "hidden"], new Set(["s0"]));
  styles.mutable.add("hidden");
  const compiled = styles.classes("flex gap-4 hidden");
  expect(compiled.split(" ")).toHaveLength(2);
  expect(styles.classes("gap-4 flex hidden")).toBe(compiled);
  expect(compiled).not.toContain("s0");
  expect(styles.classes("flex gap-4")).toBe(compiled.split(" ")[0] ?? "");
});

test("selector rewriting keeps rule order, specificity, nesting and conditions", () => {
  const css =
    ".flex{display:flex}.grid{display:grid}.group:hover .hover\\:red{color:red}@media(min-width:640px){.sm\\:flex{display:flex}}:where(.group) .child::before{content:'x'}";
  const styles = new CompiledStyles(stylesheetClasses(css, "test.css"), new Set());
  const combination = styles.classes("flex grid hover:red sm:flex child");
  const result = styles.css(css, "test.css");
  expect(result).toContain(`:is(.${styles.names.get("flex")},.${combination}){display:flex}`);
  expect(result.indexOf("display:flex")).toBeLessThan(result.indexOf("display:grid"));
  expect(result).toContain("@media");
  expect(result).toContain(":hover");
  expect(result).toContain(":where(");
  expect(result).toContain(":before");
  expect(result).not.toContain(".flex");
});

test("markup rewriting covers templates, SVG and lazy frames without touching prose or code", () => {
  const styles = new CompiledStyles(["flex", "gap-4", "[&>p]:mb-2"], new Set());
  const untouched = [
    `<script type="application/json">${JSON.stringify({ html: '<i class="flex">' })}</script>`,
    "<style>.other{color:red}</style>",
    '<!-- <i class="flex"> -->',
    "<code>&lt;i class=&quot;flex&quot;&gt;</code>",
  ].join("");
  const result = compileMarkup(
    `<template><svg class="flex gap-4"></svg></template><div data-frame-class="flex [&amp;>p]:mb-2">${untouched}</div>`,
    styles,
  );
  expect(result).toContain(untouched);
  expect(result).toContain('<svg class="s3">');
  expect(result).toContain(`data-frame-class="${styles.classes("flex [&>p]:mb-2")}"`);
});

test("scripts preserve attribute names, display values and text while rewriting actual classes", () => {
  const styles = new CompiledStyles(["flex", "gap-4", "hidden"], new Set());
  const source =
    'el.className="flex gap-4";el.classList.toggle("hidden",true);el.hidden=true;el.style.display="flex";el.setAttribute("hidden","");const text="flex";';
  for (const name of scriptClasses(source, "test.js")) {
    styles.mutable.add(name);
  }
  const result = compileScript(source, "test.js", styles);
  expect(result).toContain(`el.classList.toggle("${styles.names.get("hidden")}",true)`);
  expect(result).toContain('el.style.display="flex"');
  expect(result).toContain('el.setAttribute("hidden","")');
  expect(result).toContain('const text="flex"');
  expect(result).not.toContain('className="flex');
});

test("template expressions and class fragments remain valid JavaScript", () => {
  const styles = new CompiledStyles(["flex", "gap-4", "hidden"], new Set());
  const expression = `\${active ? "gap-4" : "hidden"}`;
  const label = ["$", "{label}"].join("");
  const source = `el.innerHTML=\`<div class="flex ${expression}">${label}</div>\`;`;
  const result = compileScript(source, "test.js", styles);
  expect(result).toContain("${active ?");
  expect(result).toContain(label);
  expect(result).not.toContain('class="flex');
  expect(() => compileScript(result, "test.js", styles)).not.toThrow();
});

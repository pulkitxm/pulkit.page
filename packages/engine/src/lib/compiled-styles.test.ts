import { expect, test } from "bun:test";
import { compiledClassMerge } from "@pulkit/demos/assets";
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
    'el.className="flex gap-4";el.classList.toggle("hidden",true);el?.classList.toggle("hidden",true);el.hidden=true;el.style.display="flex";el.setAttribute("hidden","");const text="flex";';
  for (const name of scriptClasses(source, "test.js")) {
    styles.mutable.add(name);
  }
  const result = compileScript(source, "test.js", styles);
  expect(result).toContain(`el.classList.toggle("${styles.names.get("hidden")}",true)`);
  expect(result).toContain(`el?.classList.toggle("${styles.names.get("hidden")}",true)`);
  expect(result).toContain('el.style.display="flex"');
  expect(result).toContain('el.setAttribute("hidden","")');
  expect(result).toContain('const text="flex"');
  expect(result).not.toContain('className="flex');
});

test("CSS keywords and class-looking labels are preserved outside styling contexts", () => {
  const styles = new CompiledStyles(["ease-out", "inline-flex", "gap-4"], new Set());
  const source =
    'const options={easing:"ease-out",label:"gap-4"};animate("ease-out");el.style.display="inline-flex";el.className="ease-out";el.textContent="gap-4";';
  const result = compileScript(source, "test.js", styles);
  expect(result).toContain('easing:"ease-out",label:"gap-4"');
  expect(result).toContain('animate("ease-out")');
  expect(result).toContain('style.display="inline-flex"');
  expect(result).toContain('textContent="gap-4"');
  expect(result).toContain(`className="${styles.names.get("ease-out")}"`);
});

test("demo source payloads compile injected HTML while preserving the displayed source", () => {
  const styles = new CompiledStyles(["text-syn-k", "italic"], new Set());
  const code = '<span class="text-syn-k italic">const</span>';
  const sources = [{ filename: "example.ts", code, html: code }];
  const markup = `<demo-showcase><script type="application/json">${JSON.stringify(sources).replaceAll("<", "\\u003c")}</script></demo-showcase>`;
  const result = compileMarkup(markup, styles);
  const json = /<script type="application\/json">([\s\S]*?)<\/script>/.exec(result)?.[1] ?? "";
  const compiled = JSON.parse(json);
  expect(compiled[0].code).toBe(code);
  expect(compiled[0].filename).toBe("example.ts");
  expect(compiled[0].html).not.toContain("text-syn-k");
  expect(compiled[0].html).toBe(
    `<span class="${styles.classes("text-syn-k italic")}">const</span>`,
  );
  expect(result).not.toContain("<span");
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
  expect(result).not.toContain('"hidden"');
  expect(result).not.toContain('"gap-4"');
  expect(() => compileScript(result, "test.js", styles)).not.toThrow();
});

test("registered properties, inline styles and script references use the same compiled name", () => {
  const styles = new CompiledStyles(["flex"], new Set(), ["--tw-x", "--v0"]);
  const result = styles.css(
    '@property --tw-x{syntax:"<length>";inherits:false;initial-value:0px}.flex{--tw-x:1px;width:var(--tw-x)}',
    "test.css",
  );
  expect(result).toContain("@property --v1");
  expect(result).toContain("width:var(--v1)");
  expect(result).not.toContain("--tw-");
  expect(compileMarkup('<div style="--tw-x: 2px"></div>', styles)).toContain('style="--v1: 2px"');
  expect(compileScript('el.style.setProperty("--tw-x", "2px")', "test.js", styles)).toContain(
    'setProperty("--v1"',
  );
});

test("selectors used by scripts keep independently addressable classes", () => {
  const styles = new CompiledStyles(["flex", "gap-4"], new Set());
  const source = 'document.querySelector(".flex").classList.add("gap-4")';
  for (const name of scriptClasses(source, "test.js")) {
    styles.mutable.add(name);
  }
  expect(styles.classes("flex gap-4").split(" ")).toHaveLength(2);
  expect(compileScript(source, "test.js", styles)).toContain(
    `querySelector(".${styles.names.get("flex")}")`,
  );
});

test("class substring selectors still recognize sizes inside combined classes", () => {
  const selector = [".button svg:not(", '[class*="size-"]', ")"].join("");
  const css = `${selector}{width:1rem}.size-6{width:1.5rem}.flex{display:flex}`;
  const styles = new CompiledStyles(stylesheetClasses(css, "test.css"), new Set());
  const combined = styles.classes("size-6 flex");
  const result = styles.css(css, "test.css");
  expect(result).toContain(`:not(:is(.${styles.names.get("size-6")},.${combined}))`);
  expect(result).not.toContain("size-");
});

test("compiled conflict tables preserve directional overrides and modifiers without shipping utility names", async () => {
  const cases = [
    ["p-4 px-2", "p-4 px-2"],
    ["p-4 px-2 p-2", "p-2"],
    ["leading-8 text-sm/6", "text-sm/6"],
    ["text-sm/6 leading-8", "text-sm/6 leading-8"],
    ["hover:bg-red-500 hover:bg-blue-500", "hover:bg-blue-500"],
    ["hover:bg-red-500 focus:bg-blue-500", "hover:bg-red-500 focus:bg-blue-500"],
    ["p-4! p-2", "p-4! p-2"],
    ["p-4! p-2!", "p-2!"],
    ["group group", "group group"],
  ] as const;
  const names = cases.flatMap(([input]) => input.split(" "));
  const styles = new CompiledStyles(names, new Set());
  const combined = styles.classes("p-4 px-2");
  const source = compiledClassMerge(styles.names, styles.combinations);
  expect(source).not.toContain("p-4");
  expect(source).not.toContain("hover:bg");
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
  for (const [input, expected] of cases) {
    expect(module.twMerge(styles.classes(input, false))).toBe(styles.classes(expected, false));
  }
  expect(module.twMerge(`${combined} ${styles.classes("p-2", false)}`)).toBe(
    styles.classes("p-2", false),
  );
});

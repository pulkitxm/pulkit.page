import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mangleClasses, renameHtmlClasses, shortName } from "./mangle-classes.mjs";

test("short names are unique identifiers that never start with a digit", () => {
  const names = Array.from({ length: 5000 }, (_, index) => shortName(index));
  expect(new Set(names).size).toBe(names.length);
  expect(names.every((name) => /^[a-z][a-z0-9]*$/.test(name))).toBe(true);
  expect(names.slice(0, 3)).toEqual(["a", "b", "c"]);
});

test("html class attributes are renamed outside scripts, styles and comments", () => {
  const names = new Map([
    ["flex", "a"],
    ["[&>p]:mb-2", "b"],
  ]);
  const script = `<script type="application/json">${JSON.stringify({ html: '<i class="flex">' })}</script>`;
  const style = "<style>.flex{}</style>";
  const comment = '<!-- <i class="flex"> -->';
  const code = "<code>&lt;i class=&quot;flex&quot;&gt;</code>";
  const untouched = `${script}${style}${comment}${code}`;
  expect(
    renameHtmlClasses(`<div class="flex [&amp;>p]:mb-2 unknown">${untouched}</div>`, names),
  ).toBe(`<div class="a b unknown">${untouched}</div>`);
});

test("stylesheet classes are renamed unless scripts or other stylesheets depend on them", () => {
  const directory = mkdtempSync(join(tmpdir(), "page-mangle-test-"));
  try {
    mkdirSync(join(directory, "assets/demos"), { recursive: true });
    mkdirSync(join(directory, "post"));
    writeFileSync(
      join(directory, "styles.css"),
      ".flex{display:flex}.hidden{display:none}.katex{color:red}:is(.\\*\\*\\:box-border *){box-sizing:border-box}.a{color:blue}",
    );
    writeFileSync(join(directory, "assets/katex.css"), ".katex{font-size:1em}");
    writeFileSync(join(directory, "assets/demos/demos.css"), ".flex{display:flex}");
    writeFileSync(join(directory, "assets/demos/chunk.js"), 'el.className = "flex";');
    writeFileSync(join(directory, "theme.js"), 'el.classList.toggle("hidden");');
    writeFileSync(
      join(directory, "post/index.html"),
      '<p class="flex hidden katex **:box-border a">x</p>',
    );
    expect(mangleClasses(directory, "styles.css")).toEqual({ renamed: 3, kept: 2 });
    expect(readFileSync(join(directory, "styles.css"), "utf8")).toBe(
      ".b{display:flex}.hidden{display:none}.katex{color:red}:is(.c *){box-sizing:border-box}.d{color:#00f}",
    );
    expect(readFileSync(join(directory, "post/index.html"), "utf8")).toBe(
      '<p class="b hidden katex c d">x</p>',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

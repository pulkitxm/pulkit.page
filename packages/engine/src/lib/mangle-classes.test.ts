import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  removeTemporaryDirectories,
  temporaryDirectory,
  writeFiles,
} from "../../test/lib/harness.ts";
import { mangleClasses, renameHtmlClasses, shortName } from "./mangle-classes.ts";

afterEach(removeTemporaryDirectories);

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
  const directory = temporaryDirectory("page-mangle-test-");
  writeFiles(directory, {
    "styles.css":
      ".flex{display:flex}.hidden{display:none}.katex{color:red}:is(.\\*\\*\\:box-border *){box-sizing:border-box}.a{color:blue}",
    "assets/katex.css": ".katex{font-size:1em}",
    "assets/demos/demos.css": ".flex{display:flex}",
    "assets/demos/chunk.js": 'el.className = "flex";',
    "theme.js": 'el.classList.toggle("hidden");',
    "post/index.html": '<p class="flex hidden katex **:box-border a">x</p>',
  });
  expect(mangleClasses(directory, "styles.css")).toEqual({ renamed: 3, kept: 2 });
  expect(readFileSync(join(directory, "styles.css"), "utf8")).toBe(
    ".b{display:flex}.hidden{display:none}.katex{color:red}:is(.c *){box-sizing:border-box}.d{color:#00f}",
  );
  expect(readFileSync(join(directory, "post/index.html"), "utf8")).toBe(
    '<p class="b hidden katex c d">x</p>',
  );
});

test("data class attributes that scripts copy onto elements are renamed like class", () => {
  const names = new Map([
    ["absolute", "a"],
    ["size-full", "b"],
  ]);
  expect(
    renameHtmlClasses(
      '<div class="absolute" data-frame-class="absolute size-full border-0" data-title="absolute" data-class="absolute"></div>',
      names,
    ),
  ).toBe(
    '<div class="a" data-frame-class="a b border-0" data-title="absolute" data-class="absolute"></div>',
  );
});

test("inline executable scripts and inline styles keep the classes they depend on", () => {
  const directory = temporaryDirectory("page-mangle-test-");
  writeFiles(directory, {
    "styles.css":
      ".flex{display:flex}.hidden{display:none}.open{color:red}.grid{display:grid}.block{display:block}.inline{display:inline}",
    "index.html": [
      "<style>.open .flex{gap:1px}</style>",
      '<script>el.classList.add("hidden")</script>',
      '<script type="module">el.className = "grid"</script>',
      '<script type="application/json">{"className":"block"}</script>',
      '<p class="flex hidden open grid block inline">x</p>',
    ].join(""),
  });
  expect(mangleClasses(directory, "styles.css")).toEqual({ renamed: 2, kept: 4 });
  expect(readFileSync(join(directory, "index.html"), "utf8")).toContain(
    '<p class="flex hidden open grid a b">x</p>',
  );
});

test("short names skip tokens already used by data class attributes", () => {
  const directory = temporaryDirectory("page-mangle-test-");
  writeFiles(directory, {
    "styles.css": ".absolute{position:absolute}",
    "index.html": '<div data-frame-class="a absolute"></div>',
  });
  expect(mangleClasses(directory, "styles.css")).toEqual({ renamed: 1, kept: 0 });
  expect(readFileSync(join(directory, "styles.css"), "utf8")).toBe(".b{position:absolute}");
  expect(readFileSync(join(directory, "index.html"), "utf8")).toBe(
    '<div data-frame-class="a b"></div>',
  );
});

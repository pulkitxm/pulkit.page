import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { scanText } from "@pulkit/checks/comments";
import { highlightFence } from "@pulkit/code/highlight";
import { renderPage } from "./render-page.mjs";

const repository = resolve(import.meta.dir, "../../..");
const base = readFileSync(join(repository, "packages/theme/base.css"), "utf8");
const appStyles = readdirSync(join(repository, "apps")).map((app) =>
  readFileSync(join(repository, "apps", app, "styles.css"), "utf8"),
);

function codeInner(html) {
  const match = html.match(
    /<pre[^>]*>\s*<code class="language-[^"]+">([\s\S]*?)<\/code>\s*<\/pre>/,
  );
  expect(match).toBeTruthy();
  return match[1];
}

function visibleText(html) {
  return codeInner(html)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^<span class="block [^"]+">|<\/span>$/g, "").replace("<br />", ""))
    .join("\n")
    .replace(/<span class="[^"]+">/g, "")
    .replace(/<\/span>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n$/, "");
}

describe("build-time syntax highlighting", () => {
  test("TypeScript fences become classed spans without inline colors", async () => {
    const html = await renderPage(
      [
        "---",
        "title: Highlight",
        "---",
        "",
        "```typescript",
        "const value = 1; // keep",
        "```",
        "",
      ].join("\n"),
    );
    const inner = codeInner(html);
    expect(inner).toContain('<span class="text-syn-k">const</span>');
    expect(inner).toContain('<span class="text-syn-n">1</span>');
    expect(inner).toContain('<span class="text-syn-c italic">');
    expect(inner).toContain("// keep");
    expect(inner).not.toContain("style=");
    expect(html).not.toContain("shiki");
    expect(html).not.toContain("highlight.js");
    expect(html).not.toContain("prism");
    expect(html).toContain('<script src="/theme.js"></script>');
    expect(html).not.toMatch(/src="[^"]*(?:shiki|prism|highlight)/);
    expect(visibleText(html)).toBe("const value = 1; // keep");
  });

  test("plaintext, math, mermaid, and unknown fences stay escaped plain text", async () => {
    for (const [language, source] of [
      ["plaintext", "const x = 1;"],
      ["text", "SELECT 1"],
      ["math", "E = mc^2"],
      ["mermaid", "graph TD; A-->B;"],
      ["not-a-language", "function surprise() {}"],
    ]) {
      const html = await highlightFence(language, source);
      expect(html).toBe(source.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
      expect(html).not.toContain("<span");
    }
  });

  test("inline backtick code stays unhighlighted", async () => {
    const html = await renderPage("---\ntitle: Inline\n---\n\nUse `const` in prose.\n");
    expect(html).toMatch(/<code class="[^"]*"\s*>const<\/code/);
    expect(html).not.toContain('<span class="text-syn-k">const</span>');
  });

  test("every app theme defines token colors for light and dark", () => {
    expect(base).toContain(':root:not([data-theme="light"])');
    expect(base).toContain('[data-theme="dark"] *');
    expect(base).toContain("@media (prefers-color-scheme: dark)");
    for (const styles of appStyles) {
      for (const name of ["k", "s", "c", "n", "f", "t", "p", "o", "u", "g"]) {
        expect(styles).toContain(`--color-syn-${name}:`);
      }
      expect(styles).toMatch(/@variant dark \{[\s\S]*--color-syn-k:/);
    }
  });

  test("comment scanner still sees comments through classed spans", async () => {
    const html =
      '<pre><code class="language-js"><span class="k">const</span> x=1; <span class="c">// comment</span></code></pre>';
    expect(await scanText("file.html", html)).toHaveLength(1);
    expect(await scanText("dist/exp/example/index.html", html)).toHaveLength(1);
  });
});

test("concurrent fences load each grammar once and highlight consistently", async () => {
  const languages = ["typescript", "tsx", "markdown", "html", "vue", "typescript", "tsx"];
  const results = await Promise.all(
    languages.map((language) => highlightFence(language, "const value: number = 1;")),
  );
  for (const html of results) {
    expect(html).toContain("value");
  }
  expect(results[0]).toBe(results[5]);
});

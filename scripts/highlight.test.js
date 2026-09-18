import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scanText } from "./check-comments.mjs";
import { highlightFence } from "./highlight.mjs";
import { renderPage } from "./render-page.mjs";

const styles = readFileSync(resolve(import.meta.dir, "../styles.css"), "utf8");

function codeInner(html) {
  const match = html.match(/<pre\s*>\s*<code class="language-[^"]+">([\s\S]*?)<\/code>\s*<\/pre>/);
  expect(match).toBeTruthy();
  return match[1];
}

function visibleText(html) {
  return codeInner(html)
    .replace(/<span class="[a-z]+">/g, "")
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
    expect(inner).toContain('<span class="k">const</span>');
    expect(inner).toContain('<span class="n">1</span>');
    expect(inner).toContain('<span class="c">');
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
    expect(html).toContain("<code>const</code>");
    expect(html).not.toContain('<span class="k">const</span>');
  });

  test("theme CSS defines token colors for light and dark", () => {
    for (const name of ["k", "s", "c", "n", "f", "t", "p", "o", "u", "g"]) {
      expect(styles).toContain(`--syn-${name}:`);
      expect(styles).toContain(`pre code .${name}`);
    }
    expect(styles).toContain(':root[data-theme="light"]');
    expect(styles).toContain(':root[data-theme="dark"]');
    expect(styles).toContain("@media (prefers-color-scheme: dark)");
    expect(styles).toMatch(/:root\[data-theme="light"\][\s\S]*--syn-k:/);
    expect(styles).toMatch(/:root\[data-theme="dark"\][\s\S]*--syn-k:/);
    expect(styles).toMatch(/prefers-color-scheme: dark\)[\s\S]*--syn-k:/);
  });

  test("comment scanner still sees comments through classed spans", async () => {
    const html =
      '<pre><code class="language-js"><span class="k">const</span> x=1; <span class="c">// comment</span></code></pre>';
    expect(await scanText("file.html", html)).toHaveLength(1);
    expect(await scanText("pages/experience/example/index.html", html)).toHaveLength(1);
  });
});

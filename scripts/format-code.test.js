import { describe, expect, test } from "bun:test";
import { checkContent } from "./check-content.mjs";
import { formatFence } from "./format-code.mjs";
import { highlightFence } from "./highlight.mjs";
import { renderPage } from "./render-page.mjs";

function page(body) {
  return ["---", "title: Format", "---", "", body].join("\n");
}

function codeInner(html) {
  const match = html.match(
    /<pre[^>]*>\s*<code class="language-[^"]+">([\s\S]*?)<\/code>\s*<\/pre>/,
  );
  expect(match).toBeTruthy();
  return match[1];
}

function visibleText(html) {
  return codeInner(html)
    .replace(/<span class="[^"]+">/g, "")
    .replace(/<\/span>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n$/, "");
}

describe("generate-time fence formatting", () => {
  test("typescript hygiene collapses blanks, strips trailing space, and still highlights", async () => {
    const html = await renderPage(
      page(
        ["```typescript", "    const value = 1;  ", "", "", "    const next = 2;", "```", ""].join(
          "\n",
        ),
      ),
    );
    expect(visibleText(html)).toBe("const value = 1;\n\nconst next = 2;");
    const inner = codeInner(html);
    expect(inner).toContain('<span class="text-syn-k">const</span>');
    expect(inner).toContain('<span class="text-syn-n">1</span>');
    expect(inner).toContain('<span class="text-syn-n">2</span>');
  });

  test("valid messy javascript is Biome-formatted in rendered HTML", async () => {
    const html = await renderPage(
      page(
        [
          "```javascript",
          "const value = 'ready';",
          "",
          "",
          "  console.log(value);",
          "```",
          "",
        ].join("\n"),
      ),
    );
    expect(visibleText(html)).toBe('const value = "ready";\n\nconsole.log(value);');
    expect(codeInner(html)).toContain('<span class="text-syn-s">&quot;ready&quot;</span>');
  });

  test("invalid javascript still renders after hygiene", async () => {
    const html = await renderPage(
      page(["```js", "   const value =   ", "", "", "```", ""].join("\n")),
    );
    expect(visibleText(html)).toBe("const value =");
    expect(html).toContain('<code class="language-js ');
  });

  test("text fences keep inner blank lines and indent", async () => {
    const diagram = ["    A --- B", "", "", "    C --- D"];
    const html = await renderPage(page(["```text", ...diagram, "```", ""].join("\n")));
    expect(visibleText(html)).toBe(diagram.join("\n"));
    expect(formatFence("text", `${diagram.join("\n")}   \n\n`)).toBe(diagram.join("\n"));
  });

  test("markdown formatting still preserves authored fence bytes", () => {
    const code = "// an example\nconst value = 'unchanged';\n\tconsole.log(value);";
    const source = [
      "---",
      "title: Example",
      "description: Example page.",
      "---",
      "",
      "~~~js",
      code,
      "~~~",
      "",
    ].join("\n");
    const result = checkContent("content/about.md", source);
    expect(result.errors).toEqual([]);
    expect(result.formatted).toContain(code);
    expect(formatFence("js", code)).not.toBe(code);
  });

  test("highlighter reconstructs the formatted fence text", async () => {
    const formatted = formatFence(
      "typescript",
      "    const value = 'ready';  \n\n\n\tconsole.log(value);\n",
    );
    expect(formatted).toBe('const value = "ready";\n\nconsole.log(value);');
    const html = await highlightFence("typescript", formatted);
    expect(
      html
        .replace(/<span class="[^"]+">/g, "")
        .replace(/<\/span>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'"),
    ).toBe(formatted);
  });
});

import { describe, expect, test } from "bun:test";
import { commentRanges, scanText } from "./check-comments.mjs";
import { emDashLines } from "./check-em-dashes.mjs";

describe("repository policies", () => {
  test("detects em dashes in prose and code without banning ordinary hyphens", () => {
    const dash = String.fromCodePoint(0x2014);
    expect(emDashLines(["one-two", `three${dash}four`, `${dash}five`].join("\n"))).toEqual([2, 3]);
    expect(emDashLines("one-two")).toEqual([]);
  });

  test.each([
    ["file.js", 'const url="https://example.com"; const regex=/https?:\\/\\//; // comment', 1],
    ["file.ts", ["// biome-ignore lint: no exception", "const x=1;"].join("\n"), 1],
    ["file.ts", ["/*! license */", "/** docs */", "const x=1;"].join("\n"), 2],
    ["file.ts", "const t=`literal // string $\u007b1 /* nested */}`;", 1],
    ["file.tsx", '<div>{/* JSX comment */}<span title="// text" /></div>', 1],
    [
      "file.py",
      ['"""Module documentation"""', 'url="https://example.com/#tag"', "# comment"].join("\n"),
      2,
    ],
    ["file.py", ["# comment", '"""Module doc"""'].join("\n"), 2],
    ["file.py", 'f"{side_effect()}"', 0],
    ["file.css", "a{background:url(https://example.com/x.png)}", 0],
    ["file.py", ['value="""# string contents', 'not a comment"""', "# comment"].join("\n"), 1],
    [
      "file.sh",
      [
        "#!/bin/sh",
        ['printf "%s" "$', '{#value}"'].join(""),
        "cat <<'EOF'",
        "# heredoc data",
        "EOF",
        "# comment",
      ].join("\n"),
      1,
    ],
    ["file.yml", ["text: |", "  # scalar contents", 'url: "#quoted" # comment'].join("\n"), 1],
    ["file.jsonc", '{"url":"https://example.com",/* nested */"ok":true}// trailing', 2],
    ["bun.lock", '{/* comment */"lockfileVersion":1}', 1],
    ["file.css", 'a{content:"/* literal */"} /* comment */', 1],
    ["file.sql", "select '--text', $$/* string */$$; /* outer /* nested */ end */ -- comment", 2],
    ["file.lua", ["--[=[ multiline", "comment ]=]", 'local x="-- text" -- comment'].join("\n"), 2],
    [
      "file.swift",
      ['let url = "https://example.com"', "/* outer /* inner */ end */"].join("\n"),
      1,
    ],
    [
      "file.html",
      '<!-- html --><script>const x="// string"; /* JS */</script><style>/* CSS */</style>',
      3,
    ],
    ["file.svg", "<svg><!-- SVG comment --></svg>", 1],
    ["file.html", '<script type="application/ld+json">{"url":"https://example.com"}</script>', 0],
    [
      "file.md",
      [
        "# Heading",
        "",
        "A URL: https://example.com.",
        "",
        "```js",
        'const url="https://example.com"; // remove',
        "```",
        "",
      ].join("\n"),
      1,
    ],
    ["file.md", ["---", "title: Example # comment", "---", "", "<!-- comment -->"].join("\n"), 2],
    ["file.md", ["```html", "<script>/* embedded */</script>", "```", ""].join("\n"), 1],
    ["file.md", ["```mermaid", "flowchart LR", "A --> B", "%% comment", "```", ""].join("\n"), 1],
    ["file.html", '<pre><code class="language-js">const x=1; // comment</code></pre>', 1],
    [
      "file.html",
      '<pre><code class="language-js"><span class="k">const</span> x=1; <span class="c">// comment</span></code></pre>',
      1,
    ],
  ])("classifies comments in %s", async (file, source, count) => {
    expect(await scanText(file, source)).toHaveLength(count);
  });

  test("article examples retain comments while source comments remain forbidden", async () => {
    const article = [
      "---",
      "title: Example # forbidden",
      "---",
      "",
      "```js",
      "// example",
      "```",
      "",
      "<!-- forbidden -->",
    ].join("\n");
    expect(await scanText("content/blogs/example.md", article)).toHaveLength(2);
    const page =
      '<pre><code class="language-js">// example</code></pre><script>/* forbidden */</script><!-- forbidden -->';
    expect(await scanText("pages/blogs/example/index.html", page)).toHaveLength(2);
    expect(await scanText("scripts/example.js", "// forbidden")).toHaveLength(1);
  });

  test("unsupported source types and fence languages fail closed", async () => {
    await expect(scanText("file.unknown", "anything")).rejects.toThrow("Unsupported");
    await expect(
      scanText("file.md", ["```unknown", "anything", "```", ""].join("\n")),
    ).rejects.toThrow("Unsupported");
  });

  test("comment offsets preserve strings and surrounding source", async () => {
    const source = 'const emoji="🙂"; /* remove */ const text="/* keep */";';
    const ranges = await commentRanges("typescript", source);
    expect(ranges.map((range) => source.slice(range.start, range.end))).toEqual(["/* remove */"]);
  });
});

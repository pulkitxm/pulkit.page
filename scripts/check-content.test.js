import { describe, expect, test } from "bun:test";
import { checkContent } from "./check-content.mjs";

const page = (metadata = "", body = "Hello.\n") =>
  `---\ntitle: Example\ndescription: Example page.\n${metadata}---\n\n${body}`;

describe("strict content conventions", () => {
  test("accepts simple pages and deterministic formatting", () => {
    const result = checkContent("content/about.md", page());
    expect(result.errors).toEqual([]);
    expect(checkContent("content/about.md", result.formatted).formatted).toBe(result.formatted);
  });

  test.each([
    ["content/Bad_Name.md", page(), "kebab-case"],
    ["content/about.mdx", page(), "kebab-case"],
    ["content/index.md", page(), "home.md"],
    ["content/about.md", page("draft: true\n"), "unknown metadata"],
    ["content/about.md", page("date: 2026-02-30\n"), "real YYYY-MM-DD"],
    ["content/about.md", page("date: false\n"), "nonempty string"],
    ["content/about.md", page("tags: [web, web]\n"), "unique"],
    ["content/about.md", page("layout: nonexistent\n"), "existing layout"],
    ["content/about.md", page("", "# Another title\n"), "H1 comes from title"],
    ["content/about.md", page("", "## Same\n\n## Same\n"), "duplicate heading"],
    ["content/about.md", page("", "<marquee>raw</marquee>\n"), "raw HTML"],
    ["content/about.md", page("", "```\nexample\n```\n"), "lowercase language"],

    ["content/about.md", page("", ["[bad](", "javascript:", "alert)\n"].join("")), "unsafe"],
    ["content/about.md", page("", "[relative](../about.md)\n"), "root-relative"],
    ["content/about.md", page("", ":::list blogs limit=0\n"), "invalid"],
    ["content/blogs/example.md", page(), "date"],
    ["content/exp/example.md", page(), "role"],
    ["README.md", "No heading.\n", "exactly one H1"],
  ])("rejects invalid content in %s", (file, source, message) => {
    expect(checkContent(file, source).errors.join("\n")).toContain(message);
  });

  test("rejects duplicate YAML keys and aliases without fixing away evidence", () => {
    expect(() => checkContent("content/about.md", page("title: Duplicate\n"))).toThrow();
    expect(() => checkContent("content/about.md", page("tags: &tags [web]\n"))).toThrow();
    expect(() => checkContent("workflow.yml", "jobs: 1\njobs: 2\n")).toThrow();
  });

  test("requires descriptions and validates shared navigation", () => {
    expect(
      checkContent("content/about.md", "---\ntitle: Example\n---\n\nHello.\n").errors.join("\n"),
    ).toContain("description");
    const source =
      "---\nbrand: Pulkit\ndescription: Portfolio\ncopyright: Pulkit\nnavigation:\n  - {label: Home, href: 'javascript:alert'}\nsocial: []\n---\n";
    expect(checkContent("content/_site.md", source).errors.join("\n")).toContain("safe href");
  });

  test("formatting preserves code bytes, including comments and directive examples", () => {
    const code = "// an example\nconst value = 'unchanged';\n\tconsole.log(value);";
    const source = page("", `~~~js\n${code}\n~~~\n\n\`\`\`md\n:::list blogs\n\`\`\`\n`);
    const result = checkContent("content/about.md", source);
    expect(result.errors).toEqual([]);
    expect(result.formatted).toContain(code);
    expect(checkContent("content/about.md", result.formatted).formatted).toBe(result.formatted);
  });

  test("YAML formatting preserves GitHub's on key", () => {
    const result = checkContent(".github/workflows/ci.yml", "on: [push, pull_request]\njobs: {}\n");
    expect(result.errors).toEqual([]);
    expect(result.formatted).toContain("on:");
    expect(checkContent(".github/workflows/ci.yml", result.formatted).formatted).toBe(
      result.formatted,
    );
  });
});

import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import type { ProjectSourceBundle } from "@pulkit/shared/project-source";
import {
  projectSourceTree,
  verifiedProjectSource,
} from "../client/components/project-code-workspace.ts";
import { highlightProjectCode } from "../client/lib/code-highlight.ts";

const revision = "a".repeat(40);
const project = "components-ui/sample-console";
const expected = { revision, project };
const file = (
  path: string,
  language: ProjectSourceBundle["files"][number]["language"],
  content: string,
) => ({
  path,
  language,
  content,
  sha256: createHash("sha256").update(content).digest("hex"),
});
const source = (): ProjectSourceBundle => ({
  version: 1,
  revision,
  project,
  files: [
    file(".gitignore", "text", "node_modules\ndist\n"),
    file("index.html", "html", '<main data-label="sample">Current example</main>\n'),
    file("src/app.ts", "typescript", 'const greeting = "Hello, world!";\n'),
  ],
});

test("accepts exact UTF-8 source bytes and rejects stale revisions, projects and content", async () => {
  const valid = source();
  expect(await verifiedProjectSource(valid, expected)).toEqual(valid);
  await expect(
    verifiedProjectSource({ ...valid, revision: "b".repeat(40) }, expected),
  ).rejects.toThrow("does not match");
  await expect(
    verifiedProjectSource({ ...valid, project: "components-ui/other-example" }, expected),
  ).rejects.toThrow("does not match");
  const changed = source();
  const first = changed.files[0];
  if (!first) {
    throw new Error("Synthetic source file is missing");
  }
  first.content += "changed";
  await expect(verifiedProjectSource(changed, expected)).rejects.toThrow("integrity");
  const unicode = source();
  unicode.files.push(file("src/text.ts", "typescript", 'export const label = "Café 🌿";\n'));
  expect(await verifiedProjectSource(unicode, expected)).toEqual(unicode);
});

test("rejects unsafe, historical and unsupported files before any source is displayed", async () => {
  for (const path of [
    "../index.html",
    "/index.html",
    "src\\index.ts",
    ".reference/index.html",
    ".audit/index.html",
    "prompt.md",
    "README.md",
    "poster.svg",
    "demo.mp4",
    "LICENSES/unknown.txt",
  ]) {
    await expect(
      verifiedProjectSource({ ...source(), files: [file(path, "html", "synthetic")] }, expected),
    ).rejects.toThrow();
  }
  const duplicate = source();
  duplicate.files.push(file("index.html", "html", "different"));
  await expect(verifiedProjectSource(duplicate, expected)).rejects.toThrow();
  await expect(
    verifiedProjectSource(
      { ...source(), files: [file("index.html", "javascript", "synthetic")] },
      expected,
    ),
  ).rejects.toThrow();
  await expect(
    verifiedProjectSource(
      { ...source(), files: [file("index.html", "html", "x".repeat(300 * 1024 + 1))] },
      expected,
    ),
  ).rejects.toThrow();
});

test("builds nested folders before files without losing duplicate leaf names", () => {
  expect(
    projectSourceTree([
      { path: "index.html" },
      { path: "src/z.ts" },
      { path: "src/nested/index.ts" },
      { path: "src/index.ts" },
      { path: ".gitignore" },
    ]),
  ).toEqual([
    {
      name: "src",
      path: "src",
      children: [
        {
          name: "nested",
          path: "src/nested",
          children: [{ name: "index.ts", path: "src/nested/index.ts" }],
        },
        { name: "index.ts", path: "src/index.ts" },
        { name: "z.ts", path: "src/z.ts" },
      ],
    },
    { name: ".gitignore", path: ".gitignore" },
    { name: "index.html", path: "index.html" },
  ]);
});

test("highlights source as escaped text while preserving every character", async () => {
  const content = '<script>globalThis.untrusted = "<img src=x onerror=alert(1)>";</script>\n';
  const highlighted = await highlightProjectCode(content, "html");
  expect(highlighted).toContain('<span class="text-syn-');
  expect(highlighted).not.toContain("<script>");
  expect(highlighted).not.toContain("<img");
  const decoded = highlighted
    .replace(/<span class="[^"]*">|<\/span>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
  expect(decoded).toBe(content);
  expect(await highlightProjectCode("<plain>& text\r\n", "text")).toBe(
    "&lt;plain&gt;&amp; text\r\n",
  );
});

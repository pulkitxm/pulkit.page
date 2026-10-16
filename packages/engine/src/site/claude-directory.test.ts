import { expect, test } from "bun:test";
import type { DirectoryProject, Page } from "../types.ts";
import { directoryOutputs, parseDirectory, withDirectoryPages } from "./claude-directory.ts";
import { readPage } from "./read-page.ts";

const dash = String.fromCodePoint(0x2014);

const readme = [
  "# sample directory",
  "",
  "<details>",
  "<summary><b>Hero sections (2)</b></summary>",
  "",
  "| Project | Description | Stack |",
  "|---------|-------------|-------|",
  "| [quiet-hero](./hero-sections/quiet-hero/) | A calm hero with *italic* `code` | HTML, CSS |",
  `| [loud-hero](./hero-sections/loud-hero/) | Bright hero ${dash} with confetti | React |`,
  "",
  "</details>",
  "<details>",
  "<summary><b>Shaders &amp; effects (1)</b></summary>",
  "",
  `| [vendor/sample/long-shader](./templates/premium/sample/long-shader/) | ${"word ".repeat(60)}| Three.js |`,
  "</details>",
].join("\n");

const posters = { "hero-sections/quiet-hero": {}, "templates/premium/sample/long-shader": {} };

const dates = [
  { project: "long-shader", lastUpdated: "2026-08-01T00:00:00Z" },
  { project: "loud-hero", lastUpdated: "2026-07-01T00:00:00Z" },
];

test("README rows become projects with categories, plain summaries, posters and newest first", () => {
  const projects = parseDirectory(readme, posters, dates);
  expect(projects.map((project) => project.path)).toEqual([
    "templates/premium/sample/long-shader",
    "hero-sections/loud-hero",
    "hero-sections/quiet-hero",
  ]);
  const [long, loud, quiet] = projects;
  expect(long?.name).toBe("long-shader");
  expect(long?.category).toBe("Shaders & effects");
  expect(long?.summary.length).toBeLessThanOrEqual(181);
  expect(long?.summary.endsWith("word…")).toBe(true);
  expect(loud?.summary).toBe("Bright hero, with confetti");
  expect(loud?.poster).toBe(false);
  expect(quiet).toEqual({
    path: "hero-sections/quiet-hero",
    name: "quiet-hero",
    category: "Hero sections",
    summary: "A calm hero with italic code",
    stack: "HTML, CSS",
    poster: true,
  });
});

test("unreadable rows and empty READMEs fail instead of publishing a thinner directory", () => {
  expect(() =>
    parseDirectory(
      "<summary><b>Hero sections (1)</b></summary>\n| [broken](./x/) | missing stack |",
      {},
      [],
    ),
  ).toThrow("Unreadable Claude Directory row");
  expect(() => parseDirectory("# nothing here", {}, [])).toThrow("lists no projects");
});

function sourcePage(): Page {
  const text =
    "---\ntitle: Directory\ndescription: Every experiment.\n---\n\nIntro.\n\n:::claude-directory\n";
  return {
    source: "content/directory.md",
    text,
    ...readPage(text),
    route: "/directory/",
    index: false,
  };
}

function sampleProjects(count: number): DirectoryProject[] {
  return Array.from({ length: count }, (_, index) => ({
    path: `heroes/hero-${index}`,
    name: `hero-${index}`,
    category: "Heroes",
    summary: `Hero number ${index}`,
    stack: "HTML",
    poster: true,
  }));
}

test("a directory page expands into one numbered page per 24 projects", () => {
  const other = { ...sourcePage(), route: "/about/", body: "About.\n" };
  const pages = withDirectoryPages([sourcePage(), other], sampleProjects(49));
  expect(pages.map((page) => page.route)).toEqual([
    "/directory/",
    "/directory/2/",
    "/directory/3/",
    "/about/",
  ]);
  const third = pages[2];
  expect(third?.metadata).toEqual({
    title: "Directory, page 3",
    description: "Every experiment. Page 3 of 3.",
  });
  expect(third?.body).toContain(":::claude-directory page=3");
  expect(third?.text).toContain("title: Directory, page 3");
});

test("the search index is published next to the first directory page", () => {
  const all = sampleProjects(3);
  const outputs = directoryOutputs([sourcePage()], { directory: all });
  expect([...outputs.keys()]).toEqual(["directory/projects.json"]);
  expect(JSON.parse(outputs.get("directory/projects.json")?.toString() ?? "")).toEqual(all);
});

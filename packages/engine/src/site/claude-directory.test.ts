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
  "| [quiet-hero](./hero-sections/quiet-hero/) | A calm hero with *italic* `code` &lt;details&gt; | HTML, CSS |",
  `| [loud-hero](./hero-sections/loud-hero/) | Bright hero ${dash} with confetti | React |`,
  "",
  "</details>",
  "<details>",
  "<summary><b>Shaders &amp; effects (1)</b></summary>",
  "",
  `| [vendor/sample/long-shader](./templates/premium/sample/long-shader/) | ${"word ".repeat(60)}| Three.js |`,
  "</details>",
].join("\n");

const posters = {
  "hero-sections/quiet-hero": { blurDataURL: "data:image/jpeg;base64,AAAA" },
  "templates/premium/sample/long-shader": {},
};

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
  expect(long?.description.length).toBeGreaterThan(290);
  expect(loud?.summary).toBe("Bright hero, with confetti");
  expect(loud?.published).toBe(false);
  expect(long?.provider).toBe("sample");
  expect(long?.group).toBe("templates");
  expect(quiet).toEqual({
    path: "hero-sections/quiet-hero",
    name: "quiet-hero",
    title: "Quiet Hero",
    category: "Hero sections",
    group: "hero-sections",
    provider: "",
    blur: "data:image/jpeg;base64,AAAA",
    summary: "A calm hero with italic code details",
    description: "A calm hero with italic code details",
    stack: "HTML, CSS",
    published: true,
  });
});

test("numeric or repeated project names fail because they would collide with routes", () => {
  const row = (path: string): string => `| [x](./${path}/) | Text | HTML |`;
  const section = "<summary><b>Heroes (2)</b></summary>";
  expect(() => parseDirectory([section, row("heroes/42")].join("\n"), {}, [])).toThrow(
    "not numeric",
  );
  expect(() =>
    parseDirectory([section, row("heroes/same"), row("shaders/same")].join("\n"), {}, []),
  ).toThrow("must be unique");
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
    title: `Hero ${index}`,
    category: "Heroes",
    group: "heroes",
    provider: "",
    blur: "",
    summary: `Hero number ${index}`,
    description: `The full story of hero number ${index}`,
    stack: "HTML",
    published: true,
  }));
}

test("a directory page expands into numbered pages and one page per project", () => {
  const other = { ...sourcePage(), route: "/about/", body: "About.\n" };
  const pages = withDirectoryPages([sourcePage(), other], sampleProjects(49));
  expect(pages.map((page) => page.route)).toEqual([
    "/directory/",
    "/directory/2/",
    "/directory/3/",
    ...Array.from({ length: 49 }, (_, index) => `/directory/hero-${index}/`),
    "/about/",
  ]);
  expect(pages[0]?.index).toBe(false);
  const project = pages.find((page) => page.route === "/directory/hero-7/");
  expect(project?.metadata).toEqual({
    title: "Hero 7",
    description: "The full story of hero number 7",
  });
  expect(project?.body.trim()).toBe(":::claude-directory project=hero-7");
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
  const outputs = directoryOutputs([sourcePage()], { directory: { projects: all, stars: 0 } });
  expect([...outputs.keys()]).toEqual(["directory/projects.json"]);
  expect(JSON.parse(outputs.get("directory/projects.json")?.toString() ?? "")).toEqual(
    all.map(({ description: _, blur: __, ...project }) => project),
  );
});

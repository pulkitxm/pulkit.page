import { expect, test } from "bun:test";
import { experimentPreview, experimentSource } from "@pulkit/shared/experiments";
import type { DirectoryProject, Page } from "../types.ts";
import { directoryOutputs, hasDirectory, withDirectoryPages } from "./experiment-gallery.ts";
import { readPage } from "./read-page.ts";

function sourcePage(): Page {
  const text =
    "---\ntitle: UI experiments\ndescription: Reviewed examples.\n---\n\n:::experiment-gallery\n";
  return {
    source: "content/directory.md",
    text,
    ...readPage(text),
    route: "/directory/",
    index: false,
  };
}
function sampleProjects(count: number): DirectoryProject[] {
  return Array.from({ length: count }, (_, index) => {
    const path = `hero-sections/mock-${index}`;
    return {
      path,
      name: path.replaceAll("/", "--"),
      title: `Sample ${index}`,
      category: "Hero sections",
      group: "hero-sections",
      summary: `Synthetic example ${index}`,
      description: `Independent synthetic example ${index} for gallery verification.`,
      thumbnail: "",
      video: "",
      source: experimentSource(path),
      preview: experimentPreview(path),
    };
  });
}

test("only the reviewed gallery directive enables catalog ingestion", () => {
  expect(hasDirectory(sourcePage())).toBe(true);
  expect(hasDirectory({ body: ":::claude-directory\n" })).toBe(false);
});

test("generates only new reviewed routes and preserves unrelated portfolio pages", () => {
  const other = { ...sourcePage(), route: "/about/", body: "About.\n" };
  const pages = withDirectoryPages([sourcePage(), other], sampleProjects(49));
  expect(pages.map((page) => page.route)).toEqual([
    "/directory/",
    "/directory/pages/2/",
    "/directory/pages/3/",
    ...Array.from(
      { length: 49 },
      (_, index) => `/directory/experiments/hero-sections--mock-${index}/`,
    ),
    "/about/",
  ]);
  const project = pages.find((page) => page.route.endsWith("hero-sections--mock-7/"));
  expect(project?.body.trim()).toBe(":::experiment-gallery project=hero-sections--mock-7");
  expect(project?.metadata.title).toBe("Sample 7");
  expect(pages.some((page) => page.route === "/directory/mock-7/")).toBe(false);
});

test("publishes a versioned approved search index and never the legacy projects.json endpoint", () => {
  const projects = sampleProjects(3);
  const revision = "a".repeat(40);
  const outputs = directoryOutputs([sourcePage()], { directory: { projects, stars: 0, revision } });
  expect([...outputs.keys()]).toEqual(["directory/reviewed-projects.json"]);
  expect(JSON.parse(outputs.get("directory/reviewed-projects.json")?.toString() ?? "")).toEqual({
    version: 1,
    revision,
    projects,
  });
});

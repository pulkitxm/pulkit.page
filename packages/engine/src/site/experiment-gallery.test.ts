import { expect, test } from "bun:test";
import { experimentPreview, experimentSource } from "@pulkit/shared/experiments";
import type { DirectoryProject, Page } from "../types.ts";
import {
  directoryOutputs,
  fetchDirectoryStars,
  hasDirectory,
  withDirectoryPages,
} from "./experiment-gallery.ts";
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

const repositoryMetadata = (count: unknown) => ({
  full_name: "pulkitxm/claude-directory",
  html_url: "https://github.com/pulkitxm/claude-directory",
  stargazers_count: count,
});

test("loads the real validated GitHub count with a fixed, bounded server-side request", async () => {
  let requested = false;
  const count = await fetchDirectoryStars({
    token: "synthetic-build-token",
    request: (url, options) => {
      requested = true;
      expect(url).toBe("https://api.github.com/repos/pulkitxm/claude-directory");
      expect(options.redirect).toBe("error");
      expect(options.credentials).toBe("omit");
      expect(options.signal).toBeInstanceOf(AbortSignal);
      const headers = new Headers(options.headers);
      expect(headers.get("accept")).toBe("application/vnd.github+json");
      expect(headers.get("authorization")).toBe("Bearer synthetic-build-token");
      expect(headers.get("user-agent")).toBe("pulkit.page-build");
      return Promise.resolve(Response.json(repositoryMetadata(42)));
    },
  });
  expect(requested).toBe(true);
  expect(count).toBe(42);
  expect(
    await fetchDirectoryStars({
      token: "",
      request: (_url, options) => {
        expect(new Headers(options.headers).has("authorization")).toBe(false);
        return Promise.resolve(Response.json(repositoryMetadata(0)));
      },
    }),
  ).toBe(0);
});

test("rejects invalid counts, mismatched repositories and failed responses without publishing a fake count", async () => {
  for (const body of [
    null,
    {},
    ...["42", -1, 1.5, Number.MAX_SAFE_INTEGER + 1, null].map(repositoryMetadata),
    { ...repositoryMetadata(42), full_name: "sample/other-project" },
    { ...repositoryMetadata(42), html_url: "https://example.test/" },
  ]) {
    await expect(
      fetchDirectoryStars({ token: "", request: async () => Response.json(body) }),
    ).rejects.toThrow("Could not retrieve the GitHub repository star count");
  }
  for (const request of [
    async () => new Response("Synthetic API rate limit", { status: 403 }),
    async () => new Response("not JSON"),
    () => Promise.reject(new Error("Synthetic network failure")),
  ]) {
    await expect(fetchDirectoryStars({ token: "", request })).rejects.toThrow(
      "Could not retrieve the GitHub repository star count",
    );
  }
});

test("aborts a stalled repository request and rejects unbounded timeout settings", async () => {
  let aborted = false;
  await expect(
    fetchDirectoryStars({
      token: "",
      timeoutMs: 20,
      request: (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(new DOMException("Synthetic request timeout", "AbortError"));
          });
        }),
    }),
  ).rejects.toThrow("Could not retrieve the GitHub repository star count");
  expect(aborted).toBe(true);
  for (const timeoutMs of [0, -1, 5001, Number.POSITIVE_INFINITY]) {
    await expect(fetchDirectoryStars({ timeoutMs })).rejects.toThrow("bounded timeout");
  }
});

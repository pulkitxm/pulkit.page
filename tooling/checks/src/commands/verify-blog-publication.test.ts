import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { repositoryRoot } from "@pulkit/shared/repository";

const revision = "c".repeat(40);
const script = join(repositoryRoot, "tooling/checks/verify-blog-publication.py");
const index = "<!doctype html><h1>Synthetic blog</h1>";
const galleryLink = '<a href="https://pulkit.page/claude-directory/">Experiment gallery</a>';
const article = `${galleryLink} collects responsive interface experiments with screenshots, short recordings and source links.`;
const retiredPaths = [
  "/assets/content/public/blogs/my-first-talk/02.webp",
  "/assets/content/public/blogs/my-first-talk/03.webp",
  "/assets/content/public/blogs/my-first-talk/04.webp",
  "/assets/content/public/blogs/my-first-talk/05.webp",
  "/assets/content/public/blogs/my-first-talk/video-thumbnail.webp",
  "/assets/embeds/claude-directory.js",
  "/assets/embeds/claude-directory-38enmh67.js",
  "/assets/embeds/claude-directory-b6hh6dnw.js",
];
const digest = (source: string) => createHash("sha256").update(source).digest("hex");

async function inspect(
  options: {
    revision?: string;
    assetStatus?: number;
    redirect?: boolean;
    corrupt?: boolean;
    offline?: boolean;
    article?: string;
    corruptArticle?: boolean;
    assetPath?: string;
  } = {},
) {
  const currentArticle = options.article ?? article;
  const assetRequests: { path: string; method: string }[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/publication.json") {
        return Response.json({
          source_repository: "pulkitxm/pulkit.page",
          source_revision: options.revision ?? revision,
          index_sha256: digest(index),
          article_sha256: digest(options.corruptArticle ? article : currentArticle),
        });
      }
      if (path === "/") {
        return new Response(options.corrupt ? "different content" : index);
      }
      if (path === "/my-first-talk/") {
        return new Response(options.corruptArticle ? `${currentArticle}changed` : currentArticle);
      }
      if (path.startsWith("/assets/")) {
        assetRequests.push({ path, method: request.method });
        if (options.redirect) {
          return new Response(null, { status: 302, headers: { location: "/missing" } });
        }
        return new Response(null, {
          status:
            !options.assetPath || path === options.assetPath ? (options.assetStatus ?? 404) : 404,
        });
      }
      return new Response(null, { status: 404 });
    },
  });
  const origin = server.url.origin;
  if (options.offline) {
    server.stop(true);
  }
  try {
    const child = Bun.spawn(
      ["python3", script, revision, "--origin", origin, "--attempts", "1", "--interval", "0"],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [status, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    return { status, stdout, stderr, assetRequests };
  } finally {
    server.stop(true);
  }
}

test("manual publication requires the exact deployed receipt, matching content and expected URLs", async () => {
  for (const assetStatus of [404, 410]) {
    const result = await inspect({ assetStatus });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(revision);
    expect(result.assetRequests).toEqual(retiredPaths.map((path) => ({ path, method: "HEAD" })));
  }
});

test("old source receipts, stale content, reachable media, forbidden responses and redirects fail closed", async () => {
  for (const options of [
    { revision: "d".repeat(40) },
    { corrupt: true },
    { corruptArticle: true },
    { assetStatus: 200 },
    { assetStatus: 403 },
    { redirect: true },
    { offline: true },
  ]) {
    const result = await inspect(options);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Manual blog publication is not verified");
  }
});

test("the matching article receipt also requires the exact current collection link and description", async () => {
  for (const text of [
    "A synthetic article without a collection link.",
    article.replace("https://pulkit.page/", "https://example.test/"),
    article.replace("/claude-directory/", "/different-collection/"),
    galleryLink,
  ]) {
    const result = await inspect({ article: text });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("does not describe and link the current project collection");
  }
});

test("every retired direct asset must remain absent", async () => {
  for (const path of retiredPaths) {
    const result = await inspect({ assetPath: path, assetStatus: 200 });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(path);
  }
});

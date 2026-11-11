import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { repositoryRoot } from "@pulkit/shared/repository";

const revision = "c".repeat(40);
const script = join(repositoryRoot, "tooling/checks/verify-blog-publication.py");
const index = "<!doctype html><h1>Synthetic blog</h1>";
const article = "A collection of interface experiments.";
const digest = (source: string) => createHash("sha256").update(source).digest("hex");

async function inspect(
  options: {
    revision?: string;
    assetStatus?: number;
    redirect?: boolean;
    corrupt?: boolean;
    offline?: boolean;
  } = {},
) {
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
          article_sha256: digest(article),
        });
      }
      if (path === "/") {
        return new Response(options.corrupt ? "different content" : index);
      }
      if (path === "/my-first-talk/") {
        return new Response(article);
      }
      if (path.startsWith("/assets/")) {
        if (options.redirect) {
          return new Response(null, { status: 302, headers: { location: "/missing" } });
        }
        return new Response(null, { status: options.assetStatus ?? 404 });
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
    return { status, stdout, stderr };
  } finally {
    server.stop(true);
  }
}

test("manual publication requires the exact deployed receipt, matching content and unpublished URLs", async () => {
  for (const assetStatus of [404, 410]) {
    const result = await inspect({ assetStatus });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(revision);
  }
});

test("old source receipts, stale content, reachable media, forbidden responses and redirects fail closed", async () => {
  for (const options of [
    { revision: "d".repeat(40) },
    { corrupt: true },
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

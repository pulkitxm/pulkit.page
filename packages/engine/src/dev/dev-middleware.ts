import type { ServerResponse } from "node:http";
import process from "node:process";
import { errorMessage } from "@pulkit/shared/failures";
import type { Connect, ViteDevServer } from "vite";
import { developmentLog } from "../lib/log.ts";
import { logRequest } from "../lib/server.ts";
import type { DevelopmentAssets } from "./dev-assets.ts";
import type { DevelopmentRenderer } from "./dev-renderer.ts";

const demoSources = /^\/packages\/demos\//;
const resetSources =
  /^\/(?:packages\/[a-z-]+\/src\/|bun.lock$|biome.json$|packages\/theme\/assets\/fonts\/|packages\/demos\/showcases\/)/;
const pageSources = /^(?:content\/|layouts\/|CNAME$|\/packages\/theme\/layouts\/)/;

function errorStatus(error: unknown): number {
  if (error instanceof URIError) {
    return 400;
  }
  return error instanceof Error && "code" in error && error.code === "ENOENT" ? 404 : 500;
}

function respond(
  request: Connect.IncomingMessage,
  response: ServerResponse,
  type: string,
  body: string | Buffer,
): void {
  response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
  response.end(request.method === "HEAD" ? undefined : body);
}

export function watchSources(
  vite: ViteDevServer,
  repository: string,
  renderer: DevelopmentRenderer,
  assets: DevelopmentAssets,
): void {
  const project = `${process.cwd()}/`;
  vite.watcher.on("all", (event, file) => {
    if (!["add", "change", "unlink"].includes(event)) {
      return;
    }
    const path = file.startsWith(project)
      ? file.slice(project.length)
      : `/${file.slice(`${repository}/`.length)}`;
    const reset = resetSources.test(path);
    if (demoSources.test(path) && !reset) {
      assets.invalidateDemos();
      vite.ws.send({ type: "full-reload" });
      return;
    }
    if (reset || pageSources.test(path)) {
      renderer.invalidate(reset);
      developmentLog(`Changed ${path}. Pages rebuild when requested.`);
      vite.ws.send({ type: "full-reload" });
    }
  });
}

export function servePages(
  vite: ViteDevServer,
  origin: () => string,
  renderer: DevelopmentRenderer,
  assets: DevelopmentAssets,
): Connect.NextHandleFunction {
  return async (request, response, next) => {
    let description: string | undefined;
    let asset = false;
    logRequest(request, response, {
      timing: "total",
      summary: () =>
        !asset || response.statusCode >= 400
          ? (description ?? (response.statusCode === 404 ? "not found" : "request rejected"))
          : undefined,
      reportAborted: () => !asset,
    });
    try {
      const url = new URL(request.url ?? "/", origin());
      const pathname = decodeURIComponent(url.pathname);
      if (!["GET", "HEAD"].includes(request.method ?? "")) {
        response.writeHead(405).end("Method not allowed");
        return;
      }
      const pending = assets.resolve(pathname);
      if (pending) {
        asset = true;
        const resolved = await pending;
        if (resolved.kind === "vite") {
          next();
        } else if (resolved.kind === "missing") {
          response.writeHead(404).end("Not found");
        } else {
          respond(request, response, resolved.type, resolved.body);
        }
        return;
      }
      const result = await renderer.render(pathname);
      if (!result) {
        response.writeHead(404).end("Not found");
        return;
      }
      if (result.kind === "redirect") {
        description = `redirect to ${result.location + url.search}`;
        response.writeHead(302, { Location: result.location + url.search }).end();
        return;
      }
      description = result.description;
      const body =
        result.type.startsWith("text/html") && typeof result.body === "string"
          ? await vite.transformIndexHtml(pathname, result.body)
          : result.body;
      respond(request, response, result.type, body);
    } catch (error) {
      const message = errorMessage(error);
      description = `failed: ${message}`;
      response.writeHead(errorStatus(error), { "Content-Type": "text/plain" }).end(message);
    }
  };
}

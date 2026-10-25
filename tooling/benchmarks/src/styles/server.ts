import { existsSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { sha256Hex } from "@pulkit/shared/hash";
import { root, type Variant } from "./config.ts";

interface Counters {
  requests: number;
  bodyBytes: number;
  revalidations: number;
  missing: number;
}
const policy =
  "default-src 'self';script-src 'self' 'unsafe-inline';style-src 'self' 'unsafe-inline';img-src 'self' data:;font-src 'self' data:;connect-src 'none';frame-src 'none';object-src 'none';base-uri 'none';form-action 'none';worker-src 'none'";

function fixtureServer(directory: string) {
  const counters: Counters = { requests: 0, bodyBytes: 0, revalidations: 0, missing: 0 };
  const resources = new Map<
    string,
    { bytes: Buffer; gzip: Buffer | null; type: string; tag: string }
  >();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      counters.requests++;
      const path = decodeURIComponent(new URL(request.url).pathname);
      const document = path === "/";
      if (
        !document &&
        path !== "/home.css" &&
        path !== "/favicon.ico" &&
        !path.startsWith("/assets/")
      ) {
        return new Response("Not found", { status: 404 });
      }
      let resource = resources.get(path);
      if (!resource) {
        const local = resolve(directory, `.${document ? "/index.html" : path}`);
        const assets = resolve(root, "apps/page/dist");
        const fallback = resolve(assets, `.${path}`);
        const file =
          local.startsWith(`${resolve(directory)}${sep}`) && existsSync(local) ? local : fallback;
        if (
          !(file.startsWith(`${assets}${sep}`) || file.startsWith(`${resolve(directory)}${sep}`)) ||
          !existsSync(file)
        ) {
          counters.missing++;
          return new Response("Not found", { status: 404 });
        }
        const bytes = readFileSync(file);
        resource = {
          bytes,
          gzip: /\.(?:html|css|js|svg)$/.test(file) ? gzipSync(bytes) : null,
          type: Bun.file(file).type,
          tag: `"${sha256Hex(bytes).slice(0, 20)}"`,
        };
        resources.set(path, resource);
      }
      const headers = new Headers({
        "Content-Type": resource.type,
        "Cache-Control": document ? "no-cache" : "public,max-age=31536000,immutable",
        ETag: resource.tag,
        "Content-Security-Policy": policy,
        Vary: "Accept-Encoding",
      });
      if (request.headers.get("if-none-match") === resource.tag) {
        counters.revalidations++;
        return new Response(null, { status: 304, headers });
      }
      const compressed = resource.gzip && request.headers.get("accept-encoding")?.includes("gzip");
      const bytes = compressed ? (resource.gzip ?? resource.bytes) : resource.bytes;
      if (compressed) {
        headers.set("Content-Encoding", "gzip");
      }
      headers.set("Content-Length", String(bytes.length));
      if (request.method !== "HEAD") {
        counters.bodyBytes += bytes.length;
      }
      return new Response(request.method === "HEAD" ? null : new Uint8Array(bytes), { headers });
    },
  });
  return {
    url: server.url.origin,
    counters: () => ({ ...counters }),
    close: () => server.stop(true),
  };
}

export type FixtureServer = ReturnType<typeof fixtureServer>;

export function fixtureServers(output: string, variants: readonly Variant[]) {
  return new Map(
    variants.map((variant) => [variant, fixtureServer(join(output, "variants", variant))]),
  );
}

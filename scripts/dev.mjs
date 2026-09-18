import { realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { createServer } from "vite";
import { developmentLog } from "./dev-log.mjs";
import { developmentRenderer } from "./dev-renderer.mjs";
import { formatDuration } from "./duration.mjs";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const explicit = process.env.PORT !== undefined && process.env.PORT !== "";
const port = explicit ? Number(process.env.PORT) : 3000;
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("PORT must be an integer between 0 and 65535 (0 selects an available port)");
}
let origin;
const renderer = developmentRenderer(() => origin);
const server = await createServer({
  configFile: false,
  appType: "custom",
  publicDir: false,
  clearScreen: false,
  logLevel: "warn",
  server: {
    host: "127.0.0.1",
    port,
    strictPort: explicit,
    watch: { ignored: ["**/pages/**", "**/dist/**", "**/.cache/**", "**/extras/**"] },
    fs: { strict: true, allow: [process.cwd()] },
  },
  plugins: [
    tailwindcss(),
    {
      name: "markdown-pages",
      configureServer(vite) {
        vite.watcher.on("all", (event, file) => {
          if (!["add", "change", "unlink"].includes(event)) {
            return;
          }
          const path = file.slice(`${process.cwd()}/`.length);
          const reset = /^(?:scripts\/|bun.lock$|biome.json$|assets\/fonts\/)/.test(path);
          if (reset || /^(?:content\/|layouts\/|CNAME$)/.test(path)) {
            renderer.invalidate(reset);
            developmentLog(`Changed ${path}. Pages rebuild when requested.`);
            vite.ws.send({ type: "full-reload" });
          }
        });
        vite.middlewares.use(async (request, response, next) => {
          const startedAt = performance.now();
          let description;
          let asset = false;
          response.once("finish", () => {
            if (!asset || response.statusCode >= 400) {
              const result =
                description ?? (response.statusCode === 404 ? "not found" : "request rejected");
              developmentLog(
                `${request.method} ${request.url} | ${response.statusCode} | ${result} | total ${formatDuration(performance.now() - startedAt)}`,
              );
            }
          });
          response.once("close", () => {
            if (!response.writableFinished && !asset) {
              developmentLog(
                `${request.method} ${request.url} | connection closed before completion`,
                startedAt,
              );
            }
          });
          try {
            const url = new URL(request.url, origin);
            const pathname = decodeURIComponent(url.pathname);
            if (!["GET", "HEAD"].includes(request.method)) {
              response.writeHead(405).end("Method not allowed");
              return;
            }
            if (pathname.startsWith("/@") || pathname.startsWith("/node_modules/")) {
              asset = true;
              next();
              return;
            }
            if (
              ["/styles.css", "/theme.js"].includes(pathname) ||
              pathname.startsWith("/assets/")
            ) {
              asset = true;
              const root = resolve(pathname.startsWith("/assets/") ? "assets" : ".");
              const file = realpathSync(resolve(`.${pathname}`));
              if (!file.startsWith(`${root}${sep}`)) {
                response.writeHead(404).end("Not found");
                return;
              }
              next();
              return;
            }
            const result = await renderer.render(pathname);
            if (!result) {
              response.writeHead(404).end("Not found");
              return;
            }
            if (result.redirect) {
              description = `redirect to ${result.redirect + url.search}`;
              response.writeHead(302, { Location: result.redirect + url.search }).end();
              return;
            }
            description = result.description;
            const body = result.type.startsWith("text/html")
              ? await vite.transformIndexHtml(pathname, result.body)
              : result.body;
            response.writeHead(200, { "Content-Type": result.type, "Cache-Control": "no-store" });
            response.end(request.method === "HEAD" ? undefined : body);
          } catch (error) {
            description = `failed: ${error.message}`;
            const status = error instanceof URIError ? 400 : error.code === "ENOENT" ? 404 : 500;
            response.writeHead(status, { "Content-Type": "text/plain" }).end(error.message);
          }
        });
      },
    },
  ],
});
await server.listen();
origin = server.resolvedUrls.local[0].replace(/\/$/, "");
developmentLog(`Development server: ${origin}/`, 0);
developmentLog("Ready. Pages compile when opened; edits reload automatically.");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    developmentLog("Stopping development server.");
    await server.close();
    process.exit(0);
  });
}

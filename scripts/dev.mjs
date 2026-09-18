import { existsSync, readFileSync, realpathSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { createServer } from "vite";
import {
  bundleDemoScripts,
  bundleEmbedScripts,
  compileDemoStyles,
  fontFile,
} from "./demo-assets.mjs";
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
const demoOutput = ".cache/demos-dev";
const embedOutput = ".cache/embeds-dev";
let embedBundle;
let demoBundle;

async function demoAsset(name) {
  if (name === "demos.css" || name === "document.css") {
    const styles = compileDemoStyles({ minify: false });
    return { type: "text/css", body: name === "demos.css" ? styles.shadow : styles.document };
  }
  const font = fontFile(name);
  if (font) {
    return { type: "font/woff2", body: readFileSync(font) };
  }
  if (!/^[\w.-]+\.js$/.test(name)) {
    return undefined;
  }
  if (name === "index.js" || !demoBundle) {
    demoBundle = rm(demoOutput, { force: true, recursive: true }).then(() =>
      bundleDemoScripts(demoOutput, { minify: false }),
    );
  }
  await demoBundle;
  const file = resolve(demoOutput, name);
  return existsSync(file) ? { type: "text/javascript", body: readFileSync(file) } : undefined;
}
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
          const reset =
            /^(?:scripts\/|bun.lock$|biome.json$|assets\/fonts\/|demos\/showcases\/)/.test(path);
          if (/^demos\//.test(path) && !reset) {
            demoBundle = undefined;
            vite.ws.send({ type: "full-reload" });
            return;
          }
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
            if (pathname.startsWith("/assets/katex/")) {
              asset = true;
              const katex = resolve(
                fileURLToPath(new URL("dist", import.meta.resolve("katex/package.json"))),
              );
              const file = resolve(katex, `.${pathname.slice("/assets/katex".length)}`);
              if (!file.startsWith(`${katex}${sep}`) || !existsSync(file)) {
                response.writeHead(404).end("Not found");
                return;
              }
              response.writeHead(200, {
                "Content-Type": file.endsWith(".css") ? "text/css" : "font/woff2",
                "Cache-Control": "no-store",
              });
              response.end(request.method === "HEAD" ? undefined : readFileSync(file));
              return;
            }
            if (pathname.startsWith("/assets/embeds/")) {
              asset = true;
              const name = pathname.slice("/assets/embeds/".length);
              if (name === "photoswipe.css") {
                response.writeHead(200, {
                  "Content-Type": "text/css",
                  "Cache-Control": "no-store",
                });
                response.end(
                  request.method === "HEAD"
                    ? undefined
                    : readFileSync(
                        fileURLToPath(
                          new URL(
                            "dist/photoswipe.css",
                            import.meta.resolve("photoswipe/package.json"),
                          ),
                        ),
                      ),
                );
                return;
              }
              if (!/-[a-z0-9]{8}\.js$/.test(name) || !embedBundle) {
                embedBundle = (embedBundle ?? Promise.resolve()).then(async () => {
                  await rm(embedOutput, { force: true, recursive: true });
                  await bundleEmbedScripts(embedOutput, { minify: false });
                });
              }
              await embedBundle;
              const file = resolve(embedOutput, name);
              if (!/^[\w.-]+\.js$/.test(name) || !existsSync(file)) {
                response.writeHead(404).end("Not found");
                return;
              }
              response.writeHead(200, {
                "Content-Type": "text/javascript",
                "Cache-Control": "no-store",
              });
              response.end(request.method === "HEAD" ? undefined : readFileSync(file));
              return;
            }
            if (pathname.startsWith("/assets/demos/")) {
              asset = true;
              const demo = await demoAsset(pathname.slice("/assets/demos/".length));
              if (!demo) {
                response.writeHead(404).end("Not found");
                return;
              }
              response.writeHead(200, { "Content-Type": demo.type, "Cache-Control": "no-store" });
              response.end(request.method === "HEAD" ? undefined : demo.body);
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

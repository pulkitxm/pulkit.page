import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { failWith } from "@pulkit/shared/failures";
import { preview } from "vite";
import { developmentLog } from "../lib/log.ts";
import { serverPort } from "../lib/port.ts";
import { closeOnSignals, localServerUrl, logRequest } from "../lib/server.ts";
import { notFoundFile } from "../seo/routes.ts";

if (!existsSync("dist/index.html")) {
  failWith(
    "No built site found. Run `bun run build` first, or `bun run serve` to build and serve.",
  );
}
const notFound = existsSync(join("dist", notFoundFile))
  ? readFileSync(join("dist", notFoundFile))
  : undefined;

function builtFile(url: string | undefined): boolean {
  try {
    return existsSync(
      join("dist", decodeURIComponent(new URL(url ?? "/", "http://dist").pathname)),
    );
  } catch {
    return false;
  }
}
const { port, explicit } = serverPort();
const server = await preview({
  configFile: false,
  appType: "mpa",
  logLevel: "warn",
  build: { outDir: "dist" },
  preview: { host: "127.0.0.1", port, strictPort: explicit },
  plugins: [
    {
      name: "preview-logging",
      configurePreviewServer(vite) {
        vite.middlewares.use((request, response, next) => {
          logRequest(request, response, {
            timing: "response",
            summary: () => {
              const type = String(response.getHeader("Content-Type") ?? "");
              if (response.statusCode >= 400) {
                return "request failed";
              }
              return type.includes("text/html") ? "served from dist" : undefined;
            },
          });
          next();
        });
        return () => {
          vite.middlewares.use((request, response, next) => {
            if (!notFound || builtFile(request.url)) {
              next();
              return;
            }
            response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
            response.end(request.method === "HEAD" ? undefined : notFound);
          });
        };
      },
    },
  ],
});
developmentLog(`Built site: ${localServerUrl(server.resolvedUrls)}`, 0);
developmentLog("Serving dist. Run bun run build after changes, or bun dev for live editing.");
closeOnSignals(server);

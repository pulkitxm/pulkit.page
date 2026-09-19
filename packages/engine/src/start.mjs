import { existsSync } from "node:fs";
import process from "node:process";
import { formatDuration } from "@pulkit/shared/duration";
import { failWith } from "@pulkit/shared/failures";
import { preview } from "vite";
import { developmentLog } from "./dev-log.mjs";
import { serverPort } from "./server-port.mjs";

if (!existsSync("dist/index.html")) {
  failWith(
    "No built site found. Run `bun run build` first, or `bun run serve` to build and serve.",
  );
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
          const startedAt = performance.now();
          const requestedUrl = request.url;
          response.once("finish", () => {
            const type = String(response.getHeader("Content-Type") ?? "");
            if (type.includes("text/html") || response.statusCode >= 400) {
              developmentLog(
                `${request.method} ${requestedUrl} | ${response.statusCode} | ${response.statusCode >= 400 ? "request failed" : "served from dist"} | response ${formatDuration(performance.now() - startedAt)}`,
              );
            }
          });
          next();
        });
      },
    },
  ],
});
developmentLog(`Built site: ${server.resolvedUrls.local[0]}`, 0);
developmentLog("Serving dist. Run bun run build after changes, or bun dev for live editing.");
process.once("SIGINT", async () => {
  await server.close();
  process.exit(0);
});

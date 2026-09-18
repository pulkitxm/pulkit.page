import { existsSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { developmentLog } from "./dev-log.mjs";
import { formatDuration } from "./duration.mjs";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
if (!existsSync("dist/index.html")) {
  console.error("No built site found. Run `bun run build` first, then `bun start`.");
  process.exit(1);
}
const explicit = process.env.PORT !== undefined && process.env.PORT !== "";
const port = explicit ? Number(process.env.PORT) : 3000;
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("PORT must be an integer between 0 and 65535 (0 selects an available port)");
}
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

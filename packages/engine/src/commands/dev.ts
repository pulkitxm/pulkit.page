import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import process from "node:process";
import { repositoryRoot as repository } from "@pulkit/shared/repository";
import tailwindcss from "@tailwindcss/vite";
import { createServer } from "vite";
import { developmentAssets } from "../dev/dev-assets.ts";
import { servePages, watchSources } from "../dev/dev-middleware.ts";
import { developmentOriginFile, developmentRenderer } from "../dev/dev-renderer.ts";
import { developmentLog } from "../lib/log.ts";
import { serverPort } from "../lib/port.ts";
import { closeOnSignals, localServerUrl } from "../lib/server.ts";

const { port, explicit } = serverPort();
let origin = "";
const renderer = developmentRenderer(() => origin);
const assets = developmentAssets();
const server = await createServer({
  configFile: false,
  appType: "custom",
  publicDir: false,
  clearScreen: false,
  logLevel: "warn",
  server: {
    preTransformRequests: false,
    host: "127.0.0.1",
    port,
    strictPort: explicit,
    watch: { ignored: ["**/dist/**", "**/.cache/**", "**/extras/**"] },
    fs: { strict: true, allow: [process.cwd(), repository] },
  },
  plugins: [
    tailwindcss(),
    {
      name: "markdown-pages",
      configureServer(vite) {
        watchSources(vite, repository, renderer, assets);
        vite.middlewares.use(servePages(vite, () => origin, renderer, assets));
      },
    },
  ],
});
await server.listen();
origin = localServerUrl(server.resolvedUrls).replace("127.0.0.1", "localhost").replace(/\/$/, "");
mkdirSync(".cache", { recursive: true });
writeFileSync(developmentOriginFile, origin);
developmentLog(`Development server: ${origin}/`, 0);
developmentLog("Ready. Pages compile when opened; edits reload automatically.");
closeOnSignals(server, () => {
  developmentLog("Stopping development server.");
  rmSync(developmentOriginFile, { force: true });
});

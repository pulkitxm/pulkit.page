import { readFileSync } from "node:fs";
import process from "node:process";

export function resolveSiteOrigin(
  env = process.env,
  readCname = () => readFileSync("CNAME", "utf8"),
) {
  const environment = env.NODE_ENV || "production";
  let candidate = env.SITE_URL;
  if (!candidate) {
    if (environment === "development") {
      const port = env.PORT || "3000";
      if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
        throw new Error("Development generation requires a resolved PORT or SITE_URL");
      }
      candidate = `http://127.0.0.1:${port}`;
    } else if (environment === "production") {
      const domain = readCname().trim();
      if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/i.test(domain)) {
        throw new Error("CNAME must contain one production hostname");
      }
      candidate = `https://${domain}`;
    } else {
      throw new Error(`SITE_URL is required for the ${environment} environment`);
    }
  }
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("SITE_URL must be an absolute HTTP(S) origin");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "SITE_URL must be an HTTP(S) origin without credentials, path, query or fragment",
    );
  }
  return url.origin;
}

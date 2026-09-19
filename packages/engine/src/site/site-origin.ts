import { readFileSync } from "node:fs";
import process from "node:process";
import { isValidPort } from "../lib/port.ts";
import type { Environment } from "../types.ts";

function candidateOrigin(env: Environment, readCname: () => string): string {
  const environment = env.NODE_ENV || "production";
  if (env.SITE_URL) {
    return env.SITE_URL;
  }
  if (environment === "development") {
    const port = env.PORT || "3000";
    if (!/^\d+$/.test(port) || Number(port) < 1 || !isValidPort(Number(port))) {
      throw new Error("Development generation requires a resolved PORT or SITE_URL");
    }
    return `http://127.0.0.1:${port}`;
  }
  if (environment === "production") {
    const domain = readCname().trim();
    if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/i.test(domain)) {
      throw new Error("CNAME must contain one production hostname");
    }
    return `https://${domain}`;
  }
  throw new Error(`SITE_URL is required for the ${environment} environment`);
}

export function resolveSiteOrigin(
  env: Environment = process.env,
  readCname: () => string = () => readFileSync("CNAME", "utf8"),
): string {
  const candidate = candidateOrigin(env, readCname);
  let url: URL;
  try {
    url = new URL(candidate);
  } catch (error) {
    throw new Error("SITE_URL must be an absolute HTTP(S) origin", { cause: error });
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

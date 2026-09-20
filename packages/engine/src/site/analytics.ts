import process from "node:process";
import type { Environment } from "../types.ts";

export interface Analytics {
  key: string;
  host: string;
  debug: boolean;
}

const projectKey = /^phc_[A-Za-z0-9]{16,}$/;
const defaultHost = "https://us.i.posthog.com";

export function resolveAnalytics(env: Environment = process.env): Analytics | undefined {
  const key = env.POSTHOG_KEY;
  if (!key) {
    return;
  }
  if (!projectKey.test(key)) {
    throw new Error("POSTHOG_KEY must be a PostHog project key starting with phc_");
  }
  let host: URL;
  try {
    host = new URL(env.POSTHOG_HOST || defaultHost);
  } catch (error) {
    throw new Error("POSTHOG_HOST must be an absolute HTTPS origin", { cause: error });
  }
  if (
    host.protocol !== "https:" ||
    host.username ||
    host.password ||
    host.pathname !== "/" ||
    host.search ||
    host.hash
  ) {
    throw new Error("POSTHOG_HOST must be an HTTPS origin without credentials, path or query");
  }
  return { key, host: host.origin, debug: env.POSTHOG_DEBUG === "1" };
}

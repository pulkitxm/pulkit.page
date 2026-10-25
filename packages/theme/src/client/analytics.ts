import { afterPageLoad } from "@pulkit/shared/idle";

const tag = document.querySelector<HTMLScriptElement>("script[data-posthog-key]");
const key = tag?.dataset.posthogKey;
const host = tag?.dataset.posthogHost;

function storedKey(): string {
  try {
    return localStorage.getItem("IGNORE_KEY") ?? "";
  } catch {
    return "";
  }
}

async function excluded(expected: string | undefined): Promise<boolean> {
  const stored = storedKey();
  if (!(expected && stored)) {
    return false;
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stored));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"));
  return hex.join("") === expected;
}

if (key && host && !(await excluded(tag?.dataset.posthogIgnore))) {
  const start = () => {
    void import("./analytics-sdk.ts")
      .then(({ initializeAnalytics }) =>
        initializeAnalytics(key, host, tag?.dataset.posthogDebug === "true"),
      )
      .catch(() => {});
  };
  afterPageLoad(start);
}

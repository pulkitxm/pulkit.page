import posthog from "posthog-js";

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
  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    debug: tag?.dataset.posthogDebug === "true",
  });
  Object.assign(globalThis, { posthog });
}

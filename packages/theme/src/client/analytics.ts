import posthog from "posthog-js";

const tag = document.querySelector<HTMLScriptElement>("script[data-posthog-key]");
const key = tag?.dataset.posthogKey;
const host = tag?.dataset.posthogHost;

if (key && host) {
  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    debug: tag?.dataset.posthogDebug === "true",
  });
}

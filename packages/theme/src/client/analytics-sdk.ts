import posthog from "posthog-js";

export function initializeAnalytics(key: string, host: string, debug: boolean): void {
  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    disable_surveys: true,
    advanced_disable_feature_flags: true,
    disable_external_dependency_loading: true,
    debug,
  });
  Object.assign(globalThis, { posthog });
}

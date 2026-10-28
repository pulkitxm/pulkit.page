import type { SiteLink, SiteMount } from "../types.ts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSiteLink(value: unknown): value is SiteLink {
  return isRecord(value) && typeof value.label === "string" && typeof value.href === "string";
}

export function isSiteLinkArray(value: unknown): value is SiteLink[] {
  return Array.isArray(value) && value.every(isSiteLink);
}

function isSiteMount(value: unknown): value is SiteMount {
  return (
    isRecord(value) &&
    typeof value.site === "string" &&
    typeof value.route === "string" &&
    /^\/(?:[a-z0-9-]+\/)*$/.test(value.route)
  );
}

export function isSiteMountArray(value: unknown): value is SiteMount[] {
  return Array.isArray(value) && value.every(isSiteMount);
}

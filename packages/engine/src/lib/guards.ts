import type { SiteLink } from "../types.ts";

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

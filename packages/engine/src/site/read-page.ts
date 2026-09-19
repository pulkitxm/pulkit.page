import { splitFrontmatter, textFields } from "@pulkit/shared/frontmatter";
import { parse } from "yaml";
import { isRecord, isSiteLinkArray, isStringArray } from "../lib/guards.ts";
import type { PageMetadata, SiteLink, SiteSettings } from "../types.ts";

interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
}

interface PageSource {
  metadata: PageMetadata;
  body: string;
}

const optionalPageText = [
  "description",
  "layout",
  "date",
  "role",
  "period",
  "endDate",
  "icon",
  "darkIcon",
  "secondaryIcon",
] as const;

const siteText = ["brand", "description", "copyright", "articles"] as const;

export function readFrontmatter(source: string): Frontmatter {
  const frontmatter = splitFrontmatter(source, { crlf: true });
  if (!frontmatter) {
    throw new Error("Markdown must start with YAML frontmatter");
  }
  const data: unknown = parse(frontmatter.yaml);
  if (!isRecord(data)) {
    throw new Error("YAML frontmatter must be a mapping");
  }
  for (const field of textFields) {
    const value = data[field];
    if (value !== undefined && (typeof value !== "string" || !value.trim())) {
      throw new Error(`${field} must be a nonempty string`);
    }
  }
  return { data, body: frontmatter.body };
}

function text(data: Record<string, unknown>, field: string): string | undefined {
  const value = data[field];
  return typeof value === "string" ? value : undefined;
}

function links(data: Record<string, unknown>, field: string): SiteLink[] | undefined {
  const value = data[field];
  if (value === undefined) {
    return;
  }
  if (!isSiteLinkArray(value)) {
    throw new Error(`${field} must be a list of links with a label and href`);
  }
  return value;
}

function pageMetadata(data: Record<string, unknown>): PageMetadata {
  const title = text(data, "title");
  if (title === undefined) {
    throw new Error("title must be a nonempty string");
  }
  const metadata: PageMetadata = { title };
  for (const field of optionalPageText) {
    const value = text(data, field);
    if (value !== undefined) {
      metadata[field] = value;
    }
  }
  const { tags } = data;
  if (tags !== undefined) {
    if (!isStringArray(tags)) {
      throw new Error("tags must be a list of strings");
    }
    metadata.tags = tags;
  }
  return metadata;
}

export function siteSettings(data: Record<string, unknown>): SiteSettings {
  const settings: SiteSettings = {};
  for (const field of siteText) {
    const value = text(data, field);
    if (value !== undefined) {
      settings[field] = value;
    }
  }
  const navigation = links(data, "navigation");
  if (navigation) {
    settings.navigation = navigation;
  }
  const social = links(data, "social");
  if (social) {
    settings.social = social;
  }
  return settings;
}

export function readPage(source: string): PageSource {
  const { data, body } = readFrontmatter(source);
  return { metadata: pageMetadata(data), body };
}

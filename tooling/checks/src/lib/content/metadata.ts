import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  pageFields,
  requiredSiteFields,
  siteConfigFile,
  siteFields,
  splitFrontmatter,
} from "@pulkit/shared/frontmatter";
import { repositoryRoot } from "@pulkit/shared/repository";
import { isRecord, yamlValue } from "./yaml.ts";

export const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const articleRoots = new Map<string, string | undefined>();

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function articleRoot(root: string): string | undefined {
  if (!articleRoots.has(root)) {
    const path = join(repositoryRoot, root, siteConfigFile);
    const front = existsSync(path) ? splitFrontmatter(readFileSync(path, "utf8")) : undefined;
    const config = front ? yamlValue(front.yaml) : undefined;
    const articles = isRecord(config) ? config.articles : undefined;
    articleRoots.set(root, typeof articles === "string" ? articles : undefined);
  }
  return articleRoots.get(root);
}

function isRealDate(value: unknown): boolean {
  const text = String(value);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(text) &&
    !Number.isNaN(Date.parse(text)) &&
    new Date(text).toISOString().slice(0, 10) === value
  );
}

function requiredFields(site: boolean, file: string, root: string): string[] {
  const required: string[] = site ? [...requiredSiteFields] : ["title", "description"];
  const articles = articleRoot(root);
  const route = `/${file.slice(8, -3).replace(/(?:^|\/)index$/, "")}/`.replace(/\/+/g, "/");
  if (
    !site &&
    !file.endsWith("/index.md") &&
    file !== "content/home.md" &&
    ((articles && route.startsWith(articles)) || file.startsWith("content/exp/"))
  ) {
    required.push("date");
  }
  if (file.startsWith("content/exp/") && !file.endsWith("/index.md")) {
    required.push("role", "period");
  }
  return required;
}

function linkErrors(field: string, links: unknown): string[] {
  if (!Array.isArray(links) || links.length === 0) {
    return [`${field} must be a nonempty list`];
  }
  const entries: unknown[] = links;
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const link of entries) {
    if (
      !isRecord(link) ||
      Object.keys(link).sort().join(",") !== "href,label" ||
      !isText(link.label) ||
      !isText(link.href) ||
      !/^(?:\/(?!\/)|https:\/\/|mailto:)/.test(link.href)
    ) {
      errors.push(`${field} entries require only label and a safe href`);
    } else if (seen.has(link.href)) {
      errors.push(`duplicate ${field} link: ${link.href}`);
    } else {
      seen.add(link.href);
    }
  }
  return errors;
}

function valueErrors(
  data: Record<string, unknown>,
  fields: readonly string[],
  root: string,
): string[] {
  const errors: string[] = [];
  for (const field of fields.filter((key) => !["tags", "navigation", "social"].includes(key))) {
    if (data[field] !== undefined && !isText(data[field])) {
      errors.push(`${field} must be a trimmed, nonempty string`);
    }
  }
  if (data.articles !== undefined && !/^\/(?:[a-z0-9-]+\/)*$/.test(String(data.articles))) {
    errors.push("articles must be a root-relative directory such as / or /notes/");
  }
  if (typeof data.title === "string" && data.title.length > 120) {
    errors.push("title must be at most 120 characters");
  }
  if (typeof data.description === "string" && data.description.length > 320) {
    errors.push("description must be at most 320 characters");
  }
  const layout = data.layout;
  if (
    layout &&
    (!slug.test(String(layout)) ||
      !existsSync(join(repositoryRoot, "packages/theme/layouts", `${String(layout)}.html`)))
  ) {
    errors.push("layout must name an existing layout");
  }
  for (const field of ["date", "endDate"]) {
    if (data[field] && !isRealDate(data[field])) {
      errors.push(`${field} must be a real YYYY-MM-DD date`);
    }
  }
  if (data.endDate && (!data.date || String(data.endDate) < String(data.date))) {
    errors.push("endDate must be on or after date");
  }
  for (const field of ["icon", "darkIcon", "secondaryIcon"]) {
    const icon = data[field];
    if (
      icon &&
      (!/^\/assets\/exp\/[a-z0-9-]+\.(webp|svg)$/.test(String(icon)) ||
        !existsSync(join(repositoryRoot, root || "apps/page/", String(icon).slice(1))))
    ) {
      errors.push(`${field} must reference an existing experience icon`);
    }
  }
  return errors;
}

function tagErrors(tags: unknown): string[] {
  if (tags === undefined) {
    return [];
  }
  const list: unknown[] = Array.isArray(tags) ? tags : [];
  return !Array.isArray(tags) ||
    list.length === 0 ||
    !list.every(isText) ||
    new Set(list).size !== list.length
    ? ["tags must be a nonempty list of unique trimmed strings"]
    : [];
}

export function metadataErrors(data: unknown, file: string, root: string): string[] {
  if (!isRecord(data)) {
    return ["frontmatter must be a YAML mapping"];
  }
  const site = file === siteConfigFile;
  const fields: readonly string[] = site ? siteFields : pageFields;
  const errors = Object.keys(data)
    .filter((field) => !fields.includes(field))
    .map((field) => `unknown metadata field: ${field}`);
  for (const field of requiredFields(site, file, root)) {
    if (data[field] === undefined) {
      errors.push(`missing required metadata: ${field}`);
    }
  }
  errors.push(...valueErrors(data, fields, root), ...tagErrors(data.tags));
  for (const field of ["navigation", "social"]) {
    if (data[field] !== undefined) {
      errors.push(...linkErrors(field, data[field]));
    }
  }
  return errors;
}

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { themeFile } from "@pulkit/theme/files";
import { resolveAnalytics } from "../site/analytics.ts";
import type { Layouts } from "../types.ts";

const placeholderNames = [
  "title",
  "description",
  "brand",
  "navigation",
  "copyright",
  "markdown",
  "social",
  "heading",
  "content",
  "date",
  "seo",
  "breadcrumbs",
  "related",
  "author",
  "authorUrl",
  "themeScript",
  "analyticsScript",
] as const;

type Placeholder = (typeof placeholderNames)[number];

export type LayoutValues = Readonly<Record<Placeholder, string>>;

const allowed: ReadonlySet<string> = new Set(placeholderNames);

function isPlaceholder(name: string): name is Placeholder {
  return allowed.has(name);
}

function readTemplates(directory: string): Layouts {
  const templates: Layouts = new Map();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === "partials") {
      continue;
    }
    if (!entry.isFile() || !/^[a-z][a-zA-Z0-9-]*\.html$/.test(entry.name)) {
      throw new Error(`Invalid template path: ${join(directory, entry.name)}`);
    }
    templates.set(entry.name.slice(0, -5), readFileSync(join(directory, entry.name), "utf8"));
  }
  return templates;
}

let themeSource: string | undefined;

export function themeScript(): string {
  themeSource ??= `<script>${new Bun.Transpiler({ loader: "ts" })
    .transformSync(readFileSync(themeFile("src/client/theme.ts"), "utf8"))
    .trim()}</script>`;
  return themeSource;
}

let analyticsTag: string | undefined;

export function analyticsScript(): string {
  if (analyticsTag === undefined) {
    const analytics = resolveAnalytics();
    const debug = analytics?.debug ? ' data-posthog-debug="true"' : "";
    const ignore = analytics?.ignore ? ` data-posthog-ignore="${analytics.ignore}"` : "";
    analyticsTag = analytics
      ? `<script type="module" src="/assets/analytics.js" data-posthog-key="${analytics.key}" data-posthog-host="${analytics.host}"${ignore}${debug}></script>`
      : "";
  }
  return analyticsTag;
}

export function layoutDirectory(): string {
  return existsSync("layouts") ? "layouts" : themeFile("layouts");
}

function countOf(template: string, pattern: RegExp): number {
  return (template.match(pattern) ?? []).length;
}

export function loadLayouts(directory: string = layoutDirectory()): Layouts {
  const layouts = readTemplates(directory);
  const partials = readTemplates(join(directory, "partials"));
  function expand(template: string, stack: readonly string[]): string {
    const expanded = template.replace(/{{\s*>\s*([a-z][a-zA-Z0-9-]*)\s*}}/g, (_, name: string) => {
      const partial = partials.get(name);
      if (partial === undefined) {
        throw new Error(`Missing partial: ${name}`);
      }
      if (stack.includes(name)) {
        throw new Error(`Circular partial: ${[...stack, name].join(" -> ")}`);
      }
      return expand(partial, [...stack, name]);
    });
    const remainder = expanded.replace(/{{\s*([a-z][a-zA-Z0-9-]*)\s*}}/g, (token, name: string) => {
      if (!isPlaceholder(name)) {
        throw new Error(`Unknown template placeholder: ${token}`);
      }
      return "";
    });
    if (remainder.includes("{{") || remainder.includes("}}")) {
      throw new Error("Malformed template placeholder");
    }
    return expanded;
  }
  for (const [name, template] of partials) {
    expand(template, [name]);
  }
  for (const [name, template] of layouts) {
    const expanded = expand(template, []);
    if (countOf(expanded, /{{\s*content\s*}}/g) !== 1) {
      throw new Error(`Layout ${name} must contain exactly one {{content}} placeholder`);
    }
    if (countOf(expanded, /{{\s*heading\s*}}/g) !== 1) {
      throw new Error(`Layout ${name} must contain exactly one {{heading}} placeholder`);
    }
    layouts.set(name, expanded);
  }
  if (layouts.size === 0) {
    throw new Error("No HTML layouts found");
  }
  return layouts;
}

export function applyLayout(layouts: Layouts, name: string, values: LayoutValues): string {
  const layout = layouts.get(name);
  if (layout === undefined) {
    throw new Error(`Missing or unknown layout: ${name}`);
  }
  return layout.replace(/{{\s*([a-z][a-zA-Z0-9-]*)\s*}}/g, (_, key: string) => {
    if (!(isPlaceholder(key) && Object.hasOwn(values, key))) {
      throw new Error(`Missing template value: ${key}`);
    }
    return values[key];
  });
}

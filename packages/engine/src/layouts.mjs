import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const placeholderNames = [
  "title",
  "description",
  "brand",
  "navigation",
  "copyright",
  "social",
  "heading",
  "content",
  "date",
  "seo",
  "breadcrumbs",
  "related",
  "author",
  "authorUrl",
];
const allowed = new Set(placeholderNames);

function readTemplates(directory) {
  const templates = new Map();
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

export function loadLayouts(directory = "layouts") {
  const layouts = readTemplates(directory);
  const partials = readTemplates(join(directory, "partials"));
  function expand(template, stack) {
    const expanded = template.replace(/{{\s*>\s*([a-z][a-zA-Z0-9-]*)\s*}}/g, (_, name) => {
      if (!partials.has(name)) {
        throw new Error(`Missing partial: ${name}`);
      }
      if (stack.includes(name)) {
        throw new Error(`Circular partial: ${[...stack, name].join(" -> ")}`);
      }
      return expand(partials.get(name), [...stack, name]);
    });
    const remainder = expanded.replace(/{{\s*([a-z][a-zA-Z0-9-]*)\s*}}/g, (token, name) => {
      if (!allowed.has(name)) {
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
    if ((expanded.match(/{{\s*content\s*}}/g) ?? []).length !== 1) {
      throw new Error(`Layout ${name} must contain exactly one {{content}} placeholder`);
    }
    if ((expanded.match(/{{\s*heading\s*}}/g) ?? []).length !== 1) {
      throw new Error(`Layout ${name} must contain exactly one {{heading}} placeholder`);
    }
    layouts.set(name, expanded);
  }
  if (layouts.size === 0) {
    throw new Error("No HTML layouts found");
  }
  return layouts;
}

export function applyLayout(layouts, name, values) {
  if (typeof name !== "string" || !layouts.has(name)) {
    throw new Error(`Missing or unknown layout: ${String(name)}`);
  }
  return layouts.get(name).replace(/{{\s*([a-z][a-zA-Z0-9-]*)\s*}}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) {
      throw new Error(`Missing template value: ${key}`);
    }
    return values[key];
  });
}

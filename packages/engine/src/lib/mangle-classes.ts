import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { builtFiles } from "@pulkit/shared/built-site";
import { unescapeHtml } from "@pulkit/shared/html";
import { transform } from "lightningcss";
import { isRecord } from "./guards.ts";

const shadowAssets = /^assets\/demos\/(?!document\.css$)/;

type Rename = (name: string) => string;

export interface MangleResult {
  renamed: number;
  kept: number;
}

export function shortName(index: number): string {
  const letter = String.fromCharCode(97 + (index % 26));
  return index < 26 ? letter : `${letter}${(Math.floor(index / 26) - 1).toString(36)}`;
}

function renameClassesIn(value: unknown, rename: Rename): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      renameClassesIn(item, rename);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  if (value.type === "class" && typeof value.name === "string") {
    value.name = rename(value.name);
    return;
  }
  for (const item of Object.values(value)) {
    renameClassesIn(item, rename);
  }
}

function visitClasses(css: string, filename: string, rename: Rename): string {
  return transform({
    filename,
    code: Buffer.from(css),
    minify: true,
    visitor: {
      Selector(selector) {
        renameClassesIn(selector, rename);
        return selector;
      },
    },
  }).code.toString();
}

function stylesheetClasses(css: string, filename: string): Set<string> {
  const classes = new Set<string>();
  visitClasses(css, filename, (name) => {
    classes.add(name);
    return name;
  });
  return classes;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function referencedIn(scripts: string, name: string): boolean {
  return new RegExp(`(?<![\\w-])${escapeRegExp(name)}(?![\\w-])`).test(scripts);
}

export function renameHtmlClasses(html: string, names: ReadonlyMap<string, string>): string {
  return html
    .split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->)/)
    .map((segment, index) =>
      index % 2 === 1
        ? segment
        : segment.replace(
            /(\sclass=")([^"]*)(")/g,
            (_, open: string, value: string, close: string) =>
              `${open}${value.replace(/\S+/g, (token) => names.get(unescapeHtml(token)) ?? token)}${close}`,
          ),
    )
    .join("");
}

function filesIn(directory: string, extension: string): string[] {
  return builtFiles(directory)
    .filter((path) => path.endsWith(extension))
    .map((path) => relative(directory, path))
    .filter((path) => !shadowAssets.test(path));
}

export function mangleClasses(directory: string, stylesheet: string): MangleResult {
  const stylesheetPath = join(directory, stylesheet);
  const kept = new Set<string>();
  for (const name of filesIn(directory, ".css")) {
    if (name !== stylesheet) {
      for (const className of stylesheetClasses(
        readFileSync(join(directory, name), "utf8"),
        name,
      )) {
        kept.add(className);
      }
    }
  }
  const scripts = filesIn(directory, ".js")
    .map((name) => readFileSync(join(directory, name), "utf8"))
    .join("\n");
  const htmlFiles = filesIn(directory, ".html").map((name) => join(directory, name));
  const pages = htmlFiles.map((path) => ({ path, html: readFileSync(path, "utf8") }));
  const taken = new Set(kept);
  for (const { html } of pages) {
    for (const [, value = ""] of html.matchAll(/\sclass="([^"]*)"/g)) {
      for (const token of unescapeHtml(value).split(/\s+/)) {
        taken.add(token);
      }
    }
  }
  const source = readFileSync(stylesheetPath, "utf8");
  const names = new Map<string, string>();
  let next = 0;
  const classes = stylesheetClasses(source, stylesheet);
  for (const className of classes) {
    taken.add(className);
    if (kept.has(className) || referencedIn(scripts, className)) {
      kept.add(className);
    } else {
      names.set(className, "");
    }
  }
  for (const className of names.keys()) {
    let name = shortName(next++);
    while (taken.has(name)) {
      name = shortName(next++);
    }
    names.set(className, name);
  }
  const css = visitClasses(source, stylesheet, (className) => names.get(className) ?? className);
  writeFileSync(stylesheetPath, css);
  for (const { path, html } of pages) {
    writeFileSync(path, renameHtmlClasses(html, names));
  }
  return { renamed: names.size, kept: classes.size - names.size };
}

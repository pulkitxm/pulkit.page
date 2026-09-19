import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { transform } from "lightningcss";

const shadowAssets = /^assets\/demos\/(?!document\.css$)/;
const entities = { amp: "&", quot: '"', "#39": "'", lt: "<", gt: ">" };

export function shortName(index) {
  const letter = String.fromCharCode(97 + (index % 26));
  return index < 26 ? letter : `${letter}${(Math.floor(index / 26) - 1).toString(36)}`;
}

function renameSelector(value, rename) {
  if (Array.isArray(value)) {
    return value.map((item) => renameSelector(item, rename));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (value.type === "class") {
    return { ...value, name: rename(value.name) };
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, renameSelector(item, rename)]),
  );
}

function visitClasses(css, filename, rename) {
  return transform({
    filename,
    code: Buffer.from(css),
    minify: true,
    visitor: {
      Selector(selector) {
        return renameSelector(selector, rename);
      },
    },
  }).code.toString();
}

function stylesheetClasses(css, filename) {
  const classes = new Set();
  visitClasses(css, filename, (name) => {
    classes.add(name);
    return name;
  });
  return classes;
}

function decodeEntities(value) {
  return value.replace(/&(amp|quot|#39|lt|gt);/g, (_, entity) => entities[entity]);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function referencedIn(scripts, name) {
  return new RegExp(`(?<![\\w-])${escapeRegExp(name)}(?![\\w-])`).test(scripts);
}

export function renameHtmlClasses(html, names) {
  return html
    .split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->)/)
    .map((segment, index) =>
      index % 2 === 1
        ? segment
        : segment.replace(
            /(\sclass=")([^"]*)(")/g,
            (_, open, value, close) =>
              `${open}${value.replace(/\S+/g, (token) => names.get(decodeEntities(token)) ?? token)}${close}`,
          ),
    )
    .join("");
}

function filesIn(directory, extension) {
  return readdirSync(directory, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)))
    .filter((path) => !/^dev-[0-9]+\//.test(path) && !shadowAssets.test(path));
}

export function mangleClasses(directory, stylesheet) {
  const stylesheetPath = join(directory, stylesheet);
  const kept = new Set();
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
  const pages = htmlFiles.map((path) => readFileSync(path, "utf8"));
  const taken = new Set(kept);
  for (const page of pages) {
    for (const [, value] of page.matchAll(/\sclass="([^"]*)"/g)) {
      for (const token of decodeEntities(value).split(/\s+/)) {
        taken.add(token);
      }
    }
  }
  const source = readFileSync(stylesheetPath, "utf8");
  const names = new Map();
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
  htmlFiles.forEach((path, index) => {
    writeFileSync(path, renameHtmlClasses(pages[index], names));
  });
  return { renamed: names.size, kept: classes.size - names.size };
}

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import process from "node:process";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { parseDocument, stringify, visit } from "yaml";
import { createPageAssets, matchBlockEmbed, matchInlineEmbed, renderRawHtml } from "./embeds.mjs";

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkStringify, {
  bullet: "-",
  emphasis: "*",
  strong: "*",
  fence: "`",
  fences: true,
  listItemIndent: "one",
  rule: "-",
  ruleRepetition: 3,
});
const pageFields = [
  "title",
  "description",
  "layout",
  "date",
  "role",
  "period",
  "endDate",
  "icon",
  "secondaryIcon",
  "tags",
];
const siteFields = ["brand", "description", "copyright", "navigation", "social"];
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isText = (value) => typeof value === "string" && value.length > 0 && value === value.trim();

function yaml(source) {
  const document = parseDocument(source, { uniqueKeys: true, strict: true });
  const errors = [...document.errors, ...document.warnings].map((error) => error.message);
  visit(document, (_, node) => {
    if (node?.anchor || node?.tag || node?.constructor?.name === "Alias") {
      errors.push("YAML aliases, anchors, and explicit tags are forbidden");
    }
  });
  if (errors.length) {
    throw new Error(errors.join("; "));
  }
  return { value: document.toJS({ maxAliasCount: 0 }), errors };
}

function metadataErrors(data, file) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["frontmatter must be a YAML mapping"];
  }
  const errors = [];
  const site = file === "content/_site.md";
  const fields = site ? siteFields : pageFields;
  for (const field of Object.keys(data)) {
    if (!fields.includes(field)) {
      errors.push(`unknown metadata field: ${field}`);
    }
  }
  const required = site ? siteFields : ["title", "description"];
  if (/^content\/(blogs|exp)\//.test(file) && !file.endsWith("/index.md")) {
    required.push("date");
  }
  if (file.startsWith("content/exp/") && !file.endsWith("/index.md")) {
    required.push("role", "period");
  }
  for (const field of required) {
    if (data[field] === undefined) {
      errors.push(`missing required metadata: ${field}`);
    }
  }
  for (const field of fields.filter((key) => !["tags", "navigation", "social"].includes(key))) {
    if (data[field] !== undefined && !isText(data[field])) {
      errors.push(`${field} must be a trimmed, nonempty string`);
    }
  }
  if (data.title?.length > 120) {
    errors.push("title must be at most 120 characters");
  }
  if (data.description?.length > 320) {
    errors.push("description must be at most 320 characters");
  }
  if (data.layout && (!slug.test(data.layout) || !existsSync(`layouts/${data.layout}.html`))) {
    errors.push("layout must name an existing layout");
  }
  for (const field of ["date", "endDate"]) {
    if (
      data[field] &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(data[field]) ||
        Number.isNaN(Date.parse(data[field])) ||
        new Date(data[field]).toISOString().slice(0, 10) !== data[field])
    ) {
      errors.push(`${field} must be a real YYYY-MM-DD date`);
    }
  }
  if (data.endDate && (!data.date || data.endDate < data.date)) {
    errors.push("endDate must be on or after date");
  }
  for (const field of ["icon", "secondaryIcon"]) {
    if (
      data[field] &&
      (!/^\/assets\/exp\/[a-z0-9-]+\.(webp|svg)$/.test(data[field]) ||
        !existsSync(data[field].slice(1)))
    ) {
      errors.push(`${field} must reference an existing experience icon`);
    }
  }
  if (
    data.tags !== undefined &&
    (!Array.isArray(data.tags) ||
      !data.tags.length ||
      !data.tags.every(isText) ||
      new Set(data.tags).size !== data.tags.length)
  ) {
    errors.push("tags must be a nonempty list of unique trimmed strings");
  }
  for (const field of ["navigation", "social"]) {
    if (data[field] === undefined) {
      continue;
    }
    const links = data[field];
    if (!Array.isArray(links) || !links.length) {
      errors.push(`${field} must be a nonempty list`);
      continue;
    }
    const seen = new Set();
    for (const link of links) {
      if (
        !link ||
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
  }
  return errors;
}

export function checkContent(file, source) {
  const errors = [];
  const fail = (message, node) => errors.push(`${node?.position?.start?.line ?? 1}: ${message}`);
  if (source.startsWith("\uFEFF")) {
    fail("UTF-8 BOM is forbidden");
  }
  if (source.includes("\r")) {
    fail("use LF line endings");
  }
  if (!source.endsWith("\n") || source.endsWith("\n\n")) {
    fail("end with exactly one newline");
  }
  if ([...file].some((character) => character.codePointAt(0) > 127)) {
    fail("filenames must be ASCII");
  }
  const page = file.startsWith("content/");
  if (
    page &&
    file !== "content/_site.md" &&
    (!file.endsWith(".md") ||
      !file
        .slice(8, -3)
        .split("/")
        .every((part) => slug.test(part)))
  ) {
    fail("content paths must use lowercase kebab-case and .md");
  }
  if (file === "content/index.md") {
    fail("use content/home.md for the homepage");
  }
  if (
    !page &&
    file.endsWith(".md") &&
    file !== "README.md" &&
    !file
      .replace(/\.md$/, "")
      .split("/")
      .every((part) => slug.test(part))
  ) {
    fail("documentation paths must use lowercase kebab-case (except README.md)");
  }
  if ([".yml", ".yaml"].includes(extname(file))) {
    const parsed = yaml(source);
    errors.push(...parsed.errors);
    return { errors, formatted: stringify(parsed.value, { lineWidth: 100 }) };
  }
  let body = source;
  let front = "";
  if (page) {
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source);
    if (!match) {
      return { errors: [...errors, "1: page requires YAML frontmatter"], formatted: source };
    }
    const parsed = yaml(match[1]);
    errors.push(...parsed.errors, ...metadataErrors(parsed.value, file));
    front = `---\n${stringify(parsed.value, { lineWidth: 100 })}---\n`;
    body = match[2];
  }
  const embeds = [];
  body = body.replace(/^:::embed [^\n]*\n[^\n]*\n:::$/gm, (block) => {
    if (!matchBlockEmbed(`${block}\n`)) {
      errors.push(`invalid embed block: ${block.slice(0, 60)}`);
    }
    embeds.push(block);
    return `EMBEDTOKEN${embeds.length - 1}X`;
  });
  let scan = body.indexOf(":embed[");
  while (scan !== -1) {
    let match;
    try {
      match = matchInlineEmbed(body.slice(scan));
    } catch (error) {
      errors.push(`invalid inline embed: ${error.message}`);
    }
    if (match) {
      embeds.push(match.raw);
      body = `${body.slice(0, scan)}EMBEDTOKEN${embeds.length - 1}X${body.slice(scan + match.raw.length)}`;
    }
    scan = body.indexOf(":embed[", scan + 1);
  }
  const tree = markdown.parse(body);
  let topHeadings = 0;
  const headings = new Set();
  const definitions = new Set();
  const references = [];
  function walk(node) {
    if (node.type === "html") {
      try {
        renderRawHtml(node.value, createPageAssets());
      } catch (error) {
        fail(`raw HTML: ${error.message}`, node);
      }
    }
    if (node.type === "heading") {
      if (node.depth === 1) {
        topHeadings++;
      }
      if (page && node.depth === 1) {
        fail("page H1 comes from title; start body headings at ##", node);
      }
      const label = sourceText(node).toLowerCase();
      if (headings.has(label)) {
        fail(`duplicate heading: ${label}`, node);
      }
      headings.add(label);
    }
    if (
      node.type === "code" &&
      (!node.lang || !/^[a-z][a-z0-9+#-]*$/.test(node.lang) || node.meta)
    ) {
      fail("code fences need a lowercase language and no extra metadata", node);
    }
    if (node.type === "link" && !sourceText(node).trim()) {
      fail("links require descriptive text", node);
    }
    if (node.type === "link" || node.type === "image" || node.type === "definition") {
      if (
        !node.url ||
        /^(?:javascript|data|file|vbscript):/i.test(node.url) ||
        node.url.startsWith("//")
      ) {
        fail("unsafe or empty URL", node);
      }
      if (page && node.url && !/^(?:https?:\/\/|mailto:|\/(?!\/)|#)/.test(node.url)) {
        fail("page links must be root-relative, HTTPS/HTTP, mailto, or fragments", node);
      }
      if (node.url?.startsWith("/blogs/") || node.url?.startsWith("/exp/")) {
        if (!node.url.split(/[?#]/)[0].endsWith("/")) {
          fail("page URLs must end with /", node);
        }
      }
    }
    if (node.type === "definition") {
      if (definitions.has(node.identifier)) {
        fail("duplicate link definition", node);
      }
      definitions.add(node.identifier);
    }
    if (node.type === "linkReference" || node.type === "imageReference") {
      references.push(node);
    }
    if (node.type === "paragraph" && sourceText(node).includes(":::")) {
      const text = sourceText(node);
      if (
        !/^(?::::list [a-z0-9]+(?:[-/][a-z0-9]+)*(?: limit=[1-9][0-9]*)?|:::carousel|:::)$/.test(
          text,
        ) &&
        !/^:::demo [a-z0-9]+(?:-[a-z0-9]+)*(?: [a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(text) &&
        !/^EMBEDTOKEN\d+X$/.test(text)
      ) {
        fail("invalid or embedded directive", node);
      }
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  }
  walk(tree);
  for (const node of references) {
    if (!definitions.has(node.identifier)) {
      fail(`undefined link reference: ${node.identifier}`, node);
    }
  }
  if (!page && topHeadings !== 1) {
    fail("documentation needs exactly one H1");
  }
  if (file === "content/_site.md" && body.trim()) {
    fail("shared site configuration must not contain a body");
  }
  if (page && file !== "content/_site.md" && !body.trim()) {
    fail("page body must not be empty");
  }
  const formatted = (
    front + (tree.children.length ? `${front ? "\n" : ""}${markdown.stringify(tree)}` : "")
  ).replace(/EMBEDTOKEN(\d+)X/g, (_, index) => embeds[Number(index)]);
  return { errors, formatted };
}

function sourceText(node) {
  return node.value ?? node.alt ?? node.children?.map(sourceText).join("") ?? "";
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--write") || args.length > 1) {
    throw new Error("Usage: check-content.mjs [--write]");
  }
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--deduplicate", "-z"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(
      (file) =>
        file &&
        existsSync(file) &&
        !file.startsWith("pages/") &&
        (/\.(md|mdx|ya?ml)$/i.test(file) || file.startsWith("content/")),
    );
  const failures = [];
  for (const file of files) {
    try {
      const source = readFileSync(file, "utf8");
      const { errors, formatted } = checkContent(file, source);
      failures.push(...errors.map((error) => `${file}:${error}`));
      if (formatted !== source) {
        if (args.includes("--write") && !errors.length) {
          writeFileSync(file, formatted);
        } else {
          failures.push(`${file}: noncanonical formatting; run bun run format`);
        }
      }
    } catch (error) {
      failures.push(`${file}: ${error.message}`);
    }
  }
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(`Validated ${files.length} Markdown/YAML files and content conventions`);
}

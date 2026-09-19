import { extname } from "node:path";
import { matchBlockEmbed, matchInlineEmbed } from "@pulkit/embeds";
import { errorMessage } from "@pulkit/shared/failures";
import { siteConfigFile, splitFrontmatter } from "@pulkit/shared/frontmatter";
import { markdownProcessor } from "@pulkit/shared/markdown";
import { stringify } from "yaml";
import type { Fail, MarkdownNode } from "./markdown-rules.ts";
import { walkMarkdown } from "./markdown-rules.ts";
import { metadataErrors, slug } from "./metadata.ts";
import { strictYaml } from "./yaml.ts";

interface ContentResult {
  errors: string[];
  formatted: string;
}

interface SitePath {
  root: string;
  file: string;
}

interface Tokenized {
  body: string;
  embeds: string[];
}

const siteRoot = /^((?:apps\/[a-z0-9-]+|packages\/[a-z0-9-]+\/test\/fixture)\/)(content\/.*)$/;

export function sitePath(path: string): SitePath {
  const match = siteRoot.exec(path);
  return match ? { root: match[1] ?? "", file: match[2] ?? "" } : { root: "", file: path };
}

function pathErrors(source: string, file: string, page: boolean, fail: Fail): void {
  if (source.startsWith("\uFEFF")) {
    fail("UTF-8 BOM is forbidden");
  }
  if (source.includes("\r")) {
    fail("use LF line endings");
  }
  if (!source.endsWith("\n") || source.endsWith("\n\n")) {
    fail("end with exactly one newline");
  }
  if ([...file].some((character) => (character.codePointAt(0) ?? 0) > 127)) {
    fail("filenames must be ASCII");
  }
  const kebab = (path: string) => path.split("/").every((part) => slug.test(part));
  if (page && file !== siteConfigFile && (!file.endsWith(".md") || !kebab(file.slice(8, -3)))) {
    fail("content paths must use lowercase kebab-case and .md");
  }
  if (file === "content/index.md") {
    fail("use content/home.md for the homepage");
  }
  if (!page && file.endsWith(".md") && file !== "README.md" && !kebab(file.replace(/\.md$/, ""))) {
    fail("documentation paths must use lowercase kebab-case (except README.md)");
  }
}

function tokenizeEmbeds(source: string, errors: string[]): Tokenized {
  const embeds: string[] = [];
  let body = source.replace(/^:::embed [^\n]*\n[^\n]*\n:::$/gm, (block) => {
    if (!matchBlockEmbed(`${block}\n`)) {
      errors.push(`invalid embed block: ${block.slice(0, 60)}`);
    }
    embeds.push(block);
    return `EMBEDTOKEN${embeds.length - 1}X`;
  });
  let scan = body.indexOf(":embed[");
  while (scan !== -1) {
    let match: { raw: string } | undefined;
    try {
      match = matchInlineEmbed(body.slice(scan));
    } catch (error) {
      errors.push(`invalid inline embed: ${errorMessage(error)}`);
    }
    if (match) {
      embeds.push(match.raw);
      body = `${body.slice(0, scan)}EMBEDTOKEN${embeds.length - 1}X${body.slice(scan + match.raw.length)}`;
    }
    scan = body.indexOf(":embed[", scan + 1);
  }
  return { body, embeds };
}

export function checkContent(path: string, source: string): ContentResult {
  const { root, file } = sitePath(path);
  const errors: string[] = [];
  const fail: Fail = (message, node) => {
    errors.push(`${node?.position?.start.line ?? 1}: ${message}`);
  };
  const page = file.startsWith("content/");
  pathErrors(source, file, page, fail);
  if ([".yml", ".yaml"].includes(extname(file))) {
    const parsed = strictYaml(source);
    errors.push(...parsed.errors);
    return { errors, formatted: stringify(parsed.value, { lineWidth: 100 }) };
  }
  let body = source;
  let front = "";
  if (page) {
    const frontmatter = splitFrontmatter(source);
    if (!frontmatter) {
      return { errors: [...errors, "1: page requires YAML frontmatter"], formatted: source };
    }
    const parsed = strictYaml(frontmatter.yaml);
    errors.push(...parsed.errors, ...metadataErrors(parsed.value, file, root));
    front = `---\n${stringify(parsed.value, { lineWidth: 100 })}---\n`;
    body = frontmatter.body;
  }
  const tokenized = tokenizeEmbeds(body, errors);
  const tree = markdownProcessor.parse(tokenized.body);
  const markdownTree: MarkdownNode = tree;
  const { topHeadings } = walkMarkdown(markdownTree, page, fail);
  if (!page && topHeadings !== 1) {
    fail("documentation needs exactly one H1");
  }
  if (file === siteConfigFile && tokenized.body.trim()) {
    fail("shared site configuration must not contain a body");
  }
  if (page && file !== siteConfigFile && !tokenized.body.trim()) {
    fail("page body must not be empty");
  }
  const formatted = (
    front +
    (tree.children.length > 0 ? `${front ? "\n" : ""}${markdownProcessor.stringify(tree)}` : "")
  ).replace(/EMBEDTOKEN(\d+)X/g, (_, index: string) => tokenized.embeds[Number(index)] ?? "");
  return { errors, formatted };
}

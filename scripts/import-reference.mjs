import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join } from "node:path";
import { parse as parseJavaScript } from "@babel/parser";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { parse, stringify } from "yaml";

const reference = "extras/pulkitxm.com";
const reader = unified().use(remarkParse).use(remarkGfm).use(remarkMdx);
const writer = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkStringify, { bullet: "-", fences: true });
const identifiers = new Map();
const report = { pages: [], assets: new Set(), components: {} };

function literal(node) {
  if (!node) {
    return null;
  }
  if (["Literal", "StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(node.type)) {
    return node.value;
  }
  if (node.type === "TemplateLiteral" && !node.expressions.length) {
    return node.quasis.map((part) => part.value.cooked).join("");
  }
  if (node.type === "Identifier" && identifiers.has(node.name)) {
    return identifiers.get(node.name);
  }
  if (node.type === "ArrayExpression") {
    return node.elements.map(literal);
  }
  if (node.type === "ObjectExpression") {
    return Object.fromEntries(
      node.properties.map((property) => [
        property.key.name ?? property.key.value,
        literal(property.value),
      ]),
    );
  }
  if (node.type === "TSAsExpression") {
    return literal(node.expression);
  }
  throw new Error(`Unsupported dynamic expression: ${node.type}`);
}

const assetTree = parseJavaScript(readFileSync(`${reference}/src/assets/index.ts`, "utf8"), {
  sourceType: "module",
  plugins: ["typescript"],
});
let assets;
for (const node of assetTree.program.body) {
  if (node.type === "ImportDeclaration") {
    for (const specifier of node.specifiers) {
      identifiers.set(specifier.local.name, node.source.value.replace("@/", `${reference}/src/`));
    }
  }
  if (node.type === "VariableDeclaration") {
    for (const declaration of node.declarations) {
      const value = literal(declaration.init);
      identifiers.set(declaration.id.name, value);
      if (declaration.id.name === "assets") {
        assets = value;
      }
    }
  }
}

const sourceFiles = readdirSync(`${reference}/content`, { recursive: true })
  .filter((file) => file.endsWith(".mdx"))
  .sort();
const routes = new Map();
for (const file of sourceFiles) {
  const path = file.replace(/^experiences\//, "experience/").replace(/\.mdx$/, "");
  const route = `/${path.replace(/\/index$/, "")}/`;
  if (file.startsWith("blogs/")) {
    routes.set(file.split("/").at(-1).replace(".mdx", ""), route);
  }
}

function linkUrl(value) {
  if (!value) {
    throw new Error("Missing URL in reference content");
  }
  if (value.startsWith("/") && /\.(mp4|pdf|webm)(?:[?#]|$)/.test(value)) {
    return `https://www.pulkit.page${value}`;
  }
  if (value.startsWith("/series/")) {
    return value.replace("/series/", "/blogs/").replace(/\/?$/, "/");
  }
  if (value.startsWith("/exp/") && !extname(value.split(/[?#]/)[0])) {
    return value.replace("/exp/", "/experience/").replace(/\/?$/, "/");
  }
  if (value === "/blogs" || value === "/contact" || value === "/about") {
    return `${value}/`;
  }
  const blog =
    /^(?:https?:\/\/(?:www\.)?(?:pulkit\.blog|pulkitxm\.com|pulkit\.page))?(?:\/blogs)?\/([^/#?]+)\/?$/.exec(
      value,
    );
  if (blog && routes.has(blog[1])) {
    return routes.get(blog[1]);
  }
  if (
    value.startsWith("/") &&
    !value.startsWith("/blogs/") &&
    !value.startsWith("/experience/") &&
    !["/about/", "/contact/", "/"].includes(value)
  ) {
    return `https://www.pulkit.page${value}`;
  }
  return value;
}

function imageUrl(value) {
  let path = value;
  if (/^https?:\/\//.test(value)) {
    return value;
  }
  if (!value.startsWith("/")) {
    path = value.split(".").reduce((object, key) => object?.[key], assets);
    if (!path) {
      throw new Error(`Unresolved reference image: ${value}`);
    }
  } else {
    path = `${reference}/public${value}`;
  }
  if (!existsSync(path)) {
    throw new Error(`Missing reference image: ${path}`);
  }
  const output = `assets/content/${path.replace(`${reference}/src/assets/`, "").replace(`${reference}/public/`, "public/")}`;
  mkdirSync(dirname(output), { recursive: true });
  copyFileSync(path, output);
  report.assets.add(output);
  return `/${output}`;
}
const text = (value) => ({ type: "text", value: String(value) });
const paragraph = (children) => ({
  type: "paragraph",
  children: typeof children === "string" ? [text(children)] : children,
});
const link = (label, url) => ({ type: "link", url: linkUrl(url), children: [text(label)] });
const image = (src, alt) => ({
  type: "image",
  url: imageUrl(src),
  alt: alt || "Illustration",
  title: null,
});

function convert(node, originalUrl) {
  if (node.type === "image") {
    return [{ ...node, url: imageUrl(node.url) }];
  }
  if (node.type === "link") {
    return [
      {
        ...node,
        url: linkUrl(node.url),
        children: node.children.flatMap((child) => convert(child, originalUrl)),
      },
    ];
  }
  if (node.type.startsWith("mdxJsx")) {
    const name = node.name;
    report.components[name] = (report.components[name] ?? 0) + 1;
    const attributes = Object.fromEntries(
      node.attributes.map((attribute) => [
        attribute.name,
        typeof attribute.value === "object" && attribute.value
          ? literal(attribute.value.data.estree.body[0].expression)
          : (attribute.value ?? true),
      ]),
    );
    const children = (node.children ?? []).flatMap((child) => convert(child, originalUrl));
    const inline = node.type === "mdxJsxTextElement";
    if (["DemoShowcase", "div", "center", "details", "small", "u"].includes(name)) {
      return children;
    }
    if (name === "summary") {
      return [{ type: "strong", children }];
    }
    if (name === "strong") {
      return [{ type: "strong", children }];
    }
    if (name === "code") {
      return [{ type: "inlineCode", value: children.map((child) => child.value ?? "").join("") }];
    }
    if (name === "br") {
      return [text(" ")];
    }
    if (name === "track") {
      return [];
    }
    if (name === "CmdKey") {
      return [{ type: "inlineCode", value: "⌘" }];
    }
    if (name === "CodeQuote") {
      return [{ type: "blockquote", children }];
    }
    if (name === "InfoTip") {
      return [text(`${attributes.text} (${attributes.tip})`)];
    }
    if (name === "Math") {
      return attributes.block
        ? [{ type: "code", lang: "math", value: attributes.formula }]
        : [{ type: "inlineCode", value: attributes.formula }];
    }
    if (["Image", "BlogImage", "ImagePopup"].includes(name)) {
      const result = image(attributes.src, attributes.alt ?? attributes.caption);
      return inline
        ? [result]
        : [paragraph([result]), ...(attributes.caption ? [paragraph(attributes.caption)] : [])];
    }
    if (["ImageGrid", "BlogGallery"].includes(name)) {
      return attributes.images.map((item) =>
        paragraph([
          typeof item === "string" ? image(item, "Gallery image") : image(item.src, item.alt),
        ]),
      );
    }
    if (["DocumentViewer", "VideoPlayer", "video", "iframe"].includes(name)) {
      return [
        paragraph([
          link(
            attributes.title ??
              (name === "DocumentViewer" ? "View document" : "Watch demonstration"),
            attributes.documentUrl ?? attributes.src,
          ),
        ]),
      ];
    }
    if (name === "DocumentTabs") {
      return attributes.documents.map((item) => paragraph([link(item.title, item.documentUrl)]));
    }
    if (name === "TechBadges") {
      return [paragraph(attributes.technologies.join(" · "))];
    }
    if (name === "YoutubeEmbed") {
      return [
        paragraph([
          link(
            attributes.title ?? "Watch video",
            `https://www.youtube.com/watch?v=${attributes.videoId}`,
          ),
        ]),
      ];
    }
    if (["Tweet", "TweetEmbed"].includes(name)) {
      return [
        {
          type: "blockquote",
          children: [
            paragraph(attributes.content),
            paragraph([link("View post on X", attributes.tweetUrl ?? attributes.link)]),
          ],
        },
      ];
    }
    if (name === "RepliesCarousel") {
      return attributes.replies.map((reply) => ({
        type: "blockquote",
        children: [paragraph(reply.content), paragraph([link(`${reply.name} on X`, reply.link)])],
      }));
    }
    if (name === "InstallTabs") {
      return [{ type: "code", lang: "sh", value: `npm install ${attributes.packages}` }];
    }
    if (/Demo$|Playground$/.test(name)) {
      return [
        paragraph([
          link(
            `Interactive example: ${name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/ Demo$/, "")}`,
            originalUrl,
          ),
        ]),
      ];
    }
    throw new Error(`Unsupported MDX component: ${name}`);
  }
  if (node.type.startsWith("mdx")) {
    throw new Error(`Unsupported MDX node: ${node.type}`);
  }
  if (node.children) {
    return [{ ...node, children: node.children.flatMap((child) => convert(child, originalUrl)) }];
  }
  return [node];
}

const inlineTypes = new Set([
  "text",
  "emphasis",
  "strong",
  "delete",
  "inlineCode",
  "link",
  "image",
  "break",
  "linkReference",
  "imageReference",
]);
function normalizeBlocks(node) {
  if (!node.children) {
    return [node];
  }
  const children = node.children.flatMap(normalizeBlocks);
  if (node.type === "paragraph") {
    const result = [];
    let inline = [];
    const flush = () => {
      if (inline.length) {
        result.push(paragraph(inline));
      }
      inline = [];
    };
    for (const child of children) {
      if (inlineTypes.has(child.type)) {
        inline.push(child);
      } else {
        flush();
        result.push(child);
      }
    }
    flush();
    return result;
  }
  if (["root", "blockquote", "listItem"].includes(node.type)) {
    return [
      {
        ...node,
        children: children
          .map((child) => (inlineTypes.has(child.type) ? paragraph([child]) : child))
          .filter(
            (child) =>
              !(
                child.type === "paragraph" &&
                child.children.every((part) => part.type === "text" && !part.value.trim())
              ),
          ),
      },
    ];
  }
  return [{ ...node, children }];
}

function codeBlocks(tree) {
  const result = [];
  function walk(node) {
    if (node.type === "code") {
      result.push(node.value);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  }
  walk(tree);
  return result;
}

for (const file of sourceFiles) {
  const input = readFileSync(join(reference, "content", file), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(input);
  if (!match) {
    throw new Error(`Missing metadata: ${file}`);
  }
  const front = parse(match[1]);
  const experience = file.startsWith("experiences/");
  const collection = file.endsWith("/index.mdx");
  const output = `content/${file.replace(/^experiences\//, "experience/").replace(/\.mdx$/, ".md")}`;
  if (existsSync(output)) {
    throw new Error(`Refusing to replace existing source: ${output}`);
  }
  const originalUrl = experience
    ? `https://www.pulkit.page/exp/${file.split("/").at(-1).replace(".mdx", "")}`
    : `https://www.pulkit.blog/${file
        .replace(/^blogs\/(?:([^/]+)\/)?/, (_, series) => (series ? `series/${series}/` : ""))
        .replace(/\/index.mdx$/, "")
        .replace(/\.mdx$/, "")}`;
  const tree = reader.parse(match[2]);
  const converted = normalizeBlocks(convert(tree, originalUrl)[0])[0];
  const before = codeBlocks(tree);
  const after = codeBlocks(converted);
  if (before.some((code) => !after.includes(code))) {
    throw new Error(`Code block lost during conversion: ${file}`);
  }
  const metadata = {
    title: front.title ?? front.companyName ?? front.name,
    description: front.description,
  };
  if (front.date) {
    metadata.date = front.date;
  }
  if (experience) {
    metadata.role = front.position;
  }
  if (front.tags) {
    metadata.tags = front.tags;
  }
  if (front.published === false) {
    metadata.draft = true;
  }
  let body = writer.stringify(converted);
  const serializedCode = codeBlocks(writer.parse(body));
  if (before.some((code) => !serializedCode.includes(code))) {
    throw new Error(`Serialized code block lost: ${file}`);
  }
  if (collection) {
    body += `\n:::list ${file.replace(/\/index.mdx$/, "")}\n`;
  }
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `---\n${stringify(metadata, { lineWidth: 100 })}---\n\n${body}`);
  report.pages.push({ source: file, output, codeBlocks: before.length });
}
mkdirSync("docs", { recursive: true });
writeFileSync(
  "docs/content-migration.json",
  `${JSON.stringify({ ...report, assets: [...report.assets].sort() }, null, 2)}\n`,
);
console.log(
  `Imported ${report.pages.length} pages and ${report.assets.size} assets; preserved all original fenced code blocks.`,
);

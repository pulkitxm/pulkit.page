import { formatFence } from "@pulkit/code/format-code";
import { showcase } from "@pulkit/demos/render";
import { isRecord } from "../lib/guards.ts";
import { imageTo, linkTo, quote, type ResolveUrl } from "./markdown-links.ts";

function property(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function text(value: unknown, key: string): string {
  return String(property(value, key));
}

function optionalText(value: unknown, key: string): string | undefined {
  const item = property(value, key);
  return item === undefined ? undefined : String(item);
}

function list(value: unknown, key: string): unknown[] {
  const items = property(value, key);
  if (!Array.isArray(items)) {
    throw new Error(`Embed property ${key} must be a list`);
  }
  return items;
}

function humanize(name: string): string {
  const words = name.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function imageList(props: unknown, resolve: ResolveUrl): string {
  return list(props, "images")
    .map((entry) =>
      typeof entry === "string"
        ? imageTo("", resolve(entry))
        : imageTo(String(property(entry, "alt") ?? ""), resolve(text(entry, "src"))),
    )
    .join("\n\n");
}

function replies(props: unknown): string {
  return list(props, "replies")
    .map(
      (reply) =>
        `${quote(text(reply, "content"))}\n>\n> ${linkTo(`${text(reply, "name")} (@${text(reply, "username")})`, text(reply, "link"))}`,
    )
    .join("\n\n");
}

export function embedMarkdown(
  name: string,
  props: unknown,
  resolve: ResolveUrl,
  inline: boolean,
  notes: string[],
): string {
  const image = (src: string, alt = ""): string => imageTo(alt, resolve(src));
  switch (name) {
    case "math":
      return property(props, "block") && !inline
        ? `$$\n${text(props, "formula")}\n$$`
        : `$${text(props, "formula")}$`;
    case "cmd-key":
      return "Cmd";
    case "info-tip":
      notes.push(text(props, "tip"));
      return `${text(props, "text")}[^${notes.length}]`;
    case "image-popup":
      return linkTo(
        String(property(props, "children") ?? property(props, "alt")),
        resolve(text(props, "src")),
      );
    case "image":
      return image(text(props, "src"), optionalText(props, "alt"));
    case "blog-image": {
      const caption = property(props, "caption");
      const picture = image(text(props, "src"), optionalText(props, "alt"));
      return caption ? `${picture}\n\n*${String(caption).replace(/[*\\]/g, "\\$&")}*` : picture;
    }
    case "image-grid":
    case "blog-gallery":
      return imageList(props, resolve);
    case "stat-row":
      return list(props, "stats")
        .map((stat) => `- **${text(stat, "value")}** ${text(stat, "label")}`)
        .join("\n");
    case "card-grid":
      return list(props, "cards")
        .map((card) => `### ${text(card, "title")}\n\n${text(card, "body")}`)
        .join("\n\n");
    case "contact-links":
      return list(props, "links")
        .map(
          (link) =>
            `- **${text(link, "label")}:** ${linkTo(text(link, "value"), text(link, "href"))}`,
        )
        .join("\n");
    case "document-tabs":
      return list(props, "documents")
        .map(
          (document) =>
            `- ${linkTo(text(document, "title"), resolve(text(document, "documentUrl")))} (PDF)`,
        )
        .join("\n");
    case "document-viewer":
      return `${linkTo(text(props, "title"), resolve(text(props, "documentUrl")))} (PDF)`;
    case "install-tabs":
      return `\`\`\`sh\nnpm install ${text(props, "packages")}\n\`\`\``;
    case "tech-badges":
      return property(props, "groups")
        ? list(props, "groups")
            .map(
              (group) =>
                `- **${text(group, "label")}:** ${list(group, "technologies").map(String).join(", ")}`,
            )
            .join("\n")
        : list(props, "technologies")
            .map((technology) => `- ${String(technology)}`)
            .join("\n");
    case "tweet":
    case "tweet-embed":
      return `${quote(text(props, "content"))}\n>\n> ${linkTo("View the post on X", text(props, "tweetUrl"))}`;
    case "replies-carousel":
      return replies(props);
    case "youtube-embed":
      return linkTo(
        `Watch on YouTube: ${text(props, "title")}`,
        `https://www.youtube.com/watch?v=${text(props, "videoId")}`,
      );
    default:
      throw new Error(`No Markdown fallback for embed: ${name}`);
  }
}

export function demoMarkdown(name: string, variant: string | undefined, pageUrl: string): string {
  const demo = showcase(variant ? `${name}-${variant}` : name);
  const heading = `**Interactive demo: ${humanize(demo.component)}.** ${linkTo("Try it on the page", pageUrl)}.`;
  const files = demo.files.map(
    (file) =>
      `\`${file.filename}\`\n\n\`\`\`${file.language}\n${formatFence(file.language, file.code).trimEnd()}\n\`\`\``,
  );
  return [heading, ...files].join("\n\n");
}

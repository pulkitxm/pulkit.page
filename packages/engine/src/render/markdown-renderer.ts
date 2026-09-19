import { formatFence } from "@pulkit/code/format-code";
import { highlightFence } from "@pulkit/code/highlight";
import { renderRawHtml } from "@pulkit/embeds";
import { codeCopyScript, copyButton } from "@pulkit/embeds/copy-button";
import { zoomable } from "@pulkit/embeds/lightbox";
import { escapeHtml } from "@pulkit/shared/html";
import { Marked, Renderer, type Token, type Tokens } from "marked";
import { directiveExtension } from "./directives.ts";
import { codeFont, linkClasses, safeUrl, withClass } from "./html.ts";
import { type RenderContext, sizeAttributes } from "./render-context.ts";

const blockSpacing = "mt-0 mb-6";
const portrait = "/assets/content/pulkit-portrait.webp";
const headingClasses: Readonly<Record<number, string>> = {
  2: "mt-12 text-xl font-semibold leading-tight tracking-tight",
  3: "mt-8 text-lg leading-tight tracking-tight",
  4: "leading-tight tracking-tight",
};

function isCode(token: Token): token is Tokens.Code {
  return token.type === "code";
}

function isLink(token: Token): token is Tokens.Link {
  return token.type === "link";
}

function headingId(text: string, ids: Set<string>): string {
  let base = text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!/^[a-z]/.test(base)) {
    base = `section-${base || "heading"}`;
  }
  let id = base;
  let suffix = 1;
  while (ids.has(id)) {
    id = `${base}-${suffix++}`;
  }
  ids.add(id);
  return id;
}

function codeBlock(html: string): string {
  const match = /^<pre><code(?: class="([^"]*)")?>([\s\S]*)<\/code><\/pre>\n?$/.exec(html);
  if (!match) {
    throw new Error("Unexpected code block markup");
  }
  const [, language, highlighted = ""] = match;
  const lines = highlighted
    .replace(/\n$/, "")
    .split("\n")
    .map(
      (line) => `<span class="block leading-(--pre-line) whitespace-pre">${line || "<br>"}</span>`,
    )
    .join("");
  const classes = [language, "block w-max min-w-full rounded-sm", codeFont, "[tab-size:2]"]
    .filter(Boolean)
    .join(" ");
  return `<div class="relative mt-0 mb-6" data-code-block><pre tabindex="0" class="m-0 overflow-x-auto rounded-lg border border-line bg-surface p-5 whitespace-normal [--pre-line:1lh]"><code class="${classes}">${lines}</code></pre><div class="pointer-events-none absolute inset-0 flex items-start justify-end p-3">${copyButton("pointer-events-auto sticky top-3", "data-code-copy")}</div></div>\n`;
}

export function createMarkdown(context: RenderContext): Marked {
  const { assets, cache } = context;
  const ids = new Set(["main"]);
  const linkedImages = new WeakSet<Token>();
  const markdown = new Marked({
    async: true,
    walkTokens: async (token) => {
      if (isCode(token)) {
        const language = token.lang ?? "";
        const text = token.text;
        const render = () => highlightFence(language, formatFence(language, text));
        token.text = await (cache ? cache.getAsync("fence", [language, text], render) : render());
        token.escaped = true;
      }
      if (isLink(token)) {
        for (const child of token.tokens) {
          if (child.type === "image") {
            linkedImages.add(child);
          }
        }
      }
    },
    renderer: {
      heading(token) {
        const depth = Math.max(2, token.depth);
        const id = headingId(token.text, ids);
        const heading = headingClasses[depth];
        const classes = heading ? ` class="${heading}"` : "";
        return `<h${depth} id="${id}"${classes}>${this.parser.parseInline(token.tokens)}</h${depth}>`;
      },
      paragraph(token) {
        return withClass(Renderer.prototype.paragraph.call(this, token), blockSpacing);
      },
      list(token) {
        return withClass(Renderer.prototype.list.call(this, token), blockSpacing);
      },
      listitem(token) {
        const html = Renderer.prototype.listitem.call(this, token);
        return token.loose ? withClass(html, "[&>p]:mb-2") : html;
      },
      blockquote(token) {
        return withClass(
          Renderer.prototype.blockquote.call(this, token),
          "mx-0 mt-0 mb-6 border-l-2 border-line pl-5 text-muted",
        );
      },
      code(token) {
        assets.script(codeCopyScript);
        return codeBlock(Renderer.prototype.code.call(this, token));
      },
      codespan(token) {
        return withClass(
          Renderer.prototype.codespan.call(this, token),
          `rounded-sm bg-surface px-1 py-0.5 ${codeFont}`,
        );
      },
      hr(token) {
        return withClass(
          Renderer.prototype.hr.call(this, token),
          "mx-0 my-10 border-0 border-t border-line",
        );
      },
      table(token) {
        return withClass(
          Renderer.prototype.table.call(this, token),
          "mt-0 mb-6 block overflow-x-auto border-collapse text-md wrap-normal",
        ).replace(/^<table /, '<table tabindex="0" ');
      },
      tablecell(token) {
        return withClass(
          Renderer.prototype.tablecell.call(this, token),
          "border-b border-line px-3.5 py-2.5 text-left",
        );
      },
      link(token) {
        return withClass(Renderer.prototype.link.call(this, token), linkClasses);
      },
      html(token) {
        return renderRawHtml(token.text, assets);
      },
      image(token) {
        const classes =
          token.href === portrait
            ? "mx-0 mt-0 mb-7 block size-36 max-w-full rounded-[50%] object-cover"
            : "mx-auto my-7 block h-auto max-w-full rounded-md";
        const image = `<img class="${classes}" src="${safeUrl(token.href)}" alt="${escapeHtml(token.text)}"${sizeAttributes(token.href)} loading="lazy">`;
        return token.href === portrait || linkedImages.has(token)
          ? image
          : zoomable({
              src: token.href,
              image: image.replace('class="mx-auto', 'class="cursor-zoom-in mx-auto'),
              className: "block",
              assets,
              escapeHtml,
            });
      },
    },
  });
  return markdown.use(directiveExtension(context));
}

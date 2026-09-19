import { formatFence } from "@pulkit/code/format-code";
import { highlightFence } from "@pulkit/code/highlight";
import { readJson } from "@pulkit/shared/files";
import { escapeAttribute } from "@pulkit/shared/html";
import type { HighlightedSource } from "../client/types.ts";
import { parseShowcase, type Showcase, type ShowcaseFile } from "./showcase.ts";

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export function showcase(key: string): Showcase {
  let value: unknown;
  try {
    value = readJson(new URL(`../showcases/${key}.json`, import.meta.url));
  } catch (error) {
    if (isMissingFile(error)) {
      throw new Error(`Unknown demo: ${key}`, { cause: error });
    }
    throw error;
  }
  return parseShowcase(value);
}

async function highlight(file: ShowcaseFile): Promise<HighlightedSource> {
  const code = formatFence(file.language, file.code);
  const html = await highlightFence(file.language, code);
  return {
    filename: file.filename,
    code,
    html: `<pre><code class="[tab-size:2] [font:0.84em/1.65_var(--site-font-mono)]">${html}</code></pre>`,
  };
}

export async function renderDemo(name: string, variant?: string): Promise<string> {
  const key = variant ? `${name}-${variant}` : name;
  const { component, props, frame, files, heavy } = showcase(key);
  const sources = await Promise.all(files.map(highlight));
  const data =
    files.length > 0
      ? `<script type="application/json">${JSON.stringify(sources).replaceAll("<", "\\u003c")}</script>`
      : "";
  let height = frame.bitBigger ? "bigger" : "default";
  if (frame.fullHeight) {
    height = "full";
  }
  return `<demo-showcase data-component="${component}" data-props="${escapeAttribute(JSON.stringify(props))}" data-frame="${escapeAttribute(JSON.stringify(frame))}" data-height="${height}"${heavy ? " data-heavy" : ""}${files.length > 0 ? " data-files" : ""}>${data}</demo-showcase>`;
}

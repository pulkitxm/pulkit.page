import { readFileSync } from "node:fs";
import { formatFence } from "@pulkit/code/format-code";
import { highlightFence } from "@pulkit/code/highlight";

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function showcase(key) {
  try {
    return JSON.parse(readFileSync(new URL(`../showcases/${key}.json`, import.meta.url), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Unknown demo: ${key}`);
    }
    throw error;
  }
}

async function highlight(file) {
  const code = formatFence(file.language, file.code);
  const html = await highlightFence(file.language, code);
  return {
    code,
    html: `<pre><code class="[tab-size:2] [font:0.84em/1.65_var(--site-font-mono)]">${html}</code></pre>`,
  };
}

export async function renderDemo(name, variant) {
  const key = variant ? `${name}-${variant}` : name;
  const { component, props, frame, files } = showcase(key);
  const sources = await Promise.all(
    files.map(async (file) => ({ filename: file.filename, ...(await highlight(file)) })),
  );
  const data = files.length
    ? `<script type="application/json">${JSON.stringify(sources).replaceAll("<", "\\u003c")}</script>`
    : "";
  const height = frame.fullHeight ? "full" : frame.bitBigger ? "bigger" : "default";
  return `<demo-showcase data-component="${component}" data-props="${escapeAttribute(JSON.stringify(props))}" data-frame="${escapeAttribute(JSON.stringify(frame))}" data-height="${height}"${files.length ? " data-files" : ""}>${data}</demo-showcase>`;
}

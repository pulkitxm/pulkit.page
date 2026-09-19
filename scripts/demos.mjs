import { readFileSync } from "node:fs";
import { formatFence } from "./format-code.mjs";
import { highlightFence } from "./highlight.mjs";

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function showcase(key) {
  try {
    return JSON.parse(
      readFileSync(new URL(`../demos/showcases/${key}.json`, import.meta.url), "utf8"),
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Unknown demo: ${key}`, { cause: error });
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
  const data =
    files.length > 0
      ? `<script type="application/json">${JSON.stringify(sources).replaceAll("<", "\\u003c")}</script>`
      : "";
  let height = frame.bitBigger ? "bigger" : "default";
  if (frame.fullHeight) {
    height = "full";
  }
  return `<demo-showcase data-component="${component}" data-props="${escapeAttribute(JSON.stringify(props))}" data-frame="${escapeAttribute(JSON.stringify(frame))}" data-height="${height}"${files.length > 0 ? " data-files" : ""}>${data}</demo-showcase>`;
}

import { codeFont } from "../lib/classes.ts";
import { copyButton } from "../lib/copy-button.ts";
import { readString } from "../lib/props.ts";
import type { EmbedRenderer, EscapeHtml } from "../types.ts";

const managers = ["bun", "pnpm", "npm", "yarn"] as const;
const commandVerbs: Readonly<Record<(typeof managers)[number], string>> = {
  bun: "add",
  npm: "install",
  pnpm: "add",
  yarn: "add",
};

function highlightCommand(command: string, escapeHtml: EscapeHtml): string {
  return command
    .split(/( +)/)
    .map((part, index) => {
      if (!part.trim()) {
        return part;
      }
      const role = index === 0 ? "text-syn-f" : "text-syn-s";
      return `<span class="${role}">${escapeHtml(part)}</span>`;
    })
    .join("");
}

export const render: EmbedRenderer = (props, { assets, escapeHtml }) => {
  if (props.manualCode || props.manualTitle) {
    throw new Error("install-tabs manual steps are not supported");
  }
  const packages = readString(props, "packages", "install-tabs");
  assets.script("/assets/embeds/install-tabs.js");
  const buttons = managers
    .map(
      (manager, index) =>
        `<button type="button" class="cursor-pointer rounded-md border-0 bg-transparent px-3 py-1.5 font-medium font-mono text-muted text-xs hover:text-fg aria-pressed:bg-bg aria-pressed:text-fg aria-pressed:shadow-[0_1px_3px_0_rgb(0_0_0/0.1),0_1px_2px_-1px_rgb(0_0_0/0.1)]" aria-pressed="${index === 0}" data-install-manager="${manager}">${manager}</button>`,
    )
    .join("");
  const blocks = managers
    .map(
      (manager, index) =>
        `<pre tabindex="0" class="m-0 overflow-x-auto rounded-lg border border-line bg-surface p-5 pr-12" data-install-command="${manager}"${index === 0 ? "" : " hidden"}><code class="bash rounded-sm ${codeFont} [tab-size:2]">${highlightCommand(`${manager} ${commandVerbs[manager]} ${packages}`, escapeHtml)}</code></pre>`,
    )
    .join("");
  return `<div class="mt-6 mb-6 space-y-4" data-install-tabs><div class="flex w-max items-center gap-1 rounded-lg border border-line bg-surface p-1">${buttons}</div><div class="relative">${copyButton("absolute top-3 right-3 z-10", "data-install-copy")}${blocks}</div></div>`;
};

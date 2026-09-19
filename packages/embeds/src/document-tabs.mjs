import { FileText } from "lucide";
import { documentCard } from "./document-viewer.mjs";
import { lucideSvg } from "./tweet.mjs";

const layouts = {
  1: { columns: "grid-cols-1", width: "w-[calc(100%-2px)]" },
  2: { columns: "grid-cols-2", width: "w-[calc(50%-2px)]" },
  3: { columns: "grid-cols-3", width: "w-[calc(33.3333%-2px)]" },
  4: { columns: "grid-cols-2 sm:grid-cols-4", width: "w-[calc(50%-2px)]" },
};
const tabClass =
  "z-10 inline-flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap rounded-md border-0 bg-transparent px-2 py-2 font-medium text-muted text-xs transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/20 aria-selected:text-fg motion-reduce:transition-none sm:px-3 sm:text-sm";
const indicatorClass =
  "pointer-events-none absolute inset-y-1 left-1 z-0 rounded-md border border-line bg-bg shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] transition-transform ease-out motion-reduce:transition-none";

function shorten(label) {
  return label.length > 8 ? `${label.slice(0, 8)}...` : label;
}

export function render({ documents }, context) {
  const { assets, escapeHtml } = context;
  const layout = layouts[documents.length];
  if (!layout) {
    throw new Error(`Unsupported document-tabs count: ${documents.length}`);
  }
  assets.script("/assets/embeds/document-tabs.js");
  const icon = lucideSvg(FileText, "mr-1 size-3 shrink-0 sm:mr-2 sm:size-4");
  const tabs = documents
    .map((entry, index) => {
      const label = `<span class="hidden sm:inline">${escapeHtml(entry.title)}</span><span class="sm:hidden">${escapeHtml(shorten(entry.title))}</span>`;
      return `<button class="${tabClass}" type="button" role="tab" data-document-tab id="tab-doc-${index}" aria-controls="tabpanel-doc-${index}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${icon}${label}</button>`;
    })
    .join("");
  const panels = documents
    .map(
      (entry, index) =>
        `<div class="mt-6" id="tabpanel-doc-${index}" role="tabpanel" data-document-panel aria-labelledby="tab-doc-${index}"${index === 0 ? "" : " hidden"}>${documentCard(entry, context)}</div>`,
    )
    .join("");
  const indicator = `<span class="${indicatorClass} ${layout.width}" aria-hidden="true" data-document-indicator></span>`;
  const tablist = `<div class="relative grid w-full ${layout.columns} gap-1 rounded-lg bg-surface p-1" role="tablist" aria-label="Documents">${indicator}${tabs}</div>`;
  return `<div class="relative my-8" data-document-tabs><div class="mb-6">${tablist}</div><div>${panels}</div></div>`;
}

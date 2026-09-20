import { arrowIcon, checkIcon, copyIcon } from "../lib/icons.ts";
import { isRecord } from "../lib/props.ts";
import type { EmbedRenderer } from "../types.ts";

interface ContactLink {
  label: string;
  value: string;
  href: string;
  copy: unknown;
}

const linkProps = new Set(["label", "value", "href", "copy"]);
const trailing = "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted";

function isFilled(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function readLink(link: unknown): ContactLink {
  if (!isRecord(link)) {
    throw new Error("contact-links entries need label, value, and href");
  }
  for (const key of Object.keys(link)) {
    if (!linkProps.has(key)) {
      throw new Error(`Unknown contact-links prop: ${key}`);
    }
  }
  const { label, value, href, copy } = link;
  if (!(isFilled(label) && isFilled(value) && isFilled(href))) {
    throw new Error("contact-links entries need label, value, and href");
  }
  if (!/^(?:https:\/\/|mailto:)/.test(href)) {
    throw new Error(`Invalid contact link: ${href}`);
  }
  return { label, value, href, copy };
}

export const render: EmbedRenderer = ({ links, ...rest }, { assets, escapeHtml }) => {
  if (Object.keys(rest).length > 0 || !Array.isArray(links) || links.length === 0) {
    throw new Error("contact-links takes a nonempty links array only");
  }
  const entries = links.map(readLink);
  const rows = entries.map(({ label, value, href, copy }) => {
    const text = `<span class="w-22 shrink-0 text-xs text-muted max-sm:w-18">${escapeHtml(label)}</span><span class="min-w-0 flex-1 truncate group-hover:underline">${escapeHtml(value)}</span>`;
    const anchor = (content: string): string =>
      `<a class="group flex min-w-0 flex-1 items-center gap-4 py-4 leading-normal text-inherit no-underline underline-offset-4" href="${escapeHtml(href)}"${href.startsWith("https://") ? ' rel="me noopener"' : ""}>${content}</a>`;
    if (!copy) {
      return `<li class="flex border-b border-line">${anchor(`${text}<span class="${trailing} transition-[color,translate] duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg">${arrowIcon}</span>`)}</li>`;
    }
    return `<li class="flex items-center gap-4 border-b border-line">${anchor(text)}<button type="button" class="${trailing} cursor-pointer border-0 bg-transparent p-0 transition-colors duration-150 hover:bg-surface hover:text-fg" aria-label="Copy ${escapeHtml(label.toLowerCase())} address" data-contact-copy="${escapeHtml(value)}">${copyIcon}${checkIcon}</button></li>`;
  });
  if (entries.some((link) => link.copy)) {
    assets.script("/assets/embeds/contact-links.js");
  }
  return `<ul class="mt-2 mb-8 list-none border-t border-line p-0">${rows.join("")}</ul>`;
};

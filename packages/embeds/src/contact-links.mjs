const linkProps = new Set(["label", "value", "href", "copy"]);
const iconAttributes =
  'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const copyIcon = `<svg ${iconAttributes} class="size-3.5" data-copy-idle><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const checkIcon = `<svg ${iconAttributes} class="hidden size-3.5" data-copy-done><path d="M20 6 9 17l-5-5"/></svg>`;
const arrowIcon = `<svg ${iconAttributes} class="size-3.5"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>`;
const trailing = "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted";

function readLink(link) {
  for (const key of Object.keys(link)) {
    if (!linkProps.has(key)) {
      throw new Error(`Unknown contact-links prop: ${key}`);
    }
  }
  if (![link.label, link.value, link.href].every((value) => typeof value === "string" && value)) {
    throw new Error("contact-links entries need label, value, and href");
  }
  if (!/^(?:https:\/\/|mailto:)/.test(link.href)) {
    throw new Error(`Invalid contact link: ${link.href}`);
  }
  return link;
}

export function render({ links, ...rest }, { assets, escapeHtml }) {
  if (Object.keys(rest).length > 0 || !Array.isArray(links) || links.length === 0) {
    throw new Error("contact-links takes a nonempty links array only");
  }
  const rows = links.map(readLink).map(({ label, value, href, copy }) => {
    const text = `<span class="w-22 shrink-0 text-xs text-muted max-sm:w-18">${escapeHtml(label)}</span><span class="min-w-0 flex-1 truncate group-hover:underline">${escapeHtml(value)}</span>`;
    const anchor = (content) =>
      `<a class="group flex min-w-0 flex-1 items-center gap-4 py-4 leading-normal text-inherit no-underline underline-offset-4" href="${escapeHtml(href)}"${href.startsWith("https://") ? ' rel="me noopener"' : ""}>${content}</a>`;
    if (!copy) {
      return `<li class="flex border-b border-line">${anchor(`${text}<span class="${trailing} transition-[color,translate] duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg">${arrowIcon}</span>`)}</li>`;
    }
    return `<li class="flex items-center gap-4 border-b border-line">${anchor(text)}<button type="button" class="${trailing} cursor-pointer border-0 bg-transparent p-0 transition-colors duration-150 hover:bg-surface hover:text-fg" aria-label="Copy ${escapeHtml(label.toLowerCase())} address" data-contact-copy="${escapeHtml(value)}">${copyIcon}${checkIcon}</button></li>`;
  });
  if (links.some((link) => link.copy)) {
    assets.script("/assets/embeds/contact-links.js");
  }
  return `<ul class="mt-2 mb-8 list-none border-t border-line p-0">${rows.join("")}</ul>`;
}

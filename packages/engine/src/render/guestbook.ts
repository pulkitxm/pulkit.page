import type { GuestbookEntry } from "@pulkit/shared/guestbook";
import { escapeHtml } from "@pulkit/shared/html";
import type { SiteContext } from "../types.ts";
import { linkClasses, safeUrl } from "./html.ts";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function entryHtml(entry: GuestbookEntry): string {
  const name = escapeHtml(entry.name);
  const author = entry.github
    ? `<a class="font-medium text-inherit no-underline hover:underline" href="https://github.com/${escapeHtml(entry.github)}" rel="noopener">${name}</a>`
    : `<span class="font-medium">${name}</span>`;
  const avatar = entry.avatar
    ? `<img class="m-0 size-8 shrink-0 rounded-full object-cover" src="${safeUrl(entry.avatar)}" alt="" width="32" height="32" loading="lazy" decoding="async">`
    : `<span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-line text-xs text-muted" aria-hidden="true">${escapeHtml(entry.name.slice(0, 1).toUpperCase())}</span>`;
  const date = `<time class="text-2xs text-muted" datetime="${escapeHtml(entry.createdAt)}">${dateFormat.format(new Date(entry.createdAt))}</time>`;
  return `<li class="border-b border-line py-5" id="${escapeHtml(entry.id)}"><div class="flex items-center gap-3">${avatar}<div class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 [overflow-wrap:anywhere]">${author}${date}</div></div><p class="mb-0 mt-3 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">${escapeHtml(entry.message)}</p></li>`;
}

export function renderGuestbook(site: SiteContext): string {
  const guestbook = site.guestbook;
  if (!guestbook) {
    throw new Error("Guestbook data was not loaded");
  }
  const fallback = guestbook.googleFormUrl
    ? `<p class="mb-0 mt-3 text-xs text-muted">Don’t have a GitHub account? <a class="${linkClasses}" href="${safeUrl(guestbook.googleFormUrl)}" rel="noopener">Leave a message with Google Forms</a>.</p>`
    : "";
  const signup = `<div class="my-7"><a class="inline-flex rounded-md border border-line px-4 py-2 text-sm font-medium text-inherit no-underline hover:bg-line" href="${safeUrl(guestbook.githubFormUrl)}" rel="noopener">Sign my guestbook with GitHub</a>${fallback}<p class="mb-0 mt-3 text-xs text-muted">Messages are public and appear after the next hourly sync.</p></div>`;
  const entries =
    guestbook.entries.length > 0
      ? `<h2 class="mt-10 text-base font-medium">${guestbook.entries.length} ${guestbook.entries.length === 1 ? "message" : "messages"}</h2><ul class="m-0 list-none border-t border-line p-0">${guestbook.entries.map(entryHtml).join("")}</ul>`
      : `<p class="text-muted">Be the first to leave a message!</p>`;
  return signup + entries;
}

const xLogoPath =
  "M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z";

function replyCard(reply, hidden, escapeHtml) {
  const initial = reply.name.trim().charAt(0).toUpperCase();
  const label = `Reply from ${reply.name}, @${reply.username}, on X: ${reply.content}`;
  return `<li class="w-72 shrink-0 sm:w-80"${hidden ? ' aria-hidden="true"' : ""}><a href="${escapeHtml(reply.link)}" target="_blank" rel="noopener noreferrer"${hidden ? ' tabindex="-1"' : ""} aria-label="${escapeHtml(label)}" class="flex h-full flex-col gap-3 overflow-hidden rounded-[12px] border border-line bg-bg p-4 text-fg no-underline transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/20"><div class="flex items-center gap-3"><span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-full bg-line font-semibold text-fg/80">${escapeHtml(initial)}</span><span class="flex min-w-0 flex-col"><span class="truncate font-semibold text-base leading-[1.5] text-fg">${escapeHtml(reply.name)}</span><span class="truncate text-[14px] leading-[1.43] text-muted">@${escapeHtml(reply.username)}</span></span><svg class="ml-auto size-4 shrink-0 text-fg/40" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="${xLogoPath}" /></svg></div><p class="m-0 line-clamp-4 break-words text-[14px] leading-[1.625] text-fg/90">${escapeHtml(reply.content)}</p></a></li>`;
}

export function render({ replies }, { assets, escapeHtml }) {
  assets.script("/assets/embeds/replies-carousel.js");
  const cards = [
    ...replies.map((reply) => replyCard(reply, false, escapeHtml)),
    ...replies.map((reply) => replyCard(reply, true, escapeHtml)),
  ].join("");
  return `<div class="group relative my-8 overflow-hidden [-webkit-mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)] [mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)] motion-reduce:overflow-x-auto motion-reduce:[-webkit-mask-image:none] motion-reduce:[mask-image:none]" data-replies-carousel><ul class="m-0 flex w-max list-none gap-4 p-0" data-replies-track>${cards}</ul></div>`;
}

import { localImageSize } from "./lightbox.mjs";

const fallbackSize = { width: 280, height: 200 };
let popups = 0;

export function render(props, { assets, escapeHtml }) {
  assets.script("/assets/embeds/image-popup.js");
  popups += 1;
  const id = `image-popup-${popups}`;
  const size = localImageSize(props.src) ?? fallbackSize;
  const width = props.width ?? size.width;
  const height = props.height ?? size.height;
  return `<button type="button" class="cursor-help border-0 border-b border-dashed border-fg/40 bg-transparent p-0 [font:inherit] text-inherit hover:border-fg/60" popovertarget="${id}" data-image-popup>${escapeHtml(props.children ?? props.alt)}</button><span id="${id}" popover class="m-0 w-auto max-w-[min(280px,90vw)] scale-95 overflow-hidden rounded-md border border-line bg-surface p-0 opacity-0 shadow-md transition-[opacity,scale,display,overlay] transition-discrete duration-150 ease-out open:scale-100 open:opacity-100 motion-reduce:transition-none starting:open:scale-95 starting:open:opacity-0"><img class="block h-auto max-h-[50vh] w-full object-cover" src="${escapeHtml(props.src)}" alt="${escapeHtml(props.alt ?? "")}" width="${width}" height="${height}" loading="lazy"></span>`;
}

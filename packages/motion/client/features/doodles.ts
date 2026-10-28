import { elements, reducedMotion } from "../lib/env.ts";
import { revealOnce } from "../lib/observe.ts";
import { onScroll } from "../lib/scroll.ts";

const shapes: readonly string[] = [
  "M8 40c10-2 20-14 22-30 4 14 12 26 26 30-14 2-22 10-26 26-2-14-10-24-22-26z",
  "M4 30c8-10 16-10 24 0s16 10 24 0 16-10 24 0",
  "M6 8c14 4 40 6 56 30M48 30l14 8-4 16",
  "M34 6c16 0 28 12 28 26S50 60 34 60 6 48 6 32C6 20 16 10 30 8",
  "M10 50L30 8l10 30 12-18 6 32",
  "M32 4v56M4 32h56M12 12l40 40M52 12L12 52",
];

function doodle(index: number): SVGSVGElement {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 66 66");
  svg.setAttribute("aria-hidden", "true");
  svg.dataset.doodle = "";
  svg.dataset.sticker = String(index % shapes.length);
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", shapes[index % shapes.length] ?? "");
  path.setAttribute("pathLength", "1");
  svg.append(path);
  return svg;
}

export function startDoodles(): void {
  if (reducedMotion()) {
    return;
  }
  const headings = elements(
    "[data-home] [data-section] > h2, [data-page-hero] h1, [data-footer-cta]",
    HTMLElement,
  );
  const stickers = headings.map((heading, index) => {
    const sticker = doodle(index * 5 + 2);
    heading.append(sticker);
    revealOnce(sticker as unknown as HTMLElement);
    return sticker;
  });
  onScroll(({ y }) => {
    stickers.forEach((sticker, index) => {
      sticker.style.rotate = `${((y * 0.04 + index * 37) % 360).toFixed(1)}deg`;
    });
  });
}

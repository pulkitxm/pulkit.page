import { elements, finePointer, lerp, reducedMotion } from "../lib/env.ts";
import { onTick } from "../lib/ticker.ts";

function cardFor(href: string): string | undefined {
  const url = new URL(href, globalThis.location.href);
  if (url.origin !== globalThis.location.origin || url.pathname === "/") {
    return;
  }
  return ["", "og", url.pathname.slice(1, -1), "card.png"].join("/");
}

export function startPreview(): void {
  if (!finePointer() || reducedMotion()) {
    return;
  }
  const links = elements(
    ["[data-section='writing'] li a", "[data-prose] ul > li > a[href^='/writing/']"].join(", "),
    HTMLAnchorElement,
  );
  if (links.length === 0) {
    return;
  }
  const preview = document.createElement("div");
  preview.dataset.preview = "";
  preview.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.alt = "";
  image.decoding = "async";
  preview.append(image);
  document.body.append(preview);
  const target = { x: 0, y: 0 };
  const position = { x: 0, y: 0, tilt: 0 };
  let active = false;
  for (const link of links) {
    const card = cardFor(link.href);
    if (!card) {
      continue;
    }
    link.dataset.cursor = "read";
    link.addEventListener("pointerenter", (event) => {
      if (!active) {
        position.x = event.clientX;
        position.y = event.clientY;
      }
      active = true;
      image.src = card;
      preview.dataset.visible = "";
    });
    link.addEventListener("pointerleave", () => {
      active = false;
      delete preview.dataset.visible;
    });
  }
  document.addEventListener("pointermove", (event) => {
    target.x = event.clientX;
    target.y = event.clientY;
  });
  onTick((_, delta) => {
    const ease = 1 - 0.86 ** (delta / 16);
    const dx = target.x - position.x;
    position.x = lerp(position.x, target.x, ease);
    position.y = lerp(position.y, target.y, ease);
    position.tilt = lerp(position.tilt, Math.max(-14, Math.min(14, dx * 0.12)), 0.1);
    preview.style.transform = `translate3d(calc(${position.x}px - 50%), calc(${position.y}px - 115%), 0) rotate(${position.tilt}deg)`;
    preview.style.scale = active ? "1" : "0.6";
  });
}

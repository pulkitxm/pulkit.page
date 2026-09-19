import { findElement } from "../lib/dom.ts";

const openDelay = 200;
const closeDelay = 100;
const offset = 4;
const margin = 8;

function place(trigger: HTMLElement, card: HTMLElement): void {
  const anchor = trigger.getBoundingClientRect();
  const box = { width: card.offsetWidth, height: card.offsetHeight };
  const left = Math.min(
    Math.max(anchor.left + anchor.width / 2 - box.width / 2, margin),
    innerWidth - box.width - margin,
  );
  const above = anchor.top - box.height - offset;
  const top = above >= margin ? above : anchor.bottom + offset;
  card.style.inset = "auto";
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

export function setupImagePopup(trigger: HTMLElement): void {
  const card = document.getElementById(trigger.getAttribute("popovertarget") ?? "");
  if (!card) {
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = (open: boolean, delay: number): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (open !== card.matches(":popover-open")) {
        card.togglePopover(open);
      }
    }, delay);
  };
  const reposition = (): void => {
    if (card.matches(":popover-open")) {
      place(trigger, card);
    }
  };
  card.addEventListener("toggle", (event) => {
    trigger.setAttribute("aria-expanded", String(event.newState === "open"));
    reposition();
  });
  findElement(card, "img", HTMLImageElement)?.addEventListener("load", reposition);
  for (const element of [trigger, card]) {
    element.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") {
        schedule(true, openDelay);
      }
    });
    element.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") {
        schedule(false, closeDelay);
      }
    });
  }
  trigger.addEventListener("click", () => clearTimeout(timer));
  addEventListener("scroll", reposition, { passive: true });
  addEventListener("resize", reposition);
}

import { elements } from "../lib/env.ts";

function roll(element: HTMLElement): void {
  if (element.dataset.rollDone !== undefined || element.children.length > 0) {
    return;
  }
  const text = element.textContent ?? "";
  const label = document.createElement("span");
  label.dataset.sr = "";
  label.textContent = text;
  const visual = document.createElement("span");
  visual.setAttribute("aria-hidden", "true");
  visual.dataset.roll = "";
  [...text].forEach((character, index) => {
    const span = document.createElement("span");
    span.dataset.rollChar = "";
    span.style.setProperty("--i", String(index));
    span.textContent = character;
    visual.append(span);
  });
  element.replaceChildren(label, visual);
  element.dataset.rollDone = "";
  element.style.overflow = "clip";
  element.style.display = "inline-block";
  element.style.lineHeight = "1.2";
}

export function startRoll(): void {
  for (const element of elements(
    "[data-nav] a, [data-footer-links] a, [data-menu-footer] a",
    HTMLElement,
  )) {
    roll(element);
  }
  for (const element of elements("[data-roll]", HTMLElement)) {
    element.removeAttribute("data-roll");
    roll(element);
  }
}

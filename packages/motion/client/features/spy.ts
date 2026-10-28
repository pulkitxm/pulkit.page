import { elements, wideScreen } from "../lib/env.ts";
import { onVisible } from "../lib/observe.ts";
import { onScroll } from "../lib/scroll.ts";

export function startSectionSpy(): void {
  const sections = elements("[data-home] > [data-section]", HTMLElement).filter(
    (section) => section.querySelector(":scope > h2") !== null,
  );
  if (sections.length === 0 || !wideScreen()) {
    return;
  }
  const nav = document.createElement("nav");
  nav.dataset.spy = "";
  nav.setAttribute("aria-label", "Sections");
  const links = sections.map((section, index) => {
    const heading = section.querySelector(":scope > h2");
    section.id ||= `section-${section.dataset.section ?? index}`;
    const link = document.createElement("a");
    link.href = `#${section.id}`;
    link.dataset.cursor = "";
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("span");
    label.textContent =
      heading?.querySelector("[data-sr]")?.textContent ?? heading?.textContent ?? "";
    link.append(number, label);
    nav.append(link);
    onVisible(section, (visible) => {
      if (visible) {
        for (const other of nav.querySelectorAll("a")) {
          other.removeAttribute("aria-current");
        }
        link.setAttribute("aria-current", "true");
      }
    });
    return link;
  });
  document.body.append(nav);
  const first = sections[0];
  onScroll(({ y }) => {
    const visible = first ? y > first.offsetTop - globalThis.innerHeight * 0.5 : false;
    nav.toggleAttribute("data-visible", visible);
  });
  if (links.length === 0) {
    nav.remove();
  }
}

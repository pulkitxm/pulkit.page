import { isPlainLeftClick } from "../lib/events.ts";
import { createFrame } from "../lib/frames.ts";

export function setupDocumentFrame(link: HTMLAnchorElement): void {
  link.addEventListener("click", (event) => {
    if (!isPlainLeftClick(event)) {
      return;
    }
    event.preventDefault();
    link.replaceWith(
      createFrame({
        src: link.getAttribute("href") ?? "",
        title: link.dataset.title,
        className: link.dataset.frameClass,
        lazy: true,
      }),
    );
  });
}

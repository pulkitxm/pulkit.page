import { findElement } from "../lib/dom.ts";
import { createFrame } from "../lib/frames.ts";

const permissions =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

export function setupYoutubeEmbed(root: HTMLElement): void {
  findElement(root, "[data-youtube-play]", HTMLElement)?.addEventListener("click", () => {
    root.replaceChildren(
      createFrame({
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(root.dataset.videoId ?? "")}?autoplay=1&rel=0&modestbranding=1`,
        title: root.dataset.title,
        className: root.dataset.frameClass,
        allow: permissions,
        referrerPolicy: "strict-origin-when-cross-origin",
        lazy: true,
        allowFullscreen: true,
      }),
    );
  });
}

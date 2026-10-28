import { elements, reducedMotion } from "../lib/env.ts";
import { revealOnce } from "../lib/observe.ts";
import { splitText } from "../lib/split.ts";

const blockSelector =
  ":scope > :is(p, ul, ol, dl, blockquote, table, h3, h4, details, figure, hr, section, div:not([data-code-block])), :scope > [data-code-block]";

function belowFold(element: Element): boolean {
  return element.getBoundingClientRect().top > globalThis.innerHeight * 0.92;
}

function tagBlocks(container: Element): void {
  let index = 0;
  for (const block of container.querySelectorAll<HTMLElement>(blockSelector)) {
    if (
      block.dataset.reveal !== undefined ||
      block.dataset.section !== undefined ||
      !belowFold(block)
    ) {
      continue;
    }
    const media =
      block.matches("p, div") &&
      block.querySelector(":scope > img, :scope > a > img, :scope > [data-media-zoom]") !== null &&
      (block.textContent ?? "").trim() === "";
    block.dataset.reveal = media ? "media" : "";
    block.style.setProperty("--i", String(index++ % 3));
    revealOnce(block);
  }
}

export function startReveal(): void {
  if (reducedMotion()) {
    return;
  }
  for (const heading of elements("[data-split]", HTMLElement)) {
    if (heading.dataset.colossal !== undefined || !belowFold(heading)) {
      continue;
    }
    splitText(heading, heading.dataset.split === "chars" ? "chars" : "words", true);
    revealOnce(heading);
  }
  for (const container of elements(
    "[data-prose] > .wrap-break-word, [data-prose][data-wide], [data-home] > [data-section]",
    HTMLElement,
  )) {
    tagBlocks(container);
  }
  for (const heading of elements("[data-prose] h2, [data-home] [data-section] > h2", HTMLElement)) {
    if (!belowFold(heading)) {
      continue;
    }
    if (heading.querySelector("a, code, em, strong")) {
      heading.dataset.reveal = "";
    } else {
      splitText(heading, "words", true);
      heading.dataset.split = "words";
    }
    revealOnce(heading);
  }
  for (const doodle of elements("[data-doodle]", SVGElement)) {
    for (const path of doodle.querySelectorAll("path")) {
      path.setAttribute("pathLength", "1");
    }
    revealOnce(doodle as unknown as HTMLElement);
  }
}

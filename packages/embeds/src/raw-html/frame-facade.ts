import { escapeHtml } from "@pulkit/shared/html";
import { frameBox } from "./tag-rules.ts";

export type AttributeValues = Map<string, string | undefined>;

export const facadeScript = "/assets/embeds/frame-facade.js";

const facadeClasses = {
  root: `relative ${frameBox} border border-line bg-surface`,
  panel:
    "absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface p-6 text-center [&[hidden]]:hidden",
  button:
    "inline-flex cursor-pointer items-center justify-center rounded-md border border-line bg-bg px-4 py-2 font-medium text-fg text-md hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2",
  note: "m-0 max-w-[32rem] text-balance text-muted text-sm",
  link: "text-muted text-xs underline-offset-4 hover:text-fg",
  frame: "absolute inset-0 size-full border-0",
};

let facades = 0;

function dataAttribute(name: string, value: string | undefined): string {
  return value === undefined ? "" : ` ${name}="${escapeHtml(value)}"`;
}

export function frameFacade(src: string, values: AttributeValues): string {
  const host = escapeHtml(new URL(src).hostname);
  const href = escapeHtml(src);
  facades += 1;
  const note = `frame-note-${facades}`;
  const away = `<a class="${facadeClasses.link}" href="${href}" target="_blank" rel="noopener noreferrer">Open on ${host}</a>`;
  const data = [
    dataAttribute("data-frame-src", src),
    dataAttribute("data-frame-title", values.get("title")),
    dataAttribute("data-frame-class", facadeClasses.frame),
    dataAttribute("data-frame-sandbox", values.get("sandbox")),
    dataAttribute("data-frame-allow", values.get("allow")),
  ].join("");
  return [
    `<div class="${facadeClasses.root}" data-frame-facade${data}>`,
    `<div class="${facadeClasses.panel}" data-frame-panel="offer">`,
    `<button type="button" class="${facadeClasses.button}" data-frame-run aria-describedby="${note}">Run this sandbox</button>`,
    `<p id="${note}" class="${facadeClasses.note}">Runs ${host} in an embedded frame, which loads third-party code and cookies.</p>`,
    away,
    "</div>",
    `<div class="${facadeClasses.panel}" data-frame-panel="loading" hidden>`,
    `<p class="${facadeClasses.note}" role="status">Loading the sandbox...</p>`,
    "</div>",
    `<div class="${facadeClasses.panel}" data-frame-panel="error" hidden>`,
    `<p class="${facadeClasses.note}" role="alert">This sandbox could not be loaded.</p>`,
    `<button type="button" class="${facadeClasses.button}" data-frame-run>Try again</button>`,
    away,
    "</div>",
  ].join("");
}

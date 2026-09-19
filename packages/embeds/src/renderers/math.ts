import katex from "katex";
import { readString } from "../lib/props.ts";
import type { EmbedRenderer } from "../types.ts";

const directive = "<!-- [html-validate-disable-block no-inline-style] -->";

export const render: EmbedRenderer = (props, { assets, inline }) => {
  assets.style("/assets/katex/katex.min.css");
  const html = katex.renderToString(readString(props, "formula", "math"), {
    displayMode: Boolean(props.block),
    throwOnError: false,
    output: "html",
  });
  return props.block && !inline
    ? `<div tabindex="0" class="my-4 overflow-x-auto text-center">${directive}${html}</div>`
    : `<span>${directive}${html}</span>`;
};

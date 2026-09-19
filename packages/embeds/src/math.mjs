import katex from "katex";

const directive = "<!-- [html-validate-disable-block no-inline-style] -->";

export function render(props, { assets, inline }) {
  assets.style("/assets/katex/katex.min.css");
  const html = katex.renderToString(props.formula, {
    displayMode: Boolean(props.block),
    throwOnError: false,
    output: "html",
  });
  return props.block && !inline
    ? `<div tabindex="0" class="my-4 overflow-x-auto text-center">${directive}${html}</div>`
    : `<span>${directive}${html}</span>`;
}

import { zoomable } from "../lightbox.mjs";

const styleClasses = {
  borderRadius: { "0.5rem": "rounded-lg" },
  width: { auto: "w-auto" },
  height: { auto: "h-auto" },
  maxHeight: { "400px": "max-h-[400px]" },
  maxWidth: { "100%": "max-w-full" },
};

export function render(props, { assets, escapeHtml }) {
  const classes = Object.entries(props.style ?? {}).map(([key, value]) => {
    const match = styleClasses[key]?.[value];
    if (!match) {
      throw new Error(`Unsupported image style ${key}: ${value}`);
    }
    return match;
  });
  const image = `<img class="${["mx-auto my-7 block cursor-zoom-in", ...classes].join(" ")}" src="${escapeHtml(props.src)}" alt="${escapeHtml(props.alt ?? "")}" loading="${props.loading === "eager" ? "eager" : "lazy"}" decoding="async">`;
  return zoomable({ src: props.src, image, className: "block", assets, escapeHtml });
}

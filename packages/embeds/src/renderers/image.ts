import { localImageSize, zoomable } from "../lib/lightbox.ts";
import { isRecord, optionalString, readString } from "../lib/props.ts";
import type { EmbedRenderer } from "../types.ts";

const styleClasses: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  borderRadius: { "0.5rem": "rounded-lg" },
  width: { auto: "w-auto" },
  height: { auto: "h-auto" },
  maxHeight: { "400px": "max-h-[400px]" },
  maxWidth: { "100%": "max-w-full" },
};

function styleClass(key: string, value: unknown): string {
  const match = typeof value === "string" ? styleClasses[key]?.[value] : undefined;
  if (!match) {
    throw new Error(`Unsupported image style ${key}: ${value}`);
  }
  return match;
}

export const render: EmbedRenderer = (props, { assets, escapeHtml }) => {
  const src = readString(props, "src", "image");
  const style = props.style ?? {};
  if (!isRecord(style)) {
    throw new Error("image style must be an object");
  }
  const classes = Object.entries(style).map(([key, value]) => styleClass(key, value));
  const size = localImageSize(src);
  const dimensions = size ? ` width="${size.width}" height="${size.height}"` : "";
  const loading = optionalString(props, "loading", "image") === "eager" ? "eager" : "lazy";
  const image = `<img class="${["mx-auto my-7 block cursor-zoom-in", ...classes].join(" ")}" src="${escapeHtml(src)}" alt="${escapeHtml(props.alt ?? "")}"${dimensions} loading="${loading}" decoding="async">`;
  return zoomable({ src, image, className: "block", assets, escapeHtml });
};

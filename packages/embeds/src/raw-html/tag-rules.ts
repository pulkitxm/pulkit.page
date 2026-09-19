import { codeFont } from "../lib/classes.ts";

export const frameBox = "mt-0 mb-6 block h-[500px] w-full overflow-hidden rounded";

export const tagClasses: Readonly<Record<string, string>> = {
  center: "mt-0 mb-6 text-center [&_img]:mx-auto",
  div: "text-balance text-center",
  details: "mt-0 mb-6 rounded-lg border border-line p-4 [&>*:last-child]:mb-0",
  summary: "cursor-pointer font-bold",
  iframe: `${frameBox} border-0`,
  video: "mt-0 mb-6 block h-auto w-full rounded-lg",
  small: "-mt-4 mb-6 block text-sm text-muted",
  code: `rounded-sm bg-surface px-1 py-0.5 ${codeFont}`,
};

export const allowedAttributes: Readonly<Record<string, readonly string[]>> = {
  iframe: ["src", "title", "allow", "sandbox"],
  video: ["src", "title", "autoplay", "loop", "muted", "playsinline", "controls"],
  track: ["kind"],
  details: ["open"],
};

const renamedTags: Readonly<Record<string, string>> = { center: "div" };

export function outputTag(name: string): string {
  return renamedTags[name] ?? name;
}

export const voidTags = new Set(["br", "track"]);

export const allowedTags = new Set([
  "br",
  "center",
  "code",
  "details",
  "div",
  "iframe",
  "small",
  "strong",
  "summary",
  "track",
  "u",
  "video",
]);

export const trustedFrames = /^https:\/\/codesandbox\.io\/embed\//;

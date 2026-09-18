import { ExternalLink, Play } from "lucide";
import { lucideSvg } from "./tweet.mjs";

const contentClasses = {
  "my-8": "my-8",
  "h-[200px]": "h-[200px]",
  "w-full": "w-full",
  "rounded-xl": "rounded-[12px]",
  "sm:h-[400px]": "sm:h-[400px]",
};

function mapClasses(className = "") {
  return className
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => {
      const mapped = contentClasses[name];
      if (!mapped) {
        throw new Error(`Unsupported youtube-embed class: ${name}`);
      }
      return mapped;
    })
    .join(" ");
}

export function render({ videoId, title, className, imgLink }, { assets, escapeHtml }) {
  assets.script("/assets/embeds/youtube-embed.js");
  const id = escapeHtml(videoId);
  const safeTitle = escapeHtml(title);
  const thumbnail = escapeHtml(
    imgLink ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
  );
  const watch = `https://youtu.be/${id}`;
  const classes = [
    ...new Set(
      `relative aspect-[16/9] w-full overflow-hidden rounded-[12px] border-2 border-[#fff]/30 ${mapClasses(className)}`.split(
        " ",
      ),
    ),
  ]
    .filter(Boolean)
    .join(" ");
  return `<div class="${classes}" data-testid="youtube-embed" data-youtube-embed data-video-id="${id}" data-title="${safeTitle}" data-frame-class="absolute inset-0 size-full border-0"><button type="button" class="relative block size-full cursor-pointer overflow-hidden border-0 bg-transparent p-0" aria-label="Play ${safeTitle}" data-youtube-play><img src="${thumbnail}" alt="Thumbnail for ${safeTitle}" width="1280" height="720" decoding="async" class="block h-auto w-full max-w-full object-cover transition-transform duration-300" /><span class="absolute inset-0 bg-linear-to-t from-[#000]/70 to-[#000]/10"></span><span class="absolute inset-0 flex flex-col items-center justify-center gap-3"><span class="flex items-center justify-center rounded-full bg-[#10b981] p-3 text-[#fff] shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1),0_8px_10px_-6px_rgb(0_0_0/0.1)] transition-transform duration-300 hover:bg-[#34d399] sm:p-4">${lucideSvg(Play, "size-6 sm:size-8")}</span></span></button><div class="group absolute right-3 bottom-3 left-3 flex items-center justify-between rounded-[8px] border border-[#fff]/25 bg-[#000]/80 px-3 py-2 backdrop-blur-[8px] sm:right-4 sm:bottom-4 sm:left-4 sm:px-4 sm:py-3" data-youtube-bar><a href="${watch}" target="_blank" rel="noopener noreferrer" aria-label="Open ${safeTitle} on YouTube" class="line-clamp-1 text-left font-medium text-[#fff] text-xs no-underline leading-[1.33] group-hover:text-[#34d399] sm:text-[14px] sm:leading-[1.43] min-[48rem]:text-base min-[48rem]:leading-[1.5]">${safeTitle}</a><a href="${watch}" target="_blank" rel="noopener noreferrer" class="ml-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#000]/80 text-[#fff] transition-colors duration-300 hover:bg-[#000]/90 sm:size-8"><span class="sr-only">Open ${safeTitle} on YouTube</span>${lucideSvg(ExternalLink, "size-3 text-[#fff] group-hover:text-[#34d399] sm:size-4")}</a></div></div>`;
}

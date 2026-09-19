import { escapeAttribute } from "@pulkit/shared/html";
import {
  Check,
  Code,
  Copy,
  Eye,
  GripVertical,
  Menu,
  RotateCw,
  SidebarClose,
  SidebarOpen,
  WrapText,
} from "lucide";
import type { FrameOptions, HighlightedSource } from "../types.ts";
import { type ButtonVariant, button, cn, type IconNode, icon } from "./ui.ts";

const fullHeightClass = "min-h-[min(92svh,52rem)] h-[min(92svh,52rem)]";
export const fileButtonClass =
  "whitespace-nowrap rounded-none border-(--frame-border) border-r font-mono text-xs";
export const handleClass =
  "group hidden h-full w-6 cursor-col-resize items-center justify-center border-(--frame-border) border-l hover:bg-(--handle-hover)";

function tab(key: string, label: string, node: IconNode, index: number, id: number): string {
  return `<button type="button" role="tab" id="tab-${key}-${id}" data-tab="${key}" data-index="${index}" class="px-3 py-2 text-sm z-10 inline-flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none">${icon(node, "mr-2 h-4 w-4")}<span class="hidden sm:inline">${label}</span><span class="sm:hidden">${label}</span></button>`;
}

function tabs(id: number): string {
  return `<div class="border-(--frame-border) border-b p-1.5 lg:hidden [&>div]:mb-0"><div class="relative mb-6"><div role="tablist" aria-label="Tabs" class="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1">${tab("code", "Code", Code, 0, id)}${tab("preview", "Preview", Eye, 1, id)}<div data-ref="indicator" class="absolute inset-y-1 left-1 z-0 rounded-md border border-border bg-card shadow-sm transition-transform ease-out motion-reduce:transition-none" style="width: calc(50% - 2px)"></div></div></div></div>`;
}

function replayButton(className: string, variant: ButtonVariant = "ghost"): string {
  return button({
    variant,
    size: "icon",
    className: cn("rounded-none", className),
    label: icon(RotateCw, "size-4"),
    attrs: 'data-action="replay" title="Replay animation"',
  });
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function linkFiles(markup: string, filenames: readonly string[]): string {
  if (!markup || filenames.length <= 1) {
    return markup;
  }
  let result = markup;
  for (const filename of filenames) {
    const base = filename.replace(/\.[^.]+$/, "");
    const patterns =
      base === filename
        ? [escapePattern(filename)]
        : [escapePattern(filename), escapePattern(base)];
    for (const pattern of patterns) {
      result = result.replace(
        new RegExp(`(?<=>)([^<]*?)(${pattern})([^<]*?)(?=<)`, "g"),
        (_, before: string, match: string, after: string) =>
          `${before}<span class="file-link" data-filename="${filename}">${match}</span>${after}`,
      );
    }
  }
  return result;
}

export function codeHeightClass(frame: FrameOptions): string {
  return frame.fullHeight
    ? "h-full"
    : cn("h-80 lg:h-full", frame.bitBigger ? "sm:h-102" : "sm:h-96");
}

function previewClass(frame: FrameOptions, hasFiles: boolean): string {
  return frame.fullHeight
    ? "relative flex min-h-0 flex-1 items-stretch overflow-auto"
    : cn(
        "relative grid min-h-80 flex-1 grid-cols-[minmax(0,1fr)] place-items-center overflow-auto lg:min-h-0",
        frame.bitBigger ? "sm:min-h-102" : "sm:min-h-96",
        frame.replayButton && !hasFiles && "pb-14",
      );
}

function codePanel(frame: FrameOptions, files: readonly HighlightedSource[]): string {
  const fileButtons = files
    .map((file, index) =>
      button({
        variant: index === 0 ? "secondary" : "ghost",
        className: fileButtonClass,
        label: escapeAttribute(file.filename),
        attrs: `data-file="${index}"`,
      }),
    )
    .join("");
  return `<div data-ref="code" class="${cn("relative min-w-0", codeHeightClass(frame))} border-(--frame-border) border-b bg-(--code-bg) lg:border-b-0"><div class="flex w-full flex-1 flex-col overflow-hidden"><div class="flex items-center justify-between border-(--frame-border) border-b"><div class="flex flex-1 items-center overflow-hidden">${button({ variant: "ghost", size: "icon", className: "hidden shrink-0 rounded-none border-(--frame-border) border-r lg:flex", label: icon(SidebarClose, "size-4"), attrs: 'data-action="hide-code" title="Hide code panel"' })}<div class="flex w-full items-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">${fileButtons}</div></div><div class="flex shrink-0 items-center">${button({ variant: "ghost", size: "icon", className: "rounded-none border-l-2", label: `${icon(WrapText, "size-4")}${icon(Menu, "size-4")}`, attrs: 'data-action="wrap"' })}${button({ variant: "ghost", size: "icon", className: "rounded-none border-l-2", label: `${icon(Check, "size-4")}${icon(Copy, "size-4")}`, attrs: 'data-action="copy" title="Copy code"' })}</div></div><div data-ref="scroller" tabindex="0" class="flex-1 overflow-auto p-4 [scrollbar-width:none]"><div data-ref="highlighted"></div></div></div></div>`;
}

export function frameMarkup(
  frame: FrameOptions,
  files: readonly HighlightedSource[],
  id: number,
): string {
  const hasFiles = files.length > 0;
  const desktopHeightClass = frame.bitBigger ? "lg:h-128" : "lg:h-112";
  const heightClass = frame.fullHeight ? fullHeightClass : desktopHeightClass;
  const previewBar = hasFiles
    ? `<div class="hidden items-center justify-between border-(--frame-border) border-b lg:flex">${button({ variant: "ghost", size: "icon", className: "rounded-none transition-none", label: icon(SidebarOpen, "size-4"), attrs: 'data-action="show-code" title="Show code"' })}${frame.replayButton ? replayButton("rounded-none") : ""}</div>`
    : "";
  return `<div class="relative my-6 overflow-hidden rounded-md border border-(--frame-border) bg-(--frame-bg)">${frame.replayButton && !hasFiles ? replayButton("absolute right-4 bottom-4 z-2 rounded-md", "secondary") : ""}${hasFiles ? tabs(id) : ""}<div data-ref="container" class="${cn("flex flex-col lg:flex-row", heightClass)}">${hasFiles ? codePanel(frame, files) : ""}<button type="button" data-ref="handle" aria-label="Resize panels" class="${handleClass}">${icon(GripVertical, "size-4 text-(--grip) group-hover:text-(--grip-hover)")}</button><div data-ref="previewColumn">${previewBar}<div data-ref="preview" class="${previewClass(frame, hasFiles)}"></div></div></div></div>`;
}

import { readFileSync } from "node:fs";
import profile from "@pulkit/profile";
import { escapeXml as xml } from "@pulkit/shared/html";
import { themeFile } from "@pulkit/theme/files";
import { Resvg, type ResvgRenderOptions } from "@resvg/resvg-js";
import type { GenerationCache } from "../lib/generation-cache.ts";
import { longDate } from "../render/html.ts";
import type { ListedPage, Site, SiteContext } from "../types.ts";
import { categoryOf, imagePath, isArticle, parentRoute } from "./routes.ts";

const cardWidth = 1200;
const cardHeight = 630;
const left = 88;
export const titleMaxWidth = 560;
const titleSizes = [128, 112, 96, 84, 72, 64, 56, 50, 44];
const blockTop = 160;
export const safeBottom = 500;
const maxSubtitleLines = 3;
const subtitleSize = (titleSize: number) =>
  Math.round(Math.min(40, Math.max(28, titleSize * 0.42)));
const subtitleGap = (titleSize: number) => subtitleSize(titleSize) * 1.55;
const subtitleLineHeight = (titleSize: number) => subtitleSize(titleSize) * 1.2;
const subtitleReserve = (size: number, lines: number) =>
  lines === 0 ? 0 : subtitleGap(size) + (lines - 1) * subtitleLineHeight(size);
const titleMaxHeight = (size: number, subtitleLines: number) =>
  safeBottom - blockTop - subtitleReserve(size, subtitleLines);
const palette = { background: "#181916", text: "#e9e9e1", muted: "#a5a69b", accent: "#d6b48c" };
const serif = "Instrument Serif";
const mono = "Geist Mono";

const ogFile = (name: string) => themeFile(`og/${name}`);
const renderOptions: ResvgRenderOptions = {
  font: {
    loadSystemFonts: false,
    fontFiles: [
      ogFile("instrument-serif-regular.ttf"),
      ogFile("instrument-serif-italic.ttf"),
      ogFile("geist-mono-regular.ttf"),
    ],
    defaultFontFamily: serif,
  },
};

let images: { portrait: string; monogram: string } | undefined;
function cardImages(): { portrait: string; monogram: string } {
  images ??= {
    portrait: `data:image/jpeg;base64,${readFileSync(ogFile("portrait.jpg")).toString("base64")}`,
    monogram: `data:image/svg+xml;base64,${readFileSync(ogFile("monogram.svg")).toString("base64")}`,
  };
  return images;
}

const titleTracking = -0.022;

const inkBoxes = new Map<string, string>();
function inkBox(text: string, family: string): string {
  const key = `${family}:${text}`;
  let box = inkBoxes.get(key);
  if (box === undefined) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="200"><text x="0" y="150" font-family="${family}" font-size="100" xml:space="preserve">${xml(text)}</text></svg>`;
    const bounds = new Resvg(svg, renderOptions).getBBox();
    box = bounds ? [bounds.x, bounds.y, bounds.width, bounds.height].join(",") : "";
    inkBoxes.set(key, box);
  }
  return box;
}

const inkWidth = (text: string, family: string) => Number(inkBox(text, family).split(",")[2] ?? 0);

function glyphFamily(char: string): string {
  const covered = char.charCodeAt(0) < 128 || inkBox(char, serif) !== inkBox(char, mono);
  return covered ? serif : mono;
}

export function titleWidth(text: string, size: number): number {
  const advances = [...text].reduce((sum, char) => {
    const family = glyphFamily(char);
    return sum + inkWidth(`I${char}I`, family) - inkWidth("II", family);
  }, 0);
  return (advances * size) / 100 + [...text].length * titleTracking * size;
}

function titleRuns(line: string, x: number, y: number, size: number): string {
  const runs = [...line].reduce<{ family: string; text: string }[]>((result, char) => {
    const family = glyphFamily(char);
    const last = result.at(-1);
    if (last?.family === family) {
      last.text += char;
    } else {
      result.push({ family, text: char });
    }
    return result;
  }, []);
  let cursor = x;
  return runs
    .map(({ family, text }) => {
      const tspan = `<tspan x="${cursor}" y="${y}" font-family="${family}" xml:space="preserve">${xml(text)}</tspan>`;
      cursor += titleWidth(text, size);
      return tspan;
    })
    .join("");
}

function greedyWrap(words: readonly string[], size: number, limit: number): string[] {
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last !== undefined && titleWidth(`${last} ${word}`, size) <= limit) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines;
}

function wrap(title: string, size: number): string[] {
  const words = title.split(/\s+/);
  const lineCount = greedyWrap(words, size, titleMaxWidth).length;
  let low = Math.max(...words.map((word) => titleWidth(word, size)));
  let high = titleMaxWidth;
  while (high - low > 1) {
    const middle = (low + high) / 2;
    if (greedyWrap(words, size, middle).length <= lineCount) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return greedyWrap(words, size, high);
}

const capHeight = (size: number) => size * 0.72;
const lineHeight = (size: number) => size * 1.05;
const titleHeight = (size: number, lines: number) =>
  capHeight(size) + (lines - 1) * lineHeight(size);

function fitSubtitleLine(text: string, size: number): string {
  if (titleWidth(text, size) <= titleMaxWidth) {
    return text;
  }
  const words = text.split(/\s+/);
  let line = words[0] ?? "";
  for (const word of words.slice(1)) {
    if (titleWidth(`${line} ${word}…`, size) <= titleMaxWidth) {
      line = `${line} ${word}`;
    } else {
      break;
    }
  }
  return `${line}…`;
}

export function wrapSubtitle(
  text: string,
  preferredSize: number,
): { size: number; lines: string[] } {
  const words = text.replace(/\s+/g, " ").trim().split(/\s+/);
  for (let size = preferredSize; size >= 28; size -= 2) {
    const lines = greedyWrap(words, size, titleMaxWidth);
    if (lines.length <= maxSubtitleLines) {
      return { size, lines };
    }
  }
  const size = 28;
  const lines = greedyWrap(words, size, titleMaxWidth);
  return {
    size,
    lines: [
      ...lines.slice(0, maxSubtitleLines - 1),
      fitSubtitleLine(lines.slice(maxSubtitleLines - 1).join(" "), size),
    ],
  };
}

export function titleLayout(
  title: string,
  subtitle?: string,
): { size: number; lines: string[]; subtitleLines: string[]; subtitleSize: number } {
  for (const size of titleSizes) {
    const wrapped =
      subtitle === undefined
        ? { size: 0, lines: [] as string[] }
        : wrapSubtitle(subtitle, subtitleSize(size));
    const lines = wrap(title, size);
    if (
      titleHeight(size, lines.length) <= titleMaxHeight(size, wrapped.lines.length) &&
      lines.every((line) => titleWidth(line, size) <= titleMaxWidth)
    ) {
      return {
        size,
        lines,
        subtitleLines: wrapped.lines,
        subtitleSize: wrapped.size,
      };
    }
  }
  const size = titleSizes.at(-1) ?? 44;
  const wrapped =
    subtitle === undefined
      ? { size: 0, lines: [] as string[] }
      : wrapSubtitle(subtitle, subtitleSize(size));
  return {
    size,
    lines: wrap(title, size),
    subtitleLines: wrapped.lines,
    subtitleSize: wrapped.size,
  };
}

export type CardKind = "home" | "dated" | "directory" | "page";

export function cardKind(page: ListedPage): CardKind {
  if (page.route === "/") {
    return "home";
  }
  if (page.metadata.period !== undefined || page.metadata.date !== undefined) {
    return "dated";
  }
  if (page.metadata.layout === "directory") {
    return "directory";
  }
  return "page";
}

export function cardCategory(
  page: ListedPage,
  pages: readonly ListedPage[],
  site: SiteContext,
): string {
  if (page.index) {
    return page.metadata.title;
  }
  if (page.metadata.layout === "directory") {
    return (
      categoryOf(page.route, pages)?.metadata.title ??
      nearestAncestor(page.route, pages)?.metadata.title ??
      page.metadata.title.replace(/, page \d+$/u, "")
    );
  }
  return (
    categoryOf(page.route, pages)?.metadata.title ??
    nearestAncestor(page.route, pages)?.metadata.title ??
    (isArticle(page.route, pages, site) || page.route === site.articles ? "Writing" : "Portfolio")
  );
}

function nearestAncestor(route: string, pages: readonly ListedPage[]): ListedPage | undefined {
  for (
    let parent = parentRoute(route);
    parent !== "/" && parent !== "";
    parent = parentRoute(parent)
  ) {
    const page = pages.find((entry) => entry.route === parent);
    if (page) {
      return page;
    }
  }
  return undefined;
}

export function cardSubtitle(page: ListedPage): string | undefined {
  const { period, date, description, tags } = page.metadata;
  switch (cardKind(page)) {
    case "home":
      return profile.role;
    case "dated":
      return period ?? (date === undefined ? undefined : longDate(date));
    case "directory":
      return tags?.[0] ?? description?.replace(/\s+/g, " ").trim();
    case "page":
      return description?.replace(/\s+/g, " ").trim();
  }
}

const label = (x: number, y: number, fill: string, text: string) =>
  `<text x="${x}" y="${y}" font-family="${mono}" font-size="16" letter-spacing="1.3" fill="${fill}">${xml(text.toUpperCase())}</text>`;

const defs = `<linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="${palette.background}"/><stop offset="0.3" stop-color="${palette.background}" stop-opacity="0.6"/><stop offset="0.6" stop-color="${palette.background}" stop-opacity="0"/></linearGradient><radialGradient id="edge" cx="0.45" cy="0.45" r="0.7"><stop offset="0.5" stop-color="${palette.background}" stop-opacity="0"/><stop offset="1" stop-color="${palette.background}" stop-opacity="0.85"/></radialGradient><filter id="tone"><feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0.02 0.31 0.31 0.31 0 0.02 0.27 0.27 0.27 0 0.01 0 0 0 1 0"/><feComponentTransfer><feFuncR type="linear" slope="0.82"/><feFuncG type="linear" slope="0.82"/><feFuncB type="linear" slope="0.82"/></feComponentTransfer></filter>`;

export function cardSvg(page: ListedPage, category: string): string {
  const { portrait, monogram } = cardImages();
  const {
    size,
    lines,
    subtitleLines,
    subtitleSize: subSize,
  } = titleLayout(page.metadata.title, cardSubtitle(page));
  const height = titleHeight(size, lines.length) + subtitleReserve(size, subtitleLines.length);
  const top = blockTop + (safeBottom - blockTop - height) / 2;
  const subtitleY = top + titleHeight(size, lines.length) + subtitleGap(size);
  const title = lines
    .map((line, index) =>
      titleRuns(line, left - size * 0.03, top + capHeight(size) + index * lineHeight(size), size),
    )
    .join("");
  const subtitleText =
    subtitleLines.length === 0
      ? ""
      : `<text font-family="${serif}" font-style="italic" font-size="${subSize}" fill="${palette.muted}">${subtitleLines
          .map(
            (line, index) =>
              `<tspan x="${left}" y="${subtitleY + index * subtitleLineHeight(size)}">${xml(line)}</tspan>`,
          )
          .join("")}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}"><defs>${defs}</defs><rect width="${cardWidth}" height="${cardHeight}" fill="${palette.background}"/><image href="${portrait}" x="630" y="0" width="630" height="630" preserveAspectRatio="xMidYMid slice" filter="url(#tone)"/><rect x="630" width="570" height="${cardHeight}" fill="url(#fade)"/><rect x="630" width="570" height="${cardHeight}" fill="url(#edge)"/><image href="${monogram}" x="${left}" y="72" width="31" height="40"/>${label(left + 52, 99, palette.accent, category)}<text font-family="${serif}" font-size="${size}" letter-spacing="${titleTracking * size}" fill="${palette.text}">${title}</text>${subtitleText}</svg>`;
}

export function renderCard(page: ListedPage, category: string): Buffer {
  return new Resvg(cardSvg(page, category), renderOptions).render().asPng();
}

export function cardOutputs(
  pages: readonly ListedPage[],
  site: Site,
  cache: GenerationCache,
): Map<string, Buffer> {
  const output = new Map<string, Buffer>();
  for (const page of pages) {
    const category = cardCategory(page, pages, site);
    const encoded = cache.get(
      "card",
      [
        page.route,
        page.metadata.title,
        page.metadata.description,
        page.metadata.date,
        page.metadata.period,
        page.metadata.layout,
        page.metadata.tags,
        category,
      ],
      () => renderCard(page, category).toString("base64"),
    );
    output.set(imagePath(page.route).slice(1), Buffer.from(encoded, "base64"));
  }
  return output;
}

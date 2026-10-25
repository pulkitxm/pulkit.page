import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { builtFiles } from "@pulkit/shared/built-site";
import { sha256Hex } from "@pulkit/shared/hash";
import { type DefaultTreeAdapterMap, parse, serializeOuter } from "parse5";
import sharp from "sharp";

type Element = DefaultTreeAdapterMap["element"];
type Node = DefaultTreeAdapterMap["node"];

interface Image {
  width: number;
  height: number;
  variants: { width: number; src: string }[];
  backdrop: string;
}

function attribute(element: Element, name: string): string | undefined {
  return element.attrs.find((entry) => entry.name === name)?.value;
}

function setAttribute(element: Element, name: string, value: string): void {
  const entry = element.attrs.find((candidate) => candidate.name === name);
  if (entry) {
    entry.value = value;
  } else {
    element.attrs.push({ name, value });
  }
}

function images(node: Node): Element[] {
  const descendants = "childNodes" in node ? node.childNodes.flatMap(images) : [];
  return "tagName" in node && node.tagName === "img" ? [node, ...descendants] : descendants;
}

function inCarousel(element: Element): boolean {
  let node: Node | null = element.parentNode;
  while (node) {
    if ("tagName" in node && attribute(node, "data-carousel-slide") !== undefined) {
      return true;
    }
    node = "parentNode" in node ? node.parentNode : null;
  }
  return false;
}

function displaySizes(element: Element, image: Image): string {
  const classes = attribute(element, "class")?.split(/\s+/) ?? [];
  if (classes.includes("size-7")) {
    return "28px";
  }
  if (classes.includes("size-9")) {
    return "36px";
  }
  if (classes.includes("size-10")) {
    return classes.includes("sm:size-12") ? "(min-width: 40rem) 48px, 40px" : "40px";
  }
  if (attribute(element, "data-gallery-image") !== undefined) {
    const containedWidth = Math.ceil((256 * image.width) / image.height);
    return `(min-width: 760px) ${Math.min(344, containedWidth)}px, (min-width: 561px) min(calc(50vw - 36px), ${containedWidth}px), min(calc(100vw - 44px), ${containedWidth}px)`;
  }
  if (classes.includes("size-36")) {
    return "144px";
  }
  const ratio = inCarousel(element) ? Math.min(1, (image.width / image.height) * (9 / 16)) : 1;
  const desktop = Math.round(704 * ratio);
  const mobile = Number((100 * ratio).toFixed(2));
  const inset = Number((44 * ratio).toFixed(2));
  const mediumInset = Number((56 * ratio).toFixed(2));
  return `(min-width: 760px) ${desktop}px, (min-width: 640px) calc(${mobile}vw - ${mediumInset}px), calc(${mobile}vw - ${inset}px)`;
}

export async function optimizeImages(outputDirectory: string): Promise<number> {
  const root = resolve(outputDirectory);
  const variants = new Map<string, Promise<Image | undefined>>();
  const cache = resolve(".cache/responsive-images");
  const widths = [96, 192, 320, 384, 480, 640, 672, 768, 960, 1280];
  let optimized = 0;

  async function prepare(src: string, priority: boolean): Promise<Image | undefined> {
    if (
      src.startsWith("/assets/responsive/") ||
      !/^\/assets\/[^?#]+\.(?:png|jpe?g|webp)$/i.test(src)
    ) {
      return;
    }
    const source = resolve(root, `.${src}`);
    if (!source.startsWith(`${root}${sep}`) || !existsSync(source)) {
      return;
    }
    const bytes = readFileSync(source);
    const metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
      return;
    }
    const hash = sha256Hex(bytes).slice(0, 16);
    async function variant(
      width: number,
      quality: number,
      format: "webp" | "avif" = "webp",
    ): Promise<string> {
      const name = `${hash}-${width}-${quality}.${format}`;
      const stored = resolve(cache, name);
      if (!existsSync(stored)) {
        mkdirSync(cache, { recursive: true });
        const image = sharp(bytes).resize({ width, withoutEnlargement: true });
        await (format === "avif"
          ? image.avif({ quality, effort: 4, chromaSubsampling: "4:4:4" })
          : image.webp({ quality })
        ).toFile(stored);
      }
      const destination = resolve(root, "assets/responsive", name);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, readFileSync(stored));
      return `/assets/responsive/${name}`;
    }
    const candidates: Image["variants"] = [];
    for (const width of widths.filter((candidate) => candidate < metadata.width)) {
      const webp = await variant(width, 85);
      const avif = priority ? await variant(width, 67, "avif") : undefined;
      const selected =
        avif &&
        readFileSync(resolve(root, `.${avif}`)).length <
          readFileSync(resolve(root, `.${webp}`)).length
          ? avif
          : webp;
      candidates.push({ width, src: selected });
    }
    candidates.push({ width: metadata.width, src });
    return {
      width: metadata.width,
      height: metadata.height,
      variants: candidates,
      backdrop: await variant(Math.min(160, metadata.width), 80),
    };
  }

  for (const file of builtFiles(root).filter((candidate) => candidate.endsWith(".html"))) {
    const html = readFileSync(file, "utf8");
    const replacements: { start: number; end: number; html: string }[] = [];
    for (const element of images(parse(html, { sourceCodeLocationInfo: true }))) {
      const src = attribute(element, "src");
      const location = element.sourceCodeLocation;
      if (!src || !location || attribute(element, "srcset")) {
        continue;
      }
      const priority = attribute(element, "fetchpriority") === "high";
      const key = `${src}:${priority}`;
      let pending = variants.get(key);
      if (!pending) {
        pending = prepare(src, priority);
        variants.set(key, pending);
      }
      const image = await pending;
      if (!image) {
        continue;
      }
      if (
        attribute(element, "data-gallery-backdrop") !== undefined ||
        (attribute(element, "aria-hidden") === "true" && inCarousel(element))
      ) {
        setAttribute(element, "src", image.backdrop);
      } else {
        setAttribute(
          element,
          "srcset",
          image.variants.map(({ src: candidate, width }) => `${candidate} ${width}w`).join(", "),
        );
        setAttribute(element, "sizes", displaySizes(element, image));
      }
      setAttribute(element, "decoding", "async");
      replacements.push({
        start: location.startOffset,
        end: location.endOffset,
        html: serializeOuter(element).replace(/>$/, " />"),
      });
      optimized += 1;
    }
    let updated = html;
    for (const replacement of replacements.reverse()) {
      updated =
        updated.slice(0, replacement.start) + replacement.html + updated.slice(replacement.end);
    }
    if (replacements.length > 0) {
      writeFileSync(file, updated);
    }
  }
  return optimized;
}

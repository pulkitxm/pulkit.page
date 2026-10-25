import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { optimizeImages } from "./responsive-images.ts";

test("responsive copies preserve original downloads and layout", async () => {
  const directory = mkdtempSync(join(tmpdir(), "responsive-images-"));
  try {
    mkdirSync(join(directory, "assets"));
    const sourceHeight = 1600;
    const source = await sharp({
      create: { width: 1200, height: sourceHeight, channels: 3, background: "#1977bb" },
    })
      .webp()
      .toBuffer();
    writeFileSync(join(directory, "assets/photo.webp"), source);
    const html = [
      "<!doctype html>",
      "<html>",
      "<body>",
      "<h1>Gallery</h1>",
      "<section data-carousel-slide>",
      '<img src="/assets/photo.webp" alt="" aria-hidden="true"',
      ' width="1200"',
      ` height="${sourceHeight}">`,
      '<a href="/assets/photo.webp" data-media-zoom>',
      '<img src="/assets/photo.webp" alt="Photo" width="1200" height="1600" class="object-contain" loading="eager" fetchpriority="high">',
      '</a></section><img src="https://example.com/photo.webp">',
      '<img src="/assets/photo.webp" class="size-9">',
      '<img src="/assets/photo.webp" alt="" aria-hidden="true" data-gallery-backdrop loading="lazy">',
      '<img src="/assets/photo.webp" alt="Portrait" data-gallery-image loading="lazy">',
      '<script>const label = "<img>";</script></body></html>',
    ].join("");
    writeFileSync(join(directory, "index.html"), html);
    expect(await optimizeImages(directory)).toBe(5);
    const updated = readFileSync(join(directory, "index.html"), "utf8");
    expect(updated).toContain('<a href="/assets/photo.webp" data-media-zoom>');
    expect(updated).toContain(
      'sizes="(min-width: 760px) 297px, (min-width: 640px) calc(42.19vw - 23.63px), calc(42.19vw - 18.56px)"',
    );
    expect(updated).toContain('sizes="36px"');
    expect(updated).toContain(
      'width="1200" height="1600" class="object-contain" loading="eager" fetchpriority="high"',
    );
    expect(updated).toContain('<img src="https://example.com/photo.webp">');
    expect(updated).toContain('<script>const label = "<img>";</script>');
    expect(readFileSync(join(directory, "assets/photo.webp"))).toEqual(source);
    const backdrop = updated.match(/src="(\/assets\/responsive\/[^"]+-160-80.webp)"/)?.[1];
    expect(backdrop).toBeDefined();
    expect((await sharp(join(directory, backdrop ?? "")).metadata()).width).toBe(160);
    const galleryBackdrop = updated.match(/<img[^>]+data-gallery-backdrop[^>]*>/)?.[0];
    expect(galleryBackdrop).toContain(`src="${backdrop}"`);
    expect(galleryBackdrop).not.toContain("srcset");
    expect(galleryBackdrop).toContain('loading="lazy"');
    const galleryImage = updated.match(/<img[^>]+data-gallery-image[^>]*>/)?.[0];
    expect(galleryImage).toContain('sizes="(min-width: 760px) 192px,');
    expect(galleryImage).toContain("(min-width: 561px) min(calc(50vw - 36px), 192px)");
    const full = updated.match(/srcset="([^"]+)"/)?.[1];
    expect(full).toContain("/assets/photo.webp 1200w");
    const intermediate = full?.match(/(\/assets\/responsive\/[^, ]+) 672w/)?.[1];
    expect(intermediate).toBeDefined();
    const intermediateSize = await sharp(join(directory, intermediate ?? "")).metadata();
    expect(intermediateSize.width).toBe(672);
    expect(intermediateSize.height).toBe(896);
    for (const candidate of full?.split(", ") ?? []) {
      const selected = candidate.split(" ")[0] ?? "";
      if (!selected.startsWith("/assets/responsive/")) {
        continue;
      }
      const webp = selected.replace(/-67\.avif$/, "-85.webp");
      expect(readFileSync(join(directory, selected)).length).toBeLessThanOrEqual(
        readFileSync(join(directory, webp)).length,
      );
    }
    const icon = updated.match(/<img[^>]+class="size-9"[^>]*>/)?.[0];
    expect(icon).not.toContain(".avif");
    expect(await optimizeImages(directory)).toBe(0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("AVIF sources receive responsive copies and retain their full-size download", async () => {
  const directory = mkdtempSync(join(tmpdir(), "responsive-avif-"));
  try {
    mkdirSync(join(directory, "assets"));
    const source = await sharp({
      create: { width: 400, height: 200, channels: 3, background: "#1977bb" },
    })
      .avif()
      .toBuffer();
    writeFileSync(join(directory, "assets/photo.avif"), source);
    writeFileSync(join(directory, "index.html"), '<img src="/assets/photo.avif" alt="Photo">');
    expect(await optimizeImages(directory)).toBe(1);
    const html = readFileSync(join(directory, "index.html"), "utf8");
    expect(html).toContain("/assets/responsive/");
    expect(html).toContain("/assets/photo.avif 400w");
    expect(readFileSync(join(directory, "assets/photo.avif"))).toEqual(source);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

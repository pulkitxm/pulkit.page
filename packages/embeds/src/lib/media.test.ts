import { expect, test } from "bun:test";
import { createPageAssets, renderEmbed } from "../index.ts";

const pictures = ["/assets/sample-a.webp", "/assets/sample-b.webp", "/assets/sample-c.webp"];
const gallery = pictures.map((src) => ({ src, width: 1200, height: 800, alt: "Sample" }));

test("galleries default to lazy images and only explicit priority loads eagerly", () => {
  for (const [name, images] of [
    ["blog-gallery", gallery],
    ["image-grid", pictures],
    ["image-grid", pictures.slice(0, 2)],
  ] as const) {
    const lazy = renderEmbed(name, { images }, createPageAssets(), false);
    expect(lazy).not.toContain('loading="eager"');
    expect(lazy).not.toContain('fetchpriority="high"');
    const assets = createPageAssets();
    const eager = renderEmbed(name, { images, loading: "eager" }, assets, false);
    const backdrops = eager.match(/<img[^>]+aria-hidden="true"[^>]*>/g) ?? [];
    const priorityImages = backdrops.length > 0 ? 2 : 1;
    expect(eager.match(/loading="eager"/g)).toHaveLength(priorityImages);
    expect(eager.match(/fetchpriority="high"/g)).toHaveLength(priorityImages);
    if (backdrops.length > 0) {
      expect(backdrops[0]).toContain('loading="eager" fetchpriority="high"');
      expect(backdrops.slice(1).every((image) => image.includes('loading="lazy"'))).toBe(true);
    }
    const later = renderEmbed(name, { images, loading: "eager" }, assets, false);
    expect(later).not.toContain('loading="eager"');
    expect(later).not.toContain('fetchpriority="high"');
    expect(() =>
      renderEmbed(name, { images, loading: "urgent" }, createPageAssets(), false),
    ).toThrow("Unsupported gallery loading");
  }
});

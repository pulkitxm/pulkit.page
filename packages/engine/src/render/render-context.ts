import type { createPageAssets } from "@pulkit/embeds";
import { lightboxScript, lightboxStyle, localImageSize } from "@pulkit/embeds/lightbox";
import type { GenerationCache } from "../lib/generation-cache.ts";
import type { ListedPage, SiteContext } from "../types.ts";

export type PageAssets = ReturnType<typeof createPageAssets>;

export interface RenderContext {
  assets: PageAssets;
  cache: GenerationCache | undefined;
  pages: readonly ListedPage[];
  route: string;
  site: SiteContext;
}

export function sizeAttributes(href: string): string {
  const size = localImageSize(href);
  return size ? ` width="${size.width}" height="${size.height}"` : "";
}

export function zoomAttributes(href: string, assets: PageAssets): string {
  const size = localImageSize(href);
  assets.style(lightboxStyle);
  assets.script(lightboxScript);
  return size
    ? ` data-media-zoom data-width="${size.width}" data-height="${size.height}"`
    : " data-media-zoom";
}

interface TokenStore<T> {
  create(type: string, raw: string, value: T): { type: string; raw: string };
  read(token: { type: string }): T;
}

export function tokenStore<T>(): TokenStore<T> {
  const values = new WeakMap<object, T>();
  return {
    create(type, raw, value) {
      const token = { type, raw };
      values.set(token, value);
      return token;
    },
    read(token) {
      const value = values.get(token);
      if (value === undefined) {
        throw new Error(`Unexpected ${token.type} token`);
      }
      return value;
    },
  };
}

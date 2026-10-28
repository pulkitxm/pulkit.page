import { resolve } from "node:path";
import profile from "@pulkit/profile";
import { setMountedAssets } from "@pulkit/theme/files";
import type { SiteMount } from "../types.ts";

const fence = /^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm;
const listCollection = /^:::list (?!all\b|[a-z0-9-]+:all\b)([a-z0-9/-]+)/gm;
const rootLink = /(\]\(|href="|"href":"|"documentUrl":")\/(?!\/|assets\/)/g;

export function mountRoot(mount: SiteMount): string {
  const sites: Readonly<Record<string, string>> = profile.sites;
  if (!Object.hasOwn(sites, mount.site)) {
    throw new Error(`Unknown site in mounts: ${mount.site}`);
  }
  return `../${mount.site}`;
}

export function mountRoute(mount: SiteMount, route: string): string {
  return mount.route === "/" ? route : `${mount.route.slice(0, -1)}${route}`;
}

function outsideFences(text: string, rewrite: (prose: string) => string): string {
  let result = "";
  let last = 0;
  for (const match of text.matchAll(fence)) {
    result += rewrite(text.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  return result + rewrite(text.slice(last));
}

export function localizeLinks(
  text: string,
  mounts: readonly SiteMount[],
  mount?: SiteMount,
): string {
  const sites: Readonly<Record<string, string>> = profile.sites;
  return outsideFences(text, (prose) => {
    let localized =
      mount && mount.route !== "/"
        ? prose
            .replace(rootLink, (_, opening: string) => `${opening}${mount.route}`)
            .replace(
              listCollection,
              (_, collection: string) => `:::list ${mount.route.slice(1)}${collection}`,
            )
        : prose;
    for (const target of mounts) {
      const origin = sites[target.site];
      if (origin) {
        const host = new URL(origin).host.replaceAll(".", "\\.");
        localized = localized.replace(
          new RegExp(`https?://(?:www\\.)?${host}(?:/|(?![\\w./-]))`, "g"),
          target.route,
        );
      }
    }
    return localized;
  });
}

export function registerMountedAssets(mounts: readonly SiteMount[]): void {
  setMountedAssets(mounts.map((mount) => resolve(mountRoot(mount), "assets")));
}

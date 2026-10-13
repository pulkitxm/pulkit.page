import type { IconDefinition } from "@fortawesome/free-brands-svg-icons";
import {
  faBehance,
  faBluesky,
  faDribbble,
  faFacebook,
  faGithub,
  faInstagram,
  faLinkedin,
  faMastodon,
  faMedium,
  faNpm,
  faReddit,
  faRust,
  faStackOverflow,
  faThreads,
  faTwitch,
  faXTwitter,
  faYoutube,
} from "@fortawesome/free-brands-svg-icons";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";
import { escapeHtml } from "@pulkit/shared/html";
import { faSvg } from "@pulkit/shared/icons";
import { safeUrl } from "./html.ts";

const platformIcons: Record<string, IconDefinition> = {
  "linkedin.com": faLinkedin,
  "x.com": faXTwitter,
  "twitter.com": faXTwitter,
  "github.com": faGithub,
  "instagram.com": faInstagram,
  "youtube.com": faYoutube,
  "bsky.app": faBluesky,
  "mastodon.social": faMastodon,
  "facebook.com": faFacebook,
  "reddit.com": faReddit,
  "twitch.tv": faTwitch,
  "npmjs.com": faNpm,
  "threads.net": faThreads,
  "medium.com": faMedium,
  "stackoverflow.com": faStackOverflow,
  "dribbble.com": faDribbble,
  "behance.net": faBehance,
  "crates.io": faRust,
};

export function linkLabel(href: string): string {
  const url = new URL(href);
  return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
}

export function linkIcon(href: string, size = "size-4.5"): string {
  const host = new URL(href).hostname.replace(/^(?:www|m)\./, "");
  return faSvg(platformIcons[host] ?? faGlobe, size);
}

export function companyLinks(links: readonly string[] | undefined): string {
  if (!links?.length) {
    return "";
  }
  return `<ul class="mt-0 mb-6 flex list-none flex-wrap items-center gap-3.5 p-0">${links
    .map((href) => {
      if (!href.startsWith("https://")) {
        throw new Error(`Company links must use https: ${href}`);
      }
      const label = escapeHtml(linkLabel(href));
      return `<li class="flex"><a class="flex text-muted transition-colors duration-150 hover:text-fg" href="${safeUrl(href)}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}">${linkIcon(href)}</a></li>`;
    })
    .join("")}</ul>`;
}

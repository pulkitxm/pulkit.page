import { readFileSync } from "node:fs";
import { guestbookEntries, guestbookSettings } from "@pulkit/shared/guestbook";
import type { SiteContext } from "../types.ts";

export function readGuestbook(): NonNullable<SiteContext["guestbook"]> {
  const entries = guestbookEntries.parse(JSON.parse(readFileSync("data/guestbook.json", "utf8")));
  const settings = guestbookSettings.parse(
    JSON.parse(readFileSync("data/guestbook-settings.json", "utf8")),
  );
  return {
    entries,
    githubFormUrl: `https://github.com/${settings.repository}/issues/new?template=guestbook.yml&title=Guestbook+message`,
    googleFormUrl: settings.googleFormUrl,
  };
}

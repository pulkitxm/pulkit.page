import { readFileSync } from "node:fs";
import { join } from "node:path";
import { guestbookEntries, guestbookSettings } from "@pulkit/shared/guestbook";
import type { SiteContext } from "../types.ts";

export function readGuestbook(root = "."): NonNullable<SiteContext["guestbook"]> {
  const entries = guestbookEntries.parse(
    JSON.parse(readFileSync(join(root, "data/guestbook.json"), "utf8")),
  );
  const settings = guestbookSettings.parse(
    JSON.parse(readFileSync(join(root, "data/guestbook-settings.json"), "utf8")),
  );
  return {
    entries,
    githubFormUrl: `https://github.com/${settings.repository}/issues/new?template=guestbook.yml&title=Guestbook+message`,
    googleFormUrl: settings.googleFormUrl,
  };
}

import process from "node:process";
import { socialProfile } from "@pulkit/shared/guestbook";
import { readEntries, writeEntries } from "../lib/store.ts";
import { type ProfileStatus, profileStatus } from "../lib/verify.ts";

async function verifyLinks(mode: "report" | "strict" | "write"): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required");
  }
  const annotate = process.env.GITHUB_ACTIONS === "true";
  const entries = await readEntries();
  let unsupported = 0;
  for (const entry of entries) {
    for (const href of entry.links ?? []) {
      if (!socialProfile(href)) {
        unsupported++;
        const message = `${entry.name} (${entry.id}): ${href} is not a supported social profile and is not shown`;
        console.log(
          annotate
            ? `::warning title=Unsupported guestbook link::${message}`
            : `skipped ${message}`,
        );
      }
    }
  }
  const profiles = new Map(
    entries
      .flatMap((entry) => [
        ...(entry.github ? [`https://github.com/${entry.github}`] : []),
        ...(entry.links ?? []),
      ])
      .flatMap((href) => socialProfile(href) ?? [])
      .map((profile) => [profile.url.toLowerCase(), profile]),
  );
  const statuses = new Map<string, ProfileStatus>();
  const queue = [...profiles];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const [key, profile] = next;
        statuses.set(key, await profileStatus(profile, token));
      }
    }),
  );
  const missing = (href: string): boolean => {
    const profile = socialProfile(href);
    return profile ? statuses.get(profile.url.toLowerCase()) === "missing" : false;
  };
  for (const entry of entries) {
    for (const href of [
      ...(entry.github ? [`https://github.com/${entry.github}`] : []),
      ...(entry.links ?? []),
    ]) {
      if (missing(href)) {
        const message = `${entry.name} (${entry.id}): ${href} no longer exists`;
        console.log(
          annotate
            ? `::error title=Unavailable guestbook profile::${message}`
            : `missing ${message}`,
        );
      }
    }
  }
  const counts = [...statuses.values()];
  const removed = counts.filter((status) => status === "missing").length;
  console.log(
    `Checked ${profiles.size} guestbook profiles: ${removed} missing, ${
      counts.filter((status) => status === "unknown").length
    } inconclusive.`,
  );
  if (mode === "write" && (removed > 0 || unsupported > 0)) {
    await writeEntries(
      entries.map((entry) => {
        const links = entry.links?.filter((href) => socialProfile(href) && !missing(href));
        const github =
          entry.github && missing(`https://github.com/${entry.github}`) ? null : entry.github;
        const { links: _previous, ...rest } = entry;
        return { ...rest, github, ...(links?.length ? { links } : {}) };
      }),
    );
    console.log(
      `Removed ${removed} unavailable profiles and ${unsupported} unsupported links from the guestbook data.`,
    );
    return;
  }
  if (mode === "strict" && removed > 0) {
    console.log("Remove them with: bun run --cwd tooling/guestbook verify:links --write");
    process.exitCode = 1;
  }
}

const flag = (["write", "strict"] as const).find((name) => process.argv.includes(`--${name}`));
await verifyLinks(flag ?? "report");

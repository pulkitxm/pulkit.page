import process from "node:process";
import { socialProfile } from "@pulkit/shared/guestbook";
import { readEntries, writeEntries } from "../lib/store.ts";
import { type ProfileStatus, profileStatus } from "../lib/verify.ts";

async function verifyLinks(write: boolean): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required");
  }
  const entries = await readEntries();
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
  for (const [key, profile] of profiles) {
    console.log(`${statuses.get(key)?.padEnd(7)} ${profile.url}`);
  }
  const stripped = entries.map((entry) => {
    const links = entry.links?.filter((href) => !missing(href));
    const github =
      entry.github && missing(`https://github.com/${entry.github}`) ? null : entry.github;
    const { links: _previous, ...rest } = entry;
    return { ...rest, github, ...(links?.length ? { links } : {}) };
  });
  const removed = [...statuses.values()].filter((status) => status === "missing").length;
  console.log(
    `Checked ${profiles.size} guestbook profiles: ${removed} missing, ${
      [...statuses.values()].filter((status) => status === "unknown").length
    } inconclusive.`,
  );
  if (write && removed > 0) {
    await writeEntries(stripped);
    console.log(`Stripped ${removed} unavailable profiles from the guestbook data.`);
  }
}

await verifyLinks(process.argv.includes("--write"));

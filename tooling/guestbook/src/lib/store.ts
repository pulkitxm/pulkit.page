import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { type GuestbookEntry, guestbookEntries } from "@pulkit/shared/guestbook";

export const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const dataPath = resolve(repositoryRoot, "apps/page/data/guestbook.json");

export async function readEntries(path = dataPath): Promise<GuestbookEntry[]> {
  return guestbookEntries.parse(JSON.parse(await readFile(path, "utf8")));
}

export async function appendEntries(
  additions: readonly GuestbookEntry[],
  path = dataPath,
): Promise<number> {
  const existing = await readEntries(path);
  const ids = new Set(existing.map((entry) => entry.id));
  const added = additions.filter((entry) => {
    if (ids.has(entry.id)) {
      return false;
    }
    ids.add(entry.id);
    return true;
  });
  if (added.length === 0) {
    return 0;
  }
  const entries = guestbookEntries.parse([...existing, ...added]);
  entries.sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id),
  );
  await writeEntries(entries, path);
  return added.length;
}

export async function refreshLinks(
  linksByLogin: ReadonlyMap<string, readonly string[]>,
  path = dataPath,
): Promise<number> {
  let changed = 0;
  const entries = (await readEntries(path)).map((entry) => {
    const links = entry.github ? linksByLogin.get(entry.github.toLowerCase()) : undefined;
    if (!links || JSON.stringify(links) === JSON.stringify(entry.links ?? [])) {
      return entry;
    }
    changed++;
    const { links: _previous, ...rest } = entry;
    return links.length > 0 ? { ...rest, links: [...links] } : rest;
  });
  if (changed > 0) {
    await writeEntries(guestbookEntries.parse(entries), path);
  }
  return changed;
}

export async function writeEntries(
  entries: readonly GuestbookEntry[],
  path = dataPath,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, `${JSON.stringify(entries, null, 2)}\n`);
  await rename(`${path}.tmp`, path);
}

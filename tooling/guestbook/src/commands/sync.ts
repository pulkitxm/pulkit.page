import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { type GuestbookEntry, guestbookSettings } from "@pulkit/shared/guestbook";
import { downloadAvatar } from "../lib/avatars.ts";
import { githubAvatar, githubSubmissions, type Submission } from "../lib/github.ts";
import { googleSubmissions } from "../lib/google.ts";
import { appendEntries, readEntries, repositoryRoot } from "../lib/store.ts";

async function sync(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required");
  }
  const settings = guestbookSettings.parse(
    JSON.parse(
      await readFile(resolve(repositoryRoot, "apps/page/data/guestbook-settings.json"), "utf8"),
    ),
  );
  const existing = new Set([
    ...(await readEntries()).map((entry) => entry.id),
    ...settings.removedEntryIds,
  ]);
  const submissions = await githubSubmissions(settings.repository, token, existing);
  const sheetId = process.env.GUESTBOOK_GOOGLE_SHEET_ID;
  const credentials = process.env.GUESTBOOK_GOOGLE_CREDENTIALS;
  if (Boolean(sheetId) !== Boolean(credentials)) {
    throw new Error("Set both GUESTBOOK_GOOGLE_SHEET_ID and GUESTBOOK_GOOGLE_CREDENTIALS");
  }
  if (sheetId && credentials) {
    const entries = await googleSubmissions(
      sheetId,
      credentials,
      process.env.GUESTBOOK_GOOGLE_SHEET_TAB,
    );
    for (const entry of entries) {
      if (existing.has(entry.id)) {
        continue;
      }
      const avatar = entry.github ? await githubAvatar(entry.github, token) : null;
      submissions.push({ entry, avatarUrl: avatar?.url ?? null, avatarId: avatar?.id ?? entry.id });
    }
  }
  const additions: GuestbookEntry[] = [];
  for (const submission of submissions) {
    additions.push(await withAvatar(submission));
  }
  console.log(`Imported ${await appendEntries(additions)} new guestbook messages.`);
}

async function withAvatar({
  entry,
  avatarUrl,
  avatarId,
}: Submission): Promise<Submission["entry"]> {
  return { ...entry, avatar: await downloadAvatar(avatarUrl, avatarId) };
}

try {
  await sync();
} catch {
  console.error(
    "Guestbook sync failed. Check source access and configuration; no entries were published.",
  );
  process.exitCode = 1;
}

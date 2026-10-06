import { readFile } from "node:fs/promises";
import process from "node:process";
import type { GuestbookEntry } from "@pulkit/shared/guestbook";
import { z } from "zod";
import { downloadAvatar } from "../lib/avatars.ts";
import { appendEntries, readEntries } from "../lib/store.ts";

const source = process.argv[2];
if (!source) {
  throw new Error("Provide the local JSON export path");
}
const rows = z
  .array(
    z.object({
      id: z.string().regex(/^[a-z\d]+$/),
      name: z.string().nullable(),
      content: z.string(),
      createdAt: z.string(),
      image: z.string().nullable(),
    }),
  )
  .parse(JSON.parse(await readFile(source, "utf8")));
const existing = new Set((await readEntries()).map((entry) => entry.id));
const entries: GuestbookEntry[] = [];
for (const row of rows) {
  const id = `legacy-${row.id}`;
  if (!existing.has(id)) {
    entries.push({
      id,
      name: row.name?.trim().replaceAll("\u2014", ",") || "Guest",
      message: row.content.replaceAll("\u2014", ","),
      createdAt: new Date(row.createdAt).toISOString(),
      github: null,
      avatar: await downloadAvatar(row.image, id),
    });
  }
}
console.log(`Imported ${await appendEntries(entries)} existing guestbook messages.`);

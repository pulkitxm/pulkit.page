import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEntries, readEntries } from "./store.ts";

test("repeated imports only append new entries and preserve previously published messages", async () => {
  const directory = await mkdtemp(join(tmpdir(), "guestbook-store-"));
  const path = join(directory, "guestbook.json");
  const existing = {
    id: "github-1",
    name: "First Guest",
    message: "Original message",
    createdAt: "2026-01-01T00:00:00.000Z",
    github: null,
    avatar: null,
  };
  const added = { ...existing, id: "google-2", createdAt: "2026-02-01T00:00:00.000Z" };
  try {
    await writeFile(path, JSON.stringify([existing]));
    expect(
      await appendEntries([{ ...existing, message: "Edited message" }, added, added], path),
    ).toBe(1);
    expect(await readEntries(path)).toEqual([added, existing]);
    const before = await readFile(path, "utf8");
    expect(await appendEntries([added], path)).toBe(0);
    expect(await readFile(path, "utf8")).toBe(before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

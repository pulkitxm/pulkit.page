import { expect, test } from "bun:test";
import { guestbookEntries, guestbookEntry } from "./guestbook.ts";

const entry = {
  id: "github-42",
  name: "Sample Visitor",
  message: "Thanks for sharing your work!",
  createdAt: "2026-10-06T12:00:00.000Z",
  github: "sample-visitor",
  avatar: "/assets/guestbook/github-42.webp",
};

test("rejects duplicate submissions and unexpected private fields", () => {
  expect(guestbookEntries.safeParse([entry, entry]).success).toBe(false);
  expect(guestbookEntry.safeParse({ ...entry, email: "sample@example.invalid" }).success).toBe(
    false,
  );
});

test("rejects unsafe asset paths and invalid GitHub identities", () => {
  expect(guestbookEntry.safeParse({ ...entry, avatar: "/assets/../private.webp" }).success).toBe(
    false,
  );
  expect(guestbookEntry.safeParse({ ...entry, github: "../other-user" }).success).toBe(false);
});

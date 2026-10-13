import { expect, test } from "bun:test";
import { guestbookEntries, guestbookEntry, socialProfile } from "./guestbook.ts";

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

test("accepts only https profile links without credentials", () => {
  expect(guestbookEntry.safeParse({ ...entry, links: ["https://example.com/"] }).success).toBe(
    true,
  );
  for (const link of [
    "http://example.com/",
    "javascript:alert(1)",
    "https://a:b@example.com/",
    "https://in process",
  ]) {
    expect(guestbookEntry.safeParse({ ...entry, links: [link] }).success).toBe(false);
  }
});

test("only professional social profiles are recognized, in canonical form", () => {
  expect(socialProfile("https://twitter.com/sample_dev")?.url).toBe("https://x.com/sample_dev");
  expect(socialProfile("https://www.x.com/sample_dev/")?.url).toBe("https://x.com/sample_dev");
  expect(socialProfile("https://in.linkedin.com/in/sample-dev")?.url).toBe(
    "https://www.linkedin.com/in/sample-dev",
  );
  expect(socialProfile("https://github.com/Sample-Dev")).toEqual({
    platform: "github",
    handle: "Sample-Dev",
    url: "https://github.com/Sample-Dev",
  });
  expect(socialProfile("https://www.npmjs.com/~sample")?.platform).toBe("npm");
  expect(socialProfile("https://crates.io/users/sample")?.platform).toBe("crates");
  for (const href of [
    "https://sample.example/",
    "https://www.instagram.com/sample/",
    "https://leetcode.com/u/sample/",
    "https://hashnode.com/@sample",
    "https://www.linkedin.com/company/sample",
    "https://github.com/sample/repository",
    "https://x.com/home",
    "http://x.com/sample",
  ]) {
    expect(socialProfile(href)).toBeNull();
  }
});

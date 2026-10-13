import { z } from "zod";

const githubUsername = z.string().regex(/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i);

export const profileLink = z
  .url({ protocol: /^https$/ })
  .max(300)
  .refine((value) => {
    const url = URL.parse(value);
    return url !== null && !url.username && !url.password;
  });

type SocialPlatform = "github" | "x" | "linkedin" | "npm" | "crates";

export interface SocialProfile {
  platform: SocialPlatform;
  handle: string;
  url: string;
}

const socialPatterns: readonly [SocialPlatform, RegExp, RegExp, (handle: string) => string][] = [
  [
    "github",
    /^github\.com$/,
    /^\/([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)\/?$/i,
    (h) => `https://github.com/${h}`,
  ],
  ["x", /^(?:x|twitter)\.com$/, /^\/(\w{1,15})\/?$/, (h) => `https://x.com/${h}`],
  [
    "linkedin",
    /^(?:[a-z]{2,3}\.)?linkedin\.com$/,
    /^\/in\/([\w%-]{3,100})\/?$/,
    (h) => `https://www.linkedin.com/in/${h}`,
  ],
  ["npm", /^npmjs\.com$/, /^\/~([a-z\d][\w.-]{0,213})\/?$/i, (h) => `https://www.npmjs.com/~${h}`],
  ["crates", /^crates\.io$/, /^\/users\/([\w-]{1,39})\/?$/, (h) => `https://crates.io/users/${h}`],
];

const reservedXPaths = new Set(["home", "i", "intent", "search", "share", "explore", "settings"]);

export function socialProfile(href: string): SocialProfile | null {
  const url = URL.parse(href);
  if (url?.protocol !== "https:" || url.username || url.password) {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(?:www|m|mobile)\./, "");
  for (const [platform, hostPattern, pathPattern, canonical] of socialPatterns) {
    const handle = hostPattern.test(host) ? pathPattern.exec(url.pathname)?.[1] : undefined;
    if (handle && !(platform === "x" && reservedXPaths.has(handle.toLowerCase()))) {
      return { platform, handle, url: canonical(handle) };
    }
  }
  return null;
}

export const guestbookEntry = z.strictObject({
  id: z.string().regex(/^(legacy|github|google)-[a-z\d-]+$/),
  name: z.string().min(1).max(100),
  message: z.string().min(1).max(1000),
  createdAt: z.iso.datetime(),
  github: githubUsername.nullable(),
  avatar: z
    .string()
    .regex(/^\/assets\/guestbook\/[a-z\d-]+\.webp$/)
    .nullable(),
  links: z.array(profileLink).max(8).optional(),
});

export type GuestbookEntry = z.infer<typeof guestbookEntry>;

export const guestbookSettings = z.strictObject({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  removedEntryIds: z.array(guestbookEntry.shape.id).default([]),
  googleFormUrl: z
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        (url.hostname === "forms.gle" ||
          (url.hostname === "docs.google.com" && url.pathname.startsWith("/forms/"))) &&
        !url.username &&
        !url.password
      );
    })
    .nullable(),
});

export const guestbookEntries = z.array(guestbookEntry).superRefine((entries, context) => {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) {
      context.addIssue({ code: "custom", message: `Duplicate guestbook entry: ${entry.id}` });
    }
    ids.add(entry.id);
  }
});

import { z } from "zod";

const githubUsername = z.string().regex(/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i);

export const profileLink = z
  .url({ protocol: /^https$/ })
  .max(300)
  .refine((value) => {
    const url = URL.parse(value);
    return url !== null && !url.username && !url.password;
  });

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

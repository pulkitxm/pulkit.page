import { type GuestbookEntry, guestbookEntry } from "@pulkit/shared/guestbook";
import { z } from "zod";

export type Request = (url: string, options?: RequestInit) => Promise<Response>;

const issueSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullable(),
  created_at: z.string(),
  pull_request: z.unknown().optional(),
  user: z.object({ login: z.string(), type: z.string() }).nullable(),
});
const profileSchema = z.object({
  login: guestbookEntry.shape.github.unwrap(),
  id: z.number().int().positive(),
  name: z.string().nullable(),
  avatar_url: z.url(),
});

export interface Submission {
  entry: GuestbookEntry;
  avatarUrl: string | null;
  avatarId: string;
}

async function githubJson(path: string, token: string, request: Request): Promise<unknown> {
  const response = await request(`https://api.github.com/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`GitHub request failed: HTTP ${response.status}`);
  }
  return response.json();
}

export async function githubSubmissions(
  repository: string,
  token: string,
  existing: ReadonlySet<string>,
  request: Request = fetch,
): Promise<Submission[]> {
  const submissions: Submission[] = [];
  const profiles = new Map<string, z.infer<typeof profileSchema>>();
  for (let page = 1; ; page++) {
    const issues = z
      .array(issueSchema)
      .parse(
        await githubJson(
          `repos/${repository}/issues?state=all&sort=created&direction=asc&per_page=100&page=${page}`,
          token,
          request,
        ),
      );
    for (const issue of issues) {
      const id = `github-${issue.number}`;
      if (
        existing.has(id) ||
        issue.pull_request ||
        issue.title !== "Guestbook message" ||
        issue.user?.type !== "User"
      ) {
        continue;
      }
      const match = /^### Message\r?\n\r?\n([\s\S]+)$/.exec(issue.body ?? "");
      const message = match?.[1]?.trim().replaceAll("\r\n", "\n").replaceAll("\u2014", ",");
      if (!message || message === "_No response_" || message.length > 1000) {
        console.warn(`Skipped invalid guestbook issue #${issue.number}.`);
        continue;
      }
      const login = issue.user.login;
      let profile = profiles.get(login);
      if (!profile) {
        profile = profileSchema.parse(
          await githubJson(`users/${encodeURIComponent(login)}`, token, request),
        );
        profiles.set(login, profile);
      }
      const entry = guestbookEntry.safeParse({
        id,
        name: profile.name?.trim().replaceAll("\u2014", ",") || profile.login,
        message,
        createdAt: new Date(issue.created_at).toISOString(),
        github: profile.login,
        avatar: null,
      });
      if (entry.success) {
        submissions.push({
          entry: entry.data,
          avatarUrl: profile.avatar_url,
          avatarId: `github-user-${profile.id}`,
        });
      } else {
        console.warn(`Skipped invalid guestbook issue #${issue.number}.`);
      }
    }
    if (issues.length < 100) {
      return submissions;
    }
  }
}

export async function githubAvatar(
  login: string,
  token: string,
  request: Request = fetch,
): Promise<{ url: string; id: string } | null> {
  const response = await request(`https://api.github.com/users/${encodeURIComponent(login)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GitHub profile request failed: HTTP ${response.status}`);
  }
  const profile = profileSchema.parse(await response.json());
  return { url: profile.avatar_url, id: `github-user-${profile.id}` };
}

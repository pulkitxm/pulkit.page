import type { SocialProfile } from "@pulkit/shared/guestbook";
import { z } from "zod";
import type { Request } from "./github.ts";

export type ProfileStatus = "found" | "missing" | "unknown";

const userAgent = "pulkit.page guestbook link check (https://pulkit.page/guestbook/)";
const npmSearch = z.object({
  objects: z.array(
    z.object({ package: z.object({ maintainers: z.array(z.object({ username: z.string() })) }) }),
  ),
});

function statusOf(response: Response): ProfileStatus {
  if (response.ok) {
    return "found";
  }
  return response.status === 404 || response.status === 410 ? "missing" : "unknown";
}

async function check(
  profile: SocialProfile,
  token: string,
  request: Request,
): Promise<ProfileStatus> {
  const handle = encodeURIComponent(profile.handle);
  const signal = AbortSignal.timeout(15000);
  switch (profile.platform) {
    case "github":
      return statusOf(
        await request(`https://api.github.com/users/${handle}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
          signal,
        }),
      );
    case "crates":
      return statusOf(
        await request(`https://crates.io/api/v1/users/${handle}`, {
          headers: { "User-Agent": userAgent },
          signal,
        }),
      );
    case "x":
      return statusOf(await request(`https://x.com/${handle}`, { signal }));
    case "linkedin":
      return statusOf(
        await request(profile.url, {
          headers: { "User-Agent": "Twitterbot/1.0" },
          redirect: "follow",
          signal,
        }),
      );
    case "npm": {
      const response = await request(
        `https://registry.npmjs.org/-/v1/search?text=maintainer:${handle}&size=20`,
        { signal },
      );
      if (!response.ok) {
        return "unknown";
      }
      const { objects } = npmSearch.parse(await response.json());
      const login = profile.handle.toLowerCase();
      return objects.some(({ package: item }) =>
        item.maintainers.some(({ username }) => username.toLowerCase() === login),
      )
        ? "found"
        : "missing";
    }
  }
}

export async function profileStatus(
  profile: SocialProfile,
  token: string,
  request: Request = fetch,
): Promise<ProfileStatus> {
  try {
    return await check(profile, token, request);
  } catch {
    return "unknown";
  }
}

import process from "node:process";
import { z } from "zod";
import { experimentRepository } from "../content/experiments.ts";

export async function currentExperimentRevision(
  request: (url: string, options: RequestInit) => Promise<Response>,
): Promise<string> {
  const githubAccessToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const currentHead = await request(
    `https://api.github.com/repos/${experimentRepository}/commits/main`,
    {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: {
        Accept: "application/vnd.github+json",
        "Cache-Control": "no-cache",
        ...(githubAccessToken ? { Authorization: `Bearer ${githubAccessToken}` } : {}),
      },
    },
  );
  if (!currentHead.ok) {
    throw new Error(
      "Current primary source revision could not be verified; stop for manual review",
    );
  }
  return z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) }).parse(await currentHead.json()).sha;
}

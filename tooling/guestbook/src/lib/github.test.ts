import { expect, test } from "bun:test";
import { githubSubmissions, type Request } from "./github.ts";

function issue(number: number, overrides: Record<string, unknown> = {}) {
  return {
    number,
    title: "Guestbook message",
    body: "### Message\n\nHello from a visitor!",
    created_at: "2026-10-06T12:00:00Z",
    user: { login: "sample-visitor", type: "User" },
    ...overrides,
  };
}

test("imports only new guestbook forms across every issue page using the authenticated author", async () => {
  const first = Array.from({ length: 100 }, (_, index) =>
    issue(index + 1, { title: "Unrelated issue" }),
  );
  first[0] = issue(1);
  first[1] = issue(2, { pull_request: {} });
  first[2] = issue(3, { body: "Not a guestbook form" });
  first[3] = issue(4, { body: "### Message\n\n_No response_" });
  first[4] = issue(5, { body: `### Message\n\n${"x".repeat(1001)}` });
  first[5] = issue(6, { user: { login: "sample-bot", type: "Bot" } });
  const urls: string[] = [];
  const request: Request = (url) => {
    urls.push(url);
    if (url.includes("/users/")) {
      return Promise.resolve(
        Response.json({
          login: "sample-visitor",
          id: 123,
          name: "Sample Visitor",
          avatar_url: "https://avatars.githubusercontent.com/u/123",
        }),
      );
    }
    return Promise.resolve(
      Response.json(url.endsWith("page=1") ? first : [issue(101), issue(102)]),
    );
  };
  const submissions = await githubSubmissions(
    "example/site",
    "test-token",
    new Set(["github-1", "github-102"]),
    request,
  );
  expect(submissions.map(({ entry }) => entry.id)).toEqual(["github-101"]);
  expect(submissions[0]?.entry.name).toBe("Sample Visitor");
  expect(submissions[0]?.entry.github).toBe("sample-visitor");
  expect(submissions[0]?.avatarId).toBe("github-user-123");
  expect(urls.filter((url) => url.includes("/issues?")).length).toBe(2);
});

test("API failures abort the import instead of publishing partial results", async () => {
  const request: Request = () => Promise.resolve(new Response(null, { status: 403 }));
  await expect(githubSubmissions("example/site", "test-token", new Set(), request)).rejects.toThrow(
    "HTTP 403",
  );
});

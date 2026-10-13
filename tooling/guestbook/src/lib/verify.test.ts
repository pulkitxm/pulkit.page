import { expect, test } from "bun:test";
import { socialProfile } from "@pulkit/shared/guestbook";
import type { Request } from "./github.ts";
import { profileStatus } from "./verify.ts";

function profile(href: string) {
  const result = socialProfile(href);
  if (!result) {
    throw new Error(`Unsupported profile: ${href}`);
  }
  return result;
}

const responses: Record<string, () => Response> = {
  "https://x.com/real_dev": () => new Response("ok"),
  "https://x.com/fake_handle_881": () => new Response(null, { status: 404 }),
  "https://www.linkedin.com/in/real-dev": () => new Response("ok"),
  "https://www.linkedin.com/in/fake-dev": () => new Response(null, { status: 404 }),
  "https://www.linkedin.com/in/blocked-dev": () => new Response(null, { status: 999 }),
  "https://api.github.com/users/gone-dev": () => new Response(null, { status: 404 }),
  "https://crates.io/api/v1/users/real-dev": () => Response.json({ user: {} }),
  "https://registry.npmjs.org/-/v1/search?text=maintainer:real-dev&size=20": () =>
    Response.json({ objects: [{ package: { maintainers: [{ username: "real-dev" }] } }] }),
  "https://registry.npmjs.org/-/v1/search?text=maintainer:fake-dev&size=20": () =>
    Response.json({ objects: [{ package: { maintainers: [{ username: "fake-dev-2" }] } }] }),
};
const request: Request = (url) => {
  const response = responses[url];
  return response ? Promise.resolve(response()) : Promise.reject(new Error("network down"));
};

test.each([
  ["https://twitter.com/real_dev", "found"],
  ["https://x.com/fake_handle_881", "missing"],
  ["https://in.linkedin.com/in/real-dev", "found"],
  ["https://www.linkedin.com/in/fake-dev", "missing"],
  ["https://www.linkedin.com/in/blocked-dev", "unknown"],
  ["https://github.com/gone-dev", "missing"],
  ["https://crates.io/users/real-dev", "found"],
  ["https://www.npmjs.com/~real-dev", "found"],
  ["https://www.npmjs.com/~fake-dev", "missing"],
  ["https://x.com/unreachable", "unknown"],
] as const)("%s is %s", async (href, status) => {
  expect(await profileStatus(profile(href), "test-token", request)).toBe(status);
});

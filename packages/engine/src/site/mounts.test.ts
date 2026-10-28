import { expect, test } from "bun:test";
import { localizeLinks, mountRoute } from "./mounts.ts";

const mounts = [
  { site: "page", route: "/" },
  { site: "blog", route: "/writing/" },
];

test("mounted routes nest under their mount point", () => {
  expect(mountRoute({ site: "blog", route: "/writing/" }, "/caching/")).toBe("/writing/caching/");
  expect(mountRoute({ site: "page", route: "/" }, "/about/")).toBe("/about/");
});

test("links to mounted sites stay on the combined site, while code samples keep their text", () => {
  const source = [
    "Read [my writing](https://pulkit.blog/) or [a post](https://pulkit.blog/git-worktrees/).",
    "See [about](https://pulkit.page/about/), [a series](/system-design/) and ![art](/assets/content/a.webp).",
    '{"links":[{"href":"/contact/"}]}',
    ":::list system-design by-year",
    ":::list all by-year",
    "```md",
    "[kept](/system-design/) https://pulkit.blog/",
    "```",
  ].join("\n");
  const localized = localizeLinks(source, mounts, mounts[1]);
  expect(localized).toContain("[my writing](/writing/)");
  expect(localized).toContain("[a post](/writing/git-worktrees/)");
  expect(localized).toContain("[about](/about/)");
  expect(localized).toContain("[a series](/writing/system-design/)");
  expect(localized).toContain("![art](/assets/content/a.webp)");
  expect(localized).toContain('"href":"/writing/contact/"');
  expect(localized).toContain(":::list writing/system-design by-year");
  expect(localized).toContain(":::list all by-year");
  expect(localized).toContain("[kept](/system-design/) https://pulkit.blog/");
  expect(
    localizeLinks("[map](https://www.pulkit.page/sitemap.xml) http://pulkit.blog", mounts),
  ).toBe("[map](/sitemap.xml) /writing/");
});

test("root mounts only rewrite the origins of other mounted sites", () => {
  const localized = localizeLinks(
    "[home](/) [blog](https://pulkit.blog/x/) me@pulkit.page",
    mounts,
    mounts[0],
  );
  expect(localized).toBe("[home](/) [blog](/writing/x/) me@pulkit.page");
});

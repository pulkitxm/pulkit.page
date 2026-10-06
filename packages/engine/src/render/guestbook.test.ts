import { expect, test } from "bun:test";
import { renderMarkdown } from "../markdown/markdown-export.ts";
import type { Site } from "../types.ts";
import { renderPage } from "./render-page.ts";

const site: Site = {
  url: "https://example.invalid",
  guestbook: {
    githubFormUrl: "https://github.com/example/site/issues/new?template=guestbook.yml",
    googleFormUrl: "https://forms.gle/example",
    entries: [
      {
        id: "github-42",
        name: "Sample <Visitor>",
        message: ["<script>", "bad", "</script>", "\nThanks!"].join(""),
        createdAt: "2026-10-06T12:00:00.000Z",
        github: "sample-visitor",
        avatar: "/assets/guestbook/github-42.webp",
      },
    ],
  },
};

test("guestbook messages are escaped text with local thumbnails and both submission links", async () => {
  const html = await renderPage(
    "---\ntitle: Guestbook\ndescription: Visitor notes.\n---\n:::guestbook\n",
    { site },
  );
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain(["<script>", "bad"].join(""));
  expect(html).toContain("Sample &lt;Visitor&gt;");
  expect(html).toContain('width="32" height="32"');
  expect(html).toContain("https://forms.gle/example");
  expect(html).toContain("issues/new?template=guestbook.yml");
  expect(html).toContain("6 Oct 2026");
});

test("Markdown copies include messages and submission links instead of the directive", () => {
  const markdown = renderMarkdown(
    { route: "/guestbook/", metadata: { title: "Guestbook" }, body: ":::guestbook\n" },
    [],
    site,
  );
  expect(markdown).not.toContain(":::guestbook");
  expect(markdown).toContain("https://forms.gle/example");
  expect(markdown).toContain("> Thanks!");
});

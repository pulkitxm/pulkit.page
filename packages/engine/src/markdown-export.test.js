import { expect, test } from "bun:test";
import { llmsText, renderMarkdown } from "./markdown-export.mjs";
import { markdownPath } from "./seo.mjs";

const site = {
  brand: "Example",
  description: "An example site.",
  articles: "/blogs/",
  navigation: [
    { label: "About", href: "/about/" },
    { label: "Notes", href: "https://notes.example.org/" },
  ],
  url: "https://example.com",
};
const pages = [
  { route: "/", index: false, metadata: { title: "Example", description: "Home page." } },
  { route: "/about/", index: false, metadata: { title: "About", description: "About me." } },
  { route: "/blogs/", index: true, metadata: { title: "Writing", description: "All posts." } },
  {
    route: "/blogs/first/",
    index: false,
    metadata: { title: "First", description: "First post.", date: "2026-01-02", tags: ["CSS"] },
  },
];

function inlineEmbed(name, props) {
  return `:embed[${name}]{${JSON.stringify(props)}}`;
}

function page(body, route = "/blogs/first/") {
  return { ...pages.find((entry) => entry.route === route), body };
}

test("Markdown paths sit beside their HTML routes", () => {
  expect(markdownPath("/")).toBe("/index.md");
  expect(markdownPath("/about/")).toBe("/about.md");
  expect(markdownPath("/blogs/system-design/")).toBe("/blogs/system-design.md");
});

test("page Markdown starts with the title, summary and facts", () => {
  const markdown = renderMarkdown(page("Hello.\n"), pages, site);
  expect(markdown).toStartWith(
    "# First\n\n> First post.\n\n- URL: https://example.com/blogs/first/\n- Published: January 2, 2026\n- Tags: CSS\n- Part of: [Writing](https://example.com/blogs.md)\n\nHello.\n",
  );
});

test("links and images become absolute, with page links pointing at Markdown", () => {
  const markdown = renderMarkdown(
    page("[About](/about/#me) and ![Chart](/assets/chart.webp) and [file](/assets/cv.pdf)\n"),
    pages,
    site,
  );
  expect(markdown).toContain("[About](https://example.com/about.md#me)");
  expect(markdown).toContain("![Chart](https://example.com/assets/chart.webp)");
  expect(markdown).toContain("[file](https://example.com/assets/cv.pdf)");
});

test("directives become plain Markdown while code fences stay literal", () => {
  const markdown = renderMarkdown(
    page(
      [
        `A ${inlineEmbed("info-tip", { text: "term", tip: "Its meaning." })} and ${inlineEmbed("math", { formula: "2^{8}" })}.`,
        "",
        ":::embed math",
        '{"formula":"a_1 + b","block":true}',
        ":::",
        "",
        ":::list blogs",
        "",
        "```md",
        ":::list blogs",
        "```",
        "",
      ].join("\n"),
      "/about/",
    ),
    pages,
    site,
  );
  expect(markdown).toContain("A term[^1] and $2^{8}$.");
  expect(markdown).toContain("$$\na_1 + b\n$$");
  expect(markdown).toContain("- [First](https://example.com/blogs/first.md): January 2, 2026");
  expect(markdown).toContain("```md\n:::list blogs\n```");
  expect(markdown).toEndWith("[^1]: Its meaning.\n");
});

test("lists from another site link to that site's Markdown copies", () => {
  const external = {
    ...site,
    external: {
      notes: [
        {
          route: "https://notes.example.org/post/",
          metadata: { title: "Post", description: "A post.", date: "2026-02-03" },
        },
      ],
    },
  };
  expect(renderMarkdown(page(":::list notes:all limit=5\n", "/about/"), pages, external)).toContain(
    "- [Post](https://notes.example.org/post.md): February 3, 2026",
  );
});

test("raw HTML falls back to readable Markdown", () => {
  const markdown = renderMarkdown(
    page(
      [
        "Press <code>:embed[cmd-key]{{}} + K</code> now.",
        "",
        "<center>",
        "",
        "Centered text.",
        "",
        "</center>",
        "",
        '<video src="/assets/clip.mp4" title="Clip" controls></video>',
        "",
      ].join("\n"),
    ),
    pages,
    site,
  );
  expect(markdown).toContain("Press `Cmd + K` now.");
  expect(markdown).toContain("Centered text.");
  expect(markdown).not.toContain("<center>");
  expect(markdown).toContain("[Video: Clip](https://example.com/assets/clip.mp4)");
});

test("llms.txt indexes every page by its Markdown URL", () => {
  const text = llmsText(pages, site);
  expect(text).toStartWith("# Example\n\n> An example site.\n");
  expect(text).toContain("## Pages\n\n- [Example](https://example.com/index.md): Home page.");
  expect(text).toContain("- [About](https://example.com/about.md): About me.");
  expect(text).toContain(
    "## Writing\n\n- [Writing](https://example.com/blogs.md): All posts.\n- [First](https://example.com/blogs/first.md): January 2, 2026. First post.",
  );
  expect(text).toContain(
    "## Elsewhere\n\n- [Notes](https://notes.example.org/): [llms.txt](https://notes.example.org/llms.txt)",
  );
});

test("articles at the site root get their own writing section", () => {
  const blog = { ...site, articles: "/" };
  const rootPages = [
    pages[0],
    {
      route: "/post/",
      index: false,
      metadata: { title: "Post", description: "A post.", date: "2026-02-03" },
    },
  ];
  expect(llmsText(rootPages, blog)).toContain(
    "## Writing\n\n- [Post](https://example.com/post.md): February 3, 2026. A post.",
  );
});

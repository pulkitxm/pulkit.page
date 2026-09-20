# Authoring and presentation guide

[Documentation index](index.md)

The repository has two site apps: `apps/page/` (pulkit.page, the portfolio) and `apps/blog/` (pulkit.blog, every post). Paths such as `content/` or `assets/` in this guide are relative to whichever app you are editing, unless they start with `apps/`, `packages/`, `tooling/`, or `docs/`. Run both development servers with `bun run dev` from the repository root: pulkit.page prefers port 3000 and pulkit.blog prefers port 3001.

## Page schema

[check-content.ts](../tooling/checks/src/commands/check-content.ts) defines the strict schema; `readPage` in the renderer performs a smaller subset of checks. A successful standalone render is not proof that a source passes CI.

| Field         | Requirement                                                            | Effect                                                                 |
| ------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `title`       | Every page, trimmed nonempty string, at most 120 characters            | Full H1, list title, document title (brand dropped past 70 characters) |
| `description` | Every page, trimmed nonempty string, at most 320 characters            | HTML description metadata                                              |
| `date`        | Required on article and non-index experience pages; optional elsewhere | Real ISO date, sorting, list dates, article meta line and feed         |
| `layout`      | Optional existing lowercase kebab-case layout name                     | Overrides default shell                                                |
| `role`        | Required on experience details; optional elsewhere                     | Detail line                                                            |
| `period`      | Required on experience details; optional elsewhere                     | Human-readable period in details/lists                                 |
| `tags`        | Optional nonempty array of unique trimmed strings                      | Related-writing scores and JSON-LD keywords; no tag archives           |

Unknown fields, including `draft`, `slug`, author, and custom SEO fields, fail the current schema. Do not add them without coordinated checker/renderer/tests changes. Routes come from filenames, not titles or metadata. Future dates are accepted if calendar-valid and will sort first; they do not schedule publication.

`content/_site.md` instead requires `brand`, `description`, `copyright`, and `navigation`, allows the optional `social` and `articles` fields, and has no body. Navigation/social are nonempty arrays whose items contain only `label` and `href`; duplicate hrefs fail within each array. URLs must begin with a single `/`, `https://`, or `mailto:`. Navigation gets `aria-current="page"` only for an exact route match, not a section-prefix match.

`social` is optional because the engine's `readSiteConfig` merges the shared [@pulkit/profile](../packages/profile/profile.json) under each site's `_site.md`: the profile supplies the author name, the author URL (`https://pulkit.page/`), and the GitHub, X, and LinkedIn links, and a site's own `social` list replaces the profile's links when present. Neither site sets `social` today.

`articles` is a root-relative directory prefix such as `/` or `/notes/`; the content checker rejects any other shape. It marks which pages are posts: every non-index page whose route starts with the prefix, except home. pulkit.page has no `articles` field, so it has no posts. pulkit.blog sets `articles: /`, so every non-index page other than home is a post. For a site with articles:

- posts use the `article` layout unless they set `layout`;
- each post shows a meta line with its long date (for example "May 29, 2026"), reading time at about 230 words per minute excluding fenced code, and a link to its category index when it has one;
- posts get related writing, article Open Graph metadata, and BlogPosting JSON-LD;
- the build and development server publish an Atom feed at `/feed.xml`;
- an RSS link to `/feed.xml` is appended to the site's social links;
- the content checker requires `date` on every post.

## Filenames and Markdown

Content paths use lowercase ASCII kebab-case segments and `.md`, for example `apps/blog/content/a-useful-post.md`. Use `home.md` for `/`; `content/index.md` is forbidden. `_site.md` is the named configuration exception, and `content/404.md` is rejected because the engine renders the shared not-found page for every site. A nested `index.md` creates that folder's landing page and is excluded from automatic lists.

Begin each page with YAML delimited by `---`, then a nonempty Markdown body. No body H1: the layout supplies it from `title`. Start sections at H2, never skip levels, and avoid duplicate heading labels. Documentation has no page frontmatter and requires exactly one H1. Documentation paths follow lowercase kebab-case except root `README.md`.

```md
---
title: A useful post
description: A short explanation of the problem and what the reader will learn.
date: 2026-09-18
tags:
  - Engineering
---

Introduce the problem in plain language.

## An example

Link to [related writing](/system-design/) and explain the result.
```

Use labeled lowercase fences such as `js`, `sh`, `text`, or `mermaid`, without fence metadata. Tutorial code is content, not executable repository code; Markdown formatting preserves code text. Generation does not rewrite `content/**` fences. It normalizes and, for Biome-supported languages, formats those fences for display, then highlights the formatted text. Code examples in Markdown under any `apps/<app>/content/` are explicitly exempt from comment scanning: preserve explanatory comments and source-file labels. Other documentation examples are scanned by language. The separate U+2014 text check still applies everywhere. See [repository policies](repository-policies.md) for exact boundaries.

MDX is unsupported and never executes JSX. Raw HTML is limited to a reviewed set of tags, checked by the same `renderRawHtml` in `@pulkit/embeds` that the content checker runs, so an unknown tag or attribute fails authoring rather than reaching a page: `br`, `code`, `details` with `open`, `div`, `small`, `strong`, `summary`, `u`, `center` (rendered as a centered `div`), `iframe` (only a `https://codesandbox.io/embed/` source, with `title`, `allow`, and `sandbox`), and `video` (only an `/assets/` source, with `title`, `autoplay`, `loop`, `muted`, `playsinline`, and `controls`). A `track` element is accepted and dropped. Everything else, including any other attribute, is rejected, and text between tags is escaped. Each allowed tag gets the theme's utility classes, so raw HTML cannot carry its own styling.

Standard Markdown supports paragraphs, emphasis, lists, blockquotes, tables, images, links, and code. Fenced blocks are formatted then highlighted at generate time from the language label: published HTML wraps tokens in `text-syn-*` Tailwind color utilities whose tokens live in the shared theme's `styles.css`, and every block gets a sticky copy button. `text`, `plaintext`, `math`, `mermaid`, unlabeled, and unknown labels stay escaped plain text, so a Mermaid diagram in content is published as code rather than a picture. Formulas are not Markdown syntax either: use the `math` component below, which renders KaTeX at generate time. Inline backtick code is not highlighted or reformatted.

## Links, images, headings, and lists

Page links must be root-relative, HTTP(S), mailto, or fragments; use trailing slashes on root-relative page links (paths ending in a file extension, such as `/feed.xml`, are exempt). Documentation may use relative file links. Unsafe schemes and protocol-relative links fail content checks. Images require nonempty alt text and should live under assets, for example `/assets/content/blogs/example/diagram.webp` on pulkit.blog. The renderer's image URL policy accepts HTTPS but not HTTP even though the broader content URL check accepts HTTP; prefer local images or HTTPS.

The renderer promotes body headings to at least H2 and assigns IDs from lowercase text stripped of HTML tags and non-ASCII-alphanumeric runs. IDs not beginning with a letter get `section-`; collisions receive numeric suffixes, and `main` is reserved. The strict authoring checker rejects duplicate heading labels even though the renderer can disambiguate IDs. Heading wording changes may break inbound fragment links, which the local link checker does not verify.

```text
:::list <collection> [limit=N] [by-year]
```

```md
:::list exp limit=3

:::list system-design

:::list all by-year

:::list blog:all limit=5
```

Place one directive in its own paragraph. The collection is a route prefix without slashes at either end, or `all`. The limit must be a positive integer; omission means all items. A named collection is recursive by route prefix and excludes indexes and the current page; `all` selects every post of the site (see `articles` above), also excluding the current page. `<site>:all` lists every post of another app in the workspace, such as `blog:all` for `apps/blog`, linking each entry to that site's domain from the shared profile. Items sort newest date first then title. Ungrouped lists display the period, or the month and year; a list with a limit shows the day and month for this year's posts and the full date for older ones. With `by-year`, the list is grouped under year headings and each entry shows its day and month. Unknown or empty collections fail rendering. Tags and directory names do not automatically create landing pages: author an index page with a directive if needed.

```text
:::projects <login>/<list-slug>
```

```md
:::projects pulkitxm/tools-and-projects
```

Place one directive in its own paragraph. It renders a GitHub starred list: the list's own description as the opening paragraph, then one row per repository with its name, star count, and GitHub description, sorted by stars. Rows link to the repository. Everything is read from GitHub at build time and nothing is stored in the repository, so a project joins or leaves the page by joining or leaving the list on GitHub, and wording changes come from editing the repository description.

This is the only build step that needs the network. `readSite` fetches the list's public page once per build for every distinct list named by a directive and puts the result on the site context. No credentials are involved: the page is public, so `bun run build`, `bun run dev`, and `bun run ci` all work with no token and no configuration. An unreachable page, a private or empty list, or a change to GitHub's list markup fails the build rather than publishing a thinner page. The fetched list is part of the generation cache key, so a changed list invalidates the affected pages.

Article pages show a byline with the portrait and the author's name from the shared profile, linking to the author URL. The shared [article layout](../packages/theme/layouts/article.html) fills it from the `author` and `authorUrl` template values.

Group two or more related images into a sliding carousel with Previous and Next buttons:

```md
:::carousel

![Traces main view](/assets/content/exp/magicapi/noveum.ai/traces/main-view.webp)

![Trace flow visualization](/assets/content/exp/magicapi/noveum.ai/traces/flow-chart.webp)

:::
```

The block may contain only images, each with alt text. Each slide links to its full-size image, which also makes the scrolling region reachable by keyboard. Without JavaScript it still scrolls horizontally with snap points; the page loads `/assets/embeds/image-carousel.js` from `@pulkit/embeds`, which wires the buttons and the position counter.

## Components

Richer widgets come from the original site and render at generate time through `@pulkit/embeds` in `packages/embeds`. A block component is an `embed` fence naming the component, whose single line is a JSON object of props. The inline form carries the same name and props inside running text. Unknown names, unknown props, and unsupported prop values fail generation rather than degrading silently. A new component also needs a plain-Markdown fallback in [markdown-export.ts](../packages/engine/src/markdown/markdown-export.ts) for the page's Markdown copy.

```md
:::embed tech-badges
{"technologies":["TypeScript","Kubernetes","Redis"]}
:::

Press :embed[cmd-key]{{}} + K to open it.
```

| Component                     | Purpose                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `image`, `blog-image`         | A single figure, optionally captioned and zoomable                             |
| `image-grid`                  | Two images side by side, or a carousel with an optional `label` above two      |
| `blog-gallery`                | A carousel of captioned photographs                                            |
| `image-popup`                 | An inline thumbnail that opens the lightbox                                    |
| `install-tabs`                | One install command per package manager, with copy and a remembered preference |
| `youtube-embed`               | A click-to-load video frame                                                    |
| `tweet`, `tweet-embed`        | A rendered post card; `tweet-embed` supplies the site owner as the author      |
| `replies-carousel`            | A looping marquee of replies, each linking to the original post                |
| `document-viewer`             | One PDF in a titled card with an open-in-new-tab link                          |
| `document-tabs`               | Several such cards behind a tab strip, at most four                            |
| `tech-badges`                 | A wrapped row of technology names                                              |
| `contact-links`               | One row per contact channel, with an optional copy button                      |
| `math`, `info-tip`, `cmd-key` | Inline formula, hover tip, and command-key glyph                               |

Carousels that share a page need distinct accessible names: pass `label` to each `image-grid` so the landmarks stay unique. Components that need behavior load their own script and stylesheet; each one still renders readable markup without JavaScript. Renderers live in `packages/embeds/src/renderers/` and are registered in `registry.ts`; their browser scripts are the entries in `packages/embeds/client/entries/` and are bundled to `/assets/embeds/` by the build, so `image-popup` loads `/assets/embeds/image-popup.js`.

## Interactive demos

Motion posts on pulkit.blog embed live demos from `@pulkit/demos`. Place one directive in its own paragraph, naming a showcase and an optional variant:

```md
:::demo transition-basics

:::demo easing-curve spring
```

The name and variant select `packages/demos/showcases/<name>-<variant>.json` (or `<name>.json` without a variant), which names the component, its props, and any highlighted source files shown beside it. Unknown showcases fail rendering. A page with a demo loads `/assets/demos/document.css` and `/assets/demos/index.js`; the build compiles the demo CSS and Poppins fonts and bundles the component scripts from `packages/demos/client/components/` into `/assets/demos/`. A site with no demo directive in any page skips that bundle, so only pulkit.blog builds it today. Add a new demo by adding its component (a `mount` typed as `DemoMount` from `client/types.ts`), registering it in `client/registry.ts`, and writing a showcase file.

## Layout semantics and appearance

Both apps use the same layouts from `@pulkit/theme`: [home.html](../packages/theme/layouts/home.html), [simple.html](../packages/theme/layouts/simple.html), and [article.html](../packages/theme/layouts/article.html). The engine uses them unless an app has its own `layouts/` directory; neither app does. They share the same semantic structure: English HTML document, skip link to `main`, site header/nav, main containing breadcrumbs and an article, one page H1, prose container, and footer. Home keeps its H1 visually hidden and its main element adds utilities for smaller H2 headings; simple and article put the H1 and the meta line in the article header, and article adds the author byline. Changing a template never creates a route.

The [head partial](../packages/theme/layouts/partials/head.html) holds the SEO tags, a light and a dark `theme-color` with media queries, and theme JS before the body, then the page title, favicons, and stylesheet; on sites with `articles` the engine's SEO tags also link `/feed.xml` as an Atom alternate. [header](../packages/theme/layouts/partials/header.html) contains the brand and navigation; [footer](../packages/theme/layouts/partials/footer.html) contains social links, copyright, and a theme button. Templates use checked placeholders and partial includes, not a general expression language. See [rendering flow](rendering-flow.md) for escaping and full page titles.

Styling uses Tailwind CSS v4 and lives entirely in the shared theme. Each app's `styles.css` is the single line `@import "@pulkit/theme/styles.css";`. [styles.css](../packages/theme/styles.css) in `@pulkit/theme` sets up the Tailwind theme and utilities layers without Preflight, declares `@source` entries for the theme's `layouts/`, the engine's `src/render/` modules (tests excluded), the code package's `highlight/token-role.ts`, and the embed renderers, defines a `dark` variant for the system preference and the `data-theme` override, and keeps the view-transition rules, which have no utility equivalent. The `@view-transition` opt-in itself is an inline `<style>` at the top of the [head partial](../packages/theme/layouts/partials/head.html), so a new page opts in before any stylesheet or script has loaded. It also declares the Comic Relief `@font-face` rules and replaces the default theme with the site tokens (warm light/dark colors, syntax colors, font sizes, weights, line heights, radii, and a 560-pixel `sm` breakpoint), redefining the palette under the dark variant. It has no element or class selectors. Layouts and the engine's [render modules](../packages/engine/src/render/) put utility classes on every element: the centered 760-pixel shell, fluid H1 sizing, header, footer, listings, breadcrumbs, the skip link, and each Markdown element (headings, paragraphs, lists, quotes, code, tables, rules, links, images) through marked renderer overrides. Below the `sm` breakpoint (`max-sm:`) the header stacks and padding tightens. Tailwind scans only `packages/theme/layouts/`, `packages/engine/src/render/`, `highlight/token-role.ts`, and `packages/embeds/src/`, so classes must appear as complete literal strings there. Font files live in `packages/theme/assets/fonts/` and are served at `/assets/fonts/`. Social-card generation separately uses the bundled IBM Plex Mono TTF (`ibm-plex-mono-regular.ttf`, not used by browser CSS) with system fonts disabled. Demos carry their own stylesheet and animation runtime; the rest of the site has no component library.

[theme.ts](../packages/theme/src/client/theme.ts) reads `portfolio-theme` from localStorage and applies only `light` or `dark`. It is loaded without `defer` in the head so a stored choice applies before the body renders. Otherwise CSS follows the system preference. After DOM readiness, the button toggles the effective theme and tries to persist it; storage failures are swallowed. With JavaScript disabled the site remains readable and follows system colors, but the button cannot change them. There is no explicit reset-to-system control or theme-specific button state text. The same file handles cross-document view transitions: on `pageswap` and `pagereveal` it names the matching `data-title` element `entry-title` so a list entry grows into the page heading, and it skips the animation for an unrelated navigation or under reduced motion.

## Safe editing recipes

For an existing page, edit Markdown, format it, inspect the result in the development server, then run CI. Shared metadata/template edits can legitimately change every rendered page of that app; date/title changes can change listing pages, related writing, and the feed too.

```sh
bun run format
bun run ci
```

### Adding a post to pulkit.blog

1. Create a lowercase kebab-case Markdown file. A standalone post goes directly in `apps/blog/content/`, so `apps/blog/content/a-useful-post.md` becomes `/a-useful-post/` on pulkit.blog. A post in a series goes in its category directory, so `apps/blog/content/system-design/a-useful-post.md` becomes `/system-design/a-useful-post/`. The categories are `system-design/` and `design-engineering/`; a new category is a directory with an `index.md` whose body holds a list directive naming that directory.
2. Add frontmatter with `title`, `description`, and `date` (required on every post), plus `tags` to feed related writing and JSON-LD keywords.
3. Put images under `apps/blog/assets/content/`, for example `apps/blog/assets/content/blogs/a-useful-post/diagram.webp`, and reference them as `/assets/content/blogs/a-useful-post/diagram.webp` with alt text.
4. For interactive motion demos, add a demo directive naming a showcase from `packages/demos/showcases/` (see [interactive demos](#interactive-demos)).
5. Run `bun run format`, preview it on the blog development server, then run `bun run ci`.

Generation creates the route, the article layout with its meta line, the card, canonical metadata, BlogPosting JSON-LD, the sitemap entry, and a feed entry, and updates the home list and any matching category list. No registry edit or migration-audit update is needed.

### Other pages, renames, and commits

For a new portfolio page, create the file under `apps/page/content/` with title and description. Add an explicit link or listing for a new standalone page, since route generation alone does not make it discoverable through navigation.

For a rename/removal, update internal links and remove/rename the source. The next build clears the app's `dist/`, so the old route disappears; no redirect is generated for it. Removing the last item in a collection also requires changing/removing its directive to avoid an empty-collection error.

Before a commit, stage the intended Markdown, assets, and related templates together. HTML, social cards, crawler files, and the feed are build output and are never committed. The hook checks the staged index, so unstaged repairs do not count.

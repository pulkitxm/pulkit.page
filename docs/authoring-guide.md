# Authoring and presentation guide

[Documentation index](index.md)

## Page schema

[check-content.mjs](../scripts/check-content.mjs) defines the strict schema; `readPage` in the renderer performs a smaller subset of checks. A successful standalone render is not proof that a source passes CI.

| Field         | Requirement                                                     | Effect                                                       |
| ------------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| `title`       | Every page, trimmed nonempty string, at most 120 characters     | Full H1, list title, shortened document title                |
| `description` | Every page, trimmed nonempty string, at most 320 characters     | HTML description metadata                                    |
| `date`        | Required on non-index blog/experience pages; optional elsewhere | Real ISO date, sorting, year in lists, article date          |
| `layout`      | Optional existing lowercase kebab-case layout name              | Overrides default shell                                      |
| `role`        | Required on experience details; optional elsewhere              | Detail line                                                  |
| `period`      | Required on experience details; optional elsewhere              | Human-readable period in details/lists                       |
| `tags`        | Optional nonempty array of unique trimmed strings               | Related-writing scores and JSON-LD keywords; no tag archives |

Unknown fields, including `draft`, `slug`, author, and custom SEO fields, fail the current schema. Do not add them without coordinated checker/renderer/tests changes. Routes come from filenames, not titles or metadata. Future dates are accepted if calendar-valid and will sort first; they do not schedule publication.

`content/_site.md` instead allows and requires exactly `brand`, `description`, `copyright`, `navigation`, and `social`, and has no body. Navigation/social are nonempty arrays whose items contain only `label` and `href`; duplicate hrefs fail within each array. URLs must begin with a single `/`, `https://`, or `mailto:`. Navigation gets `aria-current="page"` only for an exact route match, not a section-prefix match.

## Filenames and Markdown

Content paths use lowercase ASCII kebab-case segments and `.md`, for example `content/blogs/a-useful-post.md`. Use `home.md` for `/`; `content/index.md` is forbidden. `_site.md` is the named configuration exception. A nested `index.md` creates that folder's landing page and is excluded from automatic lists.

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

Link to [related writing](/blogs/) and explain the result.
```

Use labeled lowercase fences such as `js`, `sh`, `text`, or `mermaid`, without fence metadata. Tutorial code is content, not executable repository code; Markdown formatting preserves code text. Generation does not rewrite `content/**` fences. It normalizes and, for Biome-supported languages, formats those fences for display, then highlights the formatted text. Article examples under `content/blogs/` and their rendered code elements under `pages/blogs/` are explicitly exempt from comment scanning: preserve explanatory comments and source-file labels. Other documentation examples are scanned by language. The separate U+2014 text check still applies everywhere. See [repository policies](repository-policies.md) for exact boundaries.

Raw HTML fails strict checking and is escaped by the renderer. MDX is unsupported and never executes JSX. Standard Markdown supports paragraphs, emphasis, lists, blockquotes, tables, images, links, and code. Fenced blocks are formatted then highlighted at generate time from the language label: published HTML wraps tokens in `text-syn-*` Tailwind color utilities whose tokens live in `styles.css`. `text`, `plaintext`, `math`, `mermaid`, unlabeled, and unknown labels stay escaped plain text. Mermaid diagrams and math are not rendered. Inline backtick code is not highlighted or reformatted.

## Links, images, headings, and lists

Page links must be root-relative, HTTP(S), mailto, or fragments; use trailing slashes on blog/experience page links. Documentation may use relative file links. Unsafe schemes and protocol-relative links fail content checks. Images require nonempty alt text and should live under assets, for example `/assets/content/blogs/example/diagram.webp`. The renderer's image URL policy accepts HTTPS but not HTTP even though the broader content URL check accepts HTTP; prefer local images or HTTPS.

The renderer promotes body headings to at least H2 and assigns IDs from lowercase text stripped of HTML tags and non-ASCII-alphanumeric runs. IDs not beginning with a letter get `section-`; collisions receive numeric suffixes, and `main` is reserved. The strict authoring checker rejects duplicate heading labels even though the renderer can disambiguate IDs. Heading wording changes may break inbound fragment links, which the local link checker does not verify.

```md
:::list blogs limit=5

:::list blogs/system-design

:::list exp
```

Place one directive in its own paragraph. The limit must be a positive integer; omission means all items. Selection is recursive by route prefix, excludes indexes and the current page, sorts newest date first then title, and displays period or year. Unknown or empty collections fail rendering. Tags and directory names do not automatically create landing pages: author an index page with a directive if needed.

Group two or more related images into a sliding carousel with Previous and Next buttons:

```md
:::carousel

![Traces main view](/assets/content/exp/magicapi/noveum.ai/traces/main-view.webp)

![Trace flow visualization](/assets/content/exp/magicapi/noveum.ai/traces/flow-chart.webp)

:::
```

The block may contain only images, each with alt text. Each slide links to its full-size image, which also makes the scrolling region reachable by keyboard. Without JavaScript it still scrolls horizontally with snap points; [theme.js](../theme.js) wires the buttons and the position counter.

## Components

Richer widgets come from the original site and render at generate time. A block component is an `embed` fence naming the component, whose single line is a JSON object of props. The inline form carries the same name and props inside running text. Unknown names, unknown props, and unsupported prop values fail generation rather than degrading silently.

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
| `math`, `info-tip`, `cmd-key` | Inline formula, hover tip, and command-key glyph                               |

Carousels that share a page need distinct accessible names: pass `label` to each `image-grid` so the landmarks stay unique. Components that need behavior load their own script and stylesheet; each one still renders readable markup without JavaScript.

## Layout semantics and appearance

[home.html](../layouts/home.html), [simple.html](../layouts/simple.html), and [article.html](../layouts/article.html) share the same semantic structure: English HTML document, skip link to `main`, site header/nav, main containing an article, one page H1, prose container, and footer. Home's main element adds utilities for smaller H2 headings; article/simple currently share most styling. Changing a template never creates a route.

The [head partial](../layouts/partials/head.html) loads theme JS before the body, then the page title and stylesheet. [header](../layouts/partials/header.html) contains the brand and navigation; [footer](../layouts/partials/footer.html) contains social links, copyright, and a theme button. Templates use checked placeholders and partial includes, not a general expression language. See [rendering flow](rendering-flow.md) for escaping and full page titles.

Styling uses Tailwind CSS v4. [styles.css](../styles.css) is the Tailwind entry: it replaces the default theme with the site's tokens (warm light/dark colors, syntax colors, font sizes, weights, line heights, radii, and a 560-pixel `sm` breakpoint), defines a `dark` variant for the system preference and the `data-theme` override, redefines the palette under that variant, and keeps the view-transition rules, which have no utility equivalent. It has no element or class selectors and skips Preflight. Layouts and [render-page.mjs](../scripts/render-page.mjs) put utility classes on every element: the centered 760-pixel shell, fluid H1 sizing, header, footer, listings, breadcrumbs, the skip link, and each Markdown element (headings, paragraphs, lists, quotes, code, tables, rules, links, images) through marked renderer overrides. Below 560 pixels (`max-sm:`) the header stacks and padding tightens. Tailwind scans only `layouts/`, `render-page.mjs`, and `highlight.mjs`, so classes must appear as complete literal strings there. Browser CSS has no `@font-face` rules. Social-card generation separately uses the bundled IBM Plex Mono TTF with system fonts disabled. There is no component library or animation runtime in the active site.

[theme.js](../theme.js) reads `portfolio-theme` from localStorage and applies only `light` or `dark`. Otherwise CSS follows the system preference. After DOM readiness, the button toggles the effective theme and tries to persist it; storage failures are swallowed. With JavaScript disabled the site remains readable and follows system colors, but the button cannot change them. There is no explicit reset-to-system control or theme-specific button state text.

## Safe editing recipes

For an existing page, edit Markdown, format it, generate HTML, inspect the resulting diff and browser view, then run CI. Shared metadata/template edits can legitimately update all 66 HTML files; date/title changes can update listing pages too.

```sh
bun run format
bun run generate
bun run ci
```

For a new article, create a correctly named file in `content/blogs/` or a series directory with title, description, and date. Add assets if needed. Generation creates its route and updates existing applicable lists. Generation also creates its card, canonical metadata, JSON-LD, and sitemap entry. No registry edit or migration-audit update is needed. Add an explicit link or listing for a new standalone page, since route generation alone does not make it discoverable through navigation.

For a rename/removal, update internal links, remove/rename the source, then run `bun run generate --clean`. Review deleted outputs and list changes. This removes orphan HTML and generated assets under the selected output directory, normally `pages/`; no redirect is generated for an old route. Removing the last item in a collection also requires changing/removing its directive to avoid an empty-collection error.

Before a commit, stage the intended Markdown, generated HTML, social cards, crawler files, assets, and related templates together. Partial staging must preserve the source/output relationship because the hook checks the index. A documentation-only edit does not require regenerating site output. Development preview does not update committed production pages; run normal generation before staging page edits.

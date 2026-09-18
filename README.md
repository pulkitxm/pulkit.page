# pulkit.page

A small, static portfolio. Edit Markdown in `content/`; HTML is generated into
`pages/`. The site uses Tailwind CSS compiled at build time and a small theme toggle,
without a client framework.

For a detailed walkthrough, start with the [documentation index](docs/index.md).

## Editing

For local development, run from the repository root:

```sh
bun run dev
```

Open the URL printed in the terminal. The server prefers `http://localhost:3000/`
and tries higher ports until a port binds. Vite renders HTML and social cards only when their URLs
are requested. Content and layout edits invalidate affected results and reload the browser;
CSS updates use Vite hot replacement. Routes work at `/`, `/blogs/`, and so on.
Set `PORT=3001 bun run dev` to require a specific port, or `PORT=0 bun run dev`
to ask the OS for an available port. An occupied explicit port reports an error. Deleted Markdown pages immediately stop resolving after the watcher receives the change. Use `bun run build` for the deployable `dist/` output.

Development logs show one line per page request, with a local timestamp, URL, status,
compilation result, and total response time:

```text
[06:06:34.963] GET / | 200 | compiled in 39 ms | total 52 ms
[06:06:34.966] GET / | 200 | cached | total 1 ms
[06:06:35.059] GET / | 200 | rebuilt in 36 ms | total 38 ms
```

`compiled` means first rendering, `rebuilt` means rendering again after a change,
and `cached` means no compilation was needed. Compilation time measures page
creation; total time includes the entire server response. File edits get a short
notice. Successful CSS, script, and internal requests stay quiet; failures remain visible.

```sh
bun install
bun run format
bun run generate
bun run ci
```

`bun install` installs the pre-commit hook. Edit a page, format, regenerate, and
stage both its Markdown and generated HTML. Shared navigation and footer links
live in `content/_site.md`. This configuration file does not generate a page.

A page needs a title, description, and ordinary Markdown:

```md
---
title: About
description: About Pulkit, a software engineer based in India.
---

I'm Pulkit. I build products for the web.
```

Optional metadata: `date: YYYY-MM-DD`, `role`, `period`, `tags`, and
`layout: home|simple|article`. The title supplies the H1. Use `##` for sections.
Raw HTML is displayed as text; JSX and MDX are not executed. Code fences, tables,
images, quotes, and links use ordinary Markdown. Images belong in `assets/`.

Lists are automatic, including nested articles, ordered newest first:

```md
:::list blogs limit=5

:::list experience

:::list blogs/system-design
```

Omit `limit` to include every entry. Collection index pages are excluded from lists.
The title, date, and period come from each page's metadata, so adding an article
updates its archive and the homepage when regenerated.

## Routes and layouts

- `content/home.md` → `pages/index.html` → `/`
- `content/about.md` → `pages/about/index.html` → `/about/`
- `content/blogs/index.md` → `pages/blogs/index.html` → `/blogs/`
- `content/blogs/system-design/caching.md` → `/blogs/system-design/caching/`

The homepage uses `home`; blog detail pages default to `article`; other pages
use `simple`. Set `layout` to override. Templates live in `layouts/`, with shared
head, header, and footer partials. Their placeholder names are checked. Adding a
layout never adds content. Markup uses Tailwind utility classes; `styles.css` holds the
theme tokens, the dark palette, and view transitions. The renderer adds utility classes to
every Markdown element. Theme behavior lives in `theme.js`.

## Sync and CI

```sh
bun run generate
bun run check:generated
bun run generate --clean
bun run ci
```

The shell entry points are `scripts/generate.sh` and `scripts/check-sync.sh`.
They invoke the same renderer and inventory, avoiding two competing definitions
of the site. All sources and templates are rendered successfully before output
is changed. Shared metadata and layout edits participate in the exact-byte check.
Conflicting routes, symlinks, malformed metadata, and unsupported MDX fail.

Extra HTML is checked across the repository, including root and nested legacy
pages, case-insensitively. Only `.git/`, `node_modules/`, `extras/`, `dist/`, and
`layouts/` are excluded; templates are validated separately. In default production mode, `--clean`
removes orphan HTML and extra generated assets under `pages/`, and prunes empty
HTML parent directories. Environment-specific generation cleans its selected output directory. It never removes
legacy HTML elsewhere. Normal generation and sync checks do not delete files.

The pre-commit hook runs CI on a temporary copy of the **staged index**, catching
partially staged Markdown/HTML mismatches without changing your worktree or index.
GitHub Actions runs the same checks: strict Biome, HTML validation, formatting,
repository checks, renderer/sync tests, build, local links, and shell syntax.

`bun run build` first requires production sync, then renders `dist/` for the selected
environment, copies shared assets, and compiles `styles.css` with the Tailwind CLI into a
minified `dist/styles.css` that contains only the utilities used by layouts and the renderer.
GitHub Pages deploys `dist/`. Markdown, templates, and reference files are not
published. Source files are capped at 2 MiB; migrated media at 5 MiB.

```sh
bun run build
bun start
```

`bun start` (or `bun run start`) serves the existing `dist/` build on loopback port
3000, then 3001, 3002, and so on if occupied. `PORT=3001 bun start` selects an explicit port.
It does not rebuild or watch files. Request logs show `served from dist` and response
time, not compilation time. Run `bun run build` again after source changes,
or use `bun dev` for live editing. Missing build output reports the build command.

Run `bun serve` to build and then start the preview. It starts only if the build succeeds.

```sh
bun dev:clean
bun serve
bun serve:clean
```

The `:clean` variants first remove `dist/`, `.cache/`, `node_modules/.vite/`, and
`node_modules/.vite-temp/` completely, then run their normal command. This includes
all development outputs and persistent renderer and Vite caches. `bun clean` performs
only the cleanup. Source files, committed `pages/`, and installed packages are kept.

## Migration

The articles and experience content come from `extras/pulkitxm.com`. Every reference
MDX file has a corresponding Markdown file; `docs/content-migration.json` records
the source mapping, code-block counts, copied assets, and converted components.

`scripts/import-reference.mjs` is a one-time importer, not part of generation or
CI. It parses MDX as an AST, preserves fenced code, and refuses to overwrite
existing Markdown. Complex widgets become standard images, quotes, or links.
Interactive examples and embedded videos link to their original pages; they are
not interactive in this static version. Experience details, landing, About, Contact, résumé, tools,
and services pages are deliberately short. Backend features such as the guestbook
are outside this static portfolio.

The ignored reference directory is unnecessary for normal editing, generation,
checks, and deployment. Edit the migrated Markdown going forward.

## Strict quality rules

Biome is the only code and HTML formatter. Prettier is not installed. The pinned
Biome version does not support Markdown or YAML, so `scripts/check-content.mjs`
uses the existing Remark/YAML parsers for strict validation and deterministic
formatting. Fenced example code is preserved byte-for-byte, not reformatted as
repository JavaScript. Generation formats HTML with Biome until its experimental
HTML formatter reaches a stable result; failure to stabilize aborts generation.

- Code: all accessibility, security, and correctness rules, plus explicit strict
  style rules. Warnings fail. Unused variables/imports, explicit `any`, `var`,
  loose equality, debugger statements, skipped/focused tests, CommonJS, default
  exports, parameter assignment, and non-null assertions are rejected. Braces,
  Node import prefixes, kebab-case filenames, and consistent formatting are enforced.
- Markdown paths: lowercase ASCII kebab-case directories and `.md` files.
  `content/_site.md` and the root `README.md` are the named exceptions.
  `content/index.md` is forbidden; the root page is `content/home.md`.
- Metadata: title and description required; unknown fields rejected. Blog and
  experience detail pages require real ISO dates; experience also requires role
  and period. Strings must be nonempty and trimmed; tags must be unique.
  Titles are capped at 120 characters and descriptions at 320. Layouts must exist.
- Structure: no raw HTML, duplicate headings, skipped heading levels, or body H1
  in pages. Documentation requires exactly one H1. Code fences require a lowercase
  language (`text` for plain examples). Images need alt text; links need labels.
  Unsafe URLs and malformed list directives fail.
- Shared metadata: navigation and social lists require unique safe URLs and labels.
  YAML rejects duplicate keys, custom tags, anchors, aliases, and parser warnings.
- Formatting: LF endings, no BOM, one final newline, consistent lists, fences,
  metadata, and YAML. Checks never write. Only `bun run format` fixes formatting;
  invalid metadata is reported without being silently rewritten.
- Repository: no symlinks, temporary/merge artifacts, case-colliding paths,
  oversized files, or generated HTML without a Markdown source.

There are explicit environment exceptions: CLI scripts may log and import Node
modules; only CLI scripts know the Bun global. The Qwik-only lexical-scope rule
is disabled because this is not a Qwik project. Biome's import resolver does not
correctly resolve this project's Bun/test and Babel imports, so `check:imports`
uses the runtime resolver to verify static imports instead. Comment-based suppressions are forbidden, including in tests.

```sh
bun run format
bun run generate
bun run check:content
bun run lint
bun run ci
```

CI and the staged-snapshot pre-commit hook run these same checks. Adding a new
`check:*` script automatically adds it to the CI runner.

## Repository text and dead-code policies

All tracked text files, plus nonignored new files, must contain no literal em dash
characters. Source-code comments are rejected except in article examples under
`content/blogs/` and their rendered code under `pages/blogs/`. Preserve those
examples and their explanatory comments. Other Markdown examples and embedded
scripts/styles in HTML are checked. Shebangs are executable interpreter
metadata, so only a shebang at the start of a source is accepted. Comment-based
lint suppressions, documentation comments, Python docstrings, and license comments
are not exempt. Quoted comment markers are strings, not comments.

Knip checks executable source, tests, dependency usage, and exported symbols.
Unused files, dependencies, exports, and configuration hints fail CI. Runtime entry
points are declared explicitly; new helper files are not automatically exempted.
The reference importer remains an intentional manual command, `bun run import:reference`.

```sh
bun run check:comments
bun run check:em-dashes
bun run check:dead-code
bun run ci
```

The same commands run in the staged-snapshot pre-commit hook. Read
[the policy guide](docs/repository-policies.md) for coverage and limits.

## SEO and social cards

The root `CNAME` is the single source of the production hostname. Generation uses
HTTPS with that hostname; the current file contains `new.pulkit.page`. Change
`CNAME` when changing the production domain. No domain is duplicated in Markdown.

`bun run dev` uses Vite with request-time Markdown rendering and the actual server origin.
HTML, social cards, sitemap, and robots are served on demand without writing development
files into `dist/`. Committed `pages/` stays untouched. Checksummed render caches live
in `.cache/generate/`. Content and template edits invalidate dependencies and reload
the browser. Bun watches imported server code and restarts it after changes.
See [development benchmarks](docs/development-benchmarks.md) for timings and reproduction.

`bun run generate` defaults to production and writes committed `pages/`.
`bun run build` verifies that production output is synchronized, then renders the
selected environment into `dist/` and copies shared assets. For another deployment:

```sh
NODE_ENV=staging SITE_URL=https://preview.example.com bun run build
NODE_ENV=staging SITE_URL=https://preview.example.com bun run check:seo
```

`SITE_URL` overrides the origin for builds and standalone generation. It must be
an absolute HTTP(S) origin without credentials, a path, query, or fragment. A
trailing slash is normalized. `NODE_ENV=development` standalone generation uses
`http://127.0.0.1:<PORT>` (3000 by default); other nonproduction environments require
`SITE_URL`. Environment-specific generation defaults to `dist/` and cannot write
`pages/`. Production builds include `CNAME`; custom-origin builds omit it so previews
do not claim the production custom domain. Sitemap, robots, canonical URLs, social
metadata, JSON-LD and card branding all use the same resolved origin.

Titles and descriptions come from each Markdown page. Full titles are retained,
with the shared brand appended. Every page has canonical, robots, Open Graph,
Twitter large-card metadata and one safely escaped JSON-LD graph.

The graph connects Person, WebSite, WebPage, ImageObject and breadcrumbs. Articles
use BlogPosting with the existing publication date; collection pages use
CollectionPage and ItemList. About and Contact use their corresponding page types.
Experience uses WebPage about the person, without inventing employment dates or
claiming every past organization as a current employer. No inferred modification
dates, ratings or credentials are emitted. See the [Schema.org vocabulary](https://schema.org/BlogPosting)
and [Open Graph protocol](https://ogp.me/).

Breadcrumbs derive from actual ancestor pages. Collection links expose nested
archives; related writing selects up to three articles by shared tags and series.
Historical code examples remain unchanged. Links to external interactive demos
remain external because this static site does not reproduce those interactions.

Generation also writes `pages/sitemap.xml`, `pages/robots.txt`, and one 1200×630 PNG
per page under `pages/og/`. `scripts/og-images.mjs` renders cards using pinned resvg
and the bundled, licensed IBM Plex Mono TTF, with system fonts disabled. Titles,
category, brand, production hostname and existing dates/periods derive from content.
The current monochrome card design is provisional: the requested `pulkitdixon.com`
reference could not be located locally and must be supplied before matching it.

Stage these generated assets with the HTML. Sync compares PNG bytes and crawler
files, detecting missing, stale and extra assets. `--clean` removes orphan generated
assets inside the selected output directory, normally `pages/`. Build renders them into `dist/`; development renders requested assets on demand. `check:seo` validates every built page's metadata, JSON-LD, canonical
links, PNG dimensions and exact sitemap coverage. CI and staged-snapshot hooks
include this check automatically. New source metadata must still pass strict schema
validation; no hand edits to generated files are needed.

# pulkit.page

Two small static sites built as a Bun and Turborepo monorepo: the pulkit.page
portfolio in `apps/page` and the pulkit.blog writing in `apps/blog`. Pages are
Markdown in each app's `content/`; a small static site generator in
`packages/engine` renders them into that app's `dist/`. Both sites use Tailwind CSS
compiled at build time and a small theme script, without a client framework.

For a detailed walkthrough, start with the [documentation index](docs/index.md).

## Workspace layout

```text
apps/
  page/               @pulkit/page: the pulkit.page portfolio (content, layouts, assets, styles.css, CNAME)
  blog/               @pulkit/blog: the pulkit.blog writing (content, layouts, assets, styles.css, CNAME)
packages/
  engine/             @pulkit/engine: the static site generator and its `site` CLI
  code/               @pulkit/code: build-time syntax highlighting and Biome formatting
  embeds/             @pulkit/embeds: Markdown embed renderers and their browser scripts
  demos/              @pulkit/demos: interactive motion demos rendered by `:::demo`
  theme/              @pulkit/theme: shared Tailwind base, theme script, fonts, and icons
  profile/            @pulkit/profile: shared author name, profile URL, site domains, and social links
tooling/
  checks/             @pulkit/checks: repository-wide content, comment, text, and import gates
  benchmarks/         development server benchmark runner
docs/                 guides and the historical migration audit
```

Workspaces are declared in the root [package.json](package.json). Apps depend on
packages through `workspace:*` versions; nothing is published to a registry.

## Quick start

```sh
bun install
bun run dev
```

`bun install` also installs the pre-commit hook. `bun run dev` starts both
development servers side by side; open the URLs printed in the terminal. pulkit.page
prefers `http://localhost:3000/` and pulkit.blog prefers `http://localhost:3001/`
(its `dev` script sets `SITE_DEV_PORT=3001`); each tries higher ports until one
binds. Set `PORT` to require a specific port or `PORT=0` to ask the OS for one. Vite renders HTML and
social cards only when requested, reloads the browser after content and layout
edits, and uses hot replacement for CSS.

Development logs show one line per page request:

```text
[06:06:34.963] GET / | 200 | compiled in 39 ms | total 52 ms
[06:06:34.966] GET / | 200 | cached | total 1 ms
[06:06:35.059] GET / | 200 | rebuilt in 36 ms | total 38 ms
```

`compiled` means first rendering, `rebuilt` means rendering again after a change,
and `cached` means no compilation was needed.

## Common commands

Run these from the repository root:

| Command                                    | What it does                                                      |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `bun run dev`                              | Start the development server of every app                         |
| `bunx turbo run dev --filter=@pulkit/page` | Start only the pulkit.page development server                     |
| `bunx turbo run dev --filter=@pulkit/blog` | Start only the pulkit.blog development server                     |
| `bun run build`                            | Build every app into its `dist/`                                  |
| `bun run start`                            | Build, then preview each built app on loopback                    |
| `bun run test`                             | Run every package's tests                                         |
| `bun run ci`                               | Run every gate: tests, build, post-build checks, repository gates |
| `bun run format`                           | Apply Biome fixes and canonical Markdown/YAML formatting          |
| `bun run clean`                            | Remove each app's `dist/`, `.cache/`, `.turbo/`, and Vite caches  |

A single app script can also run directly with `bun run --cwd apps/page <script>`,
for example `bun run --cwd apps/blog check:seo`. Unlike the Turbo tasks, direct app
scripts do not build first. Set `PLAYWRIGHT_CHANNEL=chrome` to let `check:browser`
reuse a locally installed Chrome instead of the Playwright Chromium download.

## Turbo caching and invalidation

[turbo.json](turbo.json) describes the task graph. Package workspaces have no build
step, so a `transit` task links them: `build`, `test`, and `check:layouts` depend on
`^transit`, which makes Turbo hash the source of every package the app depends on. An edit in
`packages/engine`, `packages/embeds`, or any other dependency therefore invalidates
the builds of the apps that use it. `biome.json`, `.htmlvalidate.json`, `NODE_ENV`,
and `SITE_URL` are global inputs.

`build` caches `dist/**`, so an unchanged app restores its output instead of
rendering again. `check:seo`, `check:site`, `check:html`, and `check:browser` depend on
`build`. The `verify` task aggregates tests, layout checks, post-build checks, and the
root repository gates, and `bun run ci` is `turbo run verify`. `dev`, `start`, and
`clean` are never cached. Inside a build, the engine keeps a separate checksummed
render cache under `apps/<app>/.cache/generate/`, so a real rebuild re-renders only
the pages whose inputs changed.

The pre-commit hook checks out the staged index into a temporary directory, installs
dependencies there with `bun install --frozen-lockfile --ignore-scripts`, and runs
`bun run ci` with `TURBO_CACHE_DIR` pointing at the repository's `.turbo/cache`, so
unchanged tasks replay from cache. GitHub Actions runs the same `bun run ci` and then a
separate browser smoke job against the uploaded build.

## Authoring

A page needs a title, description, and ordinary Markdown:

```md
---
title: About
description: About Pulkit, a software engineer based in India.
---

I'm Pulkit. I build products for the web.
```

Optional metadata: `date: YYYY-MM-DD`, `role`, `period`, `tags`, and
`layout: home|simple|article`. The title supplies the H1; use `##` for sections.
Raw HTML is displayed as text and MDX is not supported. Images belong in the app's
`assets/`, for example `apps/blog/assets/content/`, and each app's navigation and
footer links live in its `content/_site.md`. Social links default to the shared
`@pulkit/profile` list.

The optional `articles` field in `_site.md` is a root-relative prefix such as `/`
or `/notes/` that marks which non-index pages are posts. pulkit.page has none;
pulkit.blog sets `articles: /`. Posts get the article layout, a meta line with the
date, reading time, and category, related writing, BlogPosting JSON-LD, and an Atom
feed at `/feed.xml`, and the site's social links gain an RSS entry. Every post
needs a `date`.

Lists are automatic, including nested entries, ordered newest first. A list
directive names a collection, an optional limit, and an optional year grouping:

```text
:::list <collection> [limit=N] [by-year]
```

```md
:::list exp limit=3

:::list system-design

:::list all by-year
```

The collection `all` lists every post of the site, and `by-year` groups the list
under year headings with day and month dates; ungrouped lists show month and year.

Routes come from file paths:

- `apps/page/content/home.md` becomes `/` on pulkit.page
- `apps/page/content/exp/magicapi.md` becomes `/exp/magicapi/` on pulkit.page
- `apps/blog/content/git-worktrees.md` becomes `/git-worktrees/` on pulkit.blog
- `apps/blog/content/system-design/index.md` becomes the `/system-design/` category
- `apps/blog/content/system-design/caching.md` becomes `/system-design/caching/`

The [authoring guide](docs/authoring-guide.md) covers the full schema, adding a
post, embeds, demos, layouts, and appearance.

## Deployment

Each app's `CNAME` is the single source of its production hostname:
`apps/page/CNAME` contains `pulkit.page` and `apps/blog/CNAME` contains
`pulkit.blog`. After every CI job passes, the workflow uploads each app's built
`dist/` to its own Vercel project: previews for pull requests, production from
`main`. Each app's `vercel.json` holds its routing, including permanent redirects
from the old `pulkit.page/blogs/*` URLs to pulkit.blog. Generated HTML, social
cards, sitemap, feed, and robots output are never committed. The
[deployment guide](docs/deployment.md) covers the one-time Vercel and domain setup. See [SEO and environments](docs/seo-and-environments.md) for preview
origins and `SITE_URL`.

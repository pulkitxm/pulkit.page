# pulkit.page

Two small static sites built as a Bun and Turborepo monorepo: the pulkit.page
portfolio in `apps/page` and the pulkit.blog writing in `apps/blog`. Pages are
Markdown in each app's `content/`; a small static site generator in
`packages/engine` renders them into that app's `dist/`. Both sites use Tailwind CSS
compiled at build time and a small theme script, without a client framework.

For a detailed walkthrough, start with the [architecture overview](docs/architecture.md)
or the [documentation index](docs/index.md).

## Workspace layout

```text
apps/
  page/               @pulkit/page: the pulkit.page portfolio (content, assets, styles.css, CNAME)
  blog/               @pulkit/blog: the pulkit.blog writing (content, assets, styles.css, CNAME)
packages/
  engine/             @pulkit/engine: the static site generator and its `site` CLI
  theme/              @pulkit/theme: the shared stylesheet, layouts, assets, and theme script
  shared/             @pulkit/shared: browser-safe and Node helpers shared across workspaces
  code/               @pulkit/code: build-time syntax highlighting and code formatting
  embeds/             @pulkit/embeds: Markdown embed renderers and their browser scripts
  demos/              @pulkit/demos: interactive motion demos rendered by demo directives
  profile/            @pulkit/profile: shared author name, profile URL, site domains, and social links
tooling/
  checks/             @pulkit/checks: repository-wide content, comment, text, and import gates
  lighthouse/         @pulkit/lighthouse: parallel Lighthouse reports for both sites
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
(its `dev` and `start` scripts set `SITE_PORT=3001`); each tries higher ports until one
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
| `bun run dev:clean`                        | Clean every app, then start the development servers               |
| `bun run build`                            | Build every app into its `dist/`                                  |
| `bun run build:clean`                      | Clean every app, then build without the Turbo cache               |
| `bun run serve`                            | Build, then preview each built app on loopback                    |
| `bun run serve:clean`                      | Clean every app, then build without cache and preview             |
| `bun run test`                             | Run every package's tests                                         |
| `bun run ci`                               | Run every gate: tests, build, post-build checks, repository gates |
| `bun run format`                           | Apply Biome fixes and canonical Markdown/YAML formatting          |
| `bun run lint`                             | Run Biome without writing, failing on warnings                    |
| `bun run lighthouse`                       | Build both sites, then audit every route with Lighthouse          |
| `bun run clean`                            | Remove each app's `dist/`, `.cache/`, `.turbo/`, and Vite caches  |

The root `check:*` scripts run the individual repository gates that
`bun run ci` aggregates: `check:content`, `check:comments`,
`check:repository`, `check:em-dashes`, `check:imports`, `check:dead-code`, and
`check:shell`.

A single app script can also run directly with `bun run --cwd apps/page <script>`,
for example `bun run --cwd apps/blog check:seo`. Unlike the Turbo tasks, direct app
scripts do not build first. Set `PLAYWRIGHT_CHANNEL=chrome` to let `check:browser`
reuse a locally installed Chrome instead of the Playwright Chromium download.

## Turbo caching and invalidation

[turbo.json](turbo.json) describes the task graph. Package workspaces have no build
step, so a `transit` task links them: `build`, `test`, and `check:layouts` depend on
`^transit`, which makes Turbo hash the source of every package the app depends on. An edit in
`packages/engine`, `packages/theme`, or any other dependency therefore invalidates
the builds of the apps that use it. `biome.json`, `.htmlvalidate.json`, `NODE_ENV`,
and `SITE_URL` are global inputs. [apps/page/turbo.json](apps/page/turbo.json) adds
`apps/blog/content` to the inputs of the portfolio build, because its home page lists
the newest posts.

`build` caches `dist/**`, so an unchanged app restores its output instead of
rendering again. `check:seo`, `check:site`, `check:html`, and `check:browser` depend on
`build`. The `verify` task aggregates tests, layout checks, post-build checks, and the
root repository gates, and `bun run ci` is `turbo run verify`; `check:browser` stays
outside it because it needs a browser. `dev`, `start`, and
`clean` are never cached. Inside a build, the engine keeps a separate checksummed
render cache under `apps/<app>/.cache/generate/`, so a real rebuild re-renders only
the pages whose inputs changed. [Architecture](docs/architecture.md#three-layers-of-caching)
explains all three caching layers.

The pre-commit hook checks out the staged index into a temporary directory, installs
dependencies there with `bun install --frozen-lockfile --ignore-scripts`, and runs
`bun run ci` with `TURBO_CACHE_DIR` pointing at the repository's `.turbo/cache`, so
unchanged tasks replay from cache. GitHub Actions runs the same `bun run ci` and then a
separate browser smoke job against the uploaded build, and deploys both sites from the
same run; see [continuous integration](docs/continuous-integration.md).

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
MDX is not supported, and raw HTML is limited to a small reviewed set of tags.
Images belong in the app's
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

:::list blog:all limit=5
```

The collection `all` lists every post of the site, and `blog:all` lists every post
of `apps/blog` from another app, linking to pulkit.blog; pulkit.page's home uses it
for its latest five posts. `by-year` groups the list under year headings with day
and month dates; ungrouped lists show month and year, and limited lists show day
and month for this year's posts.

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
`pulkit.blog`. Both sites are served by GitHub Pages: after every CI job passes
on `main`, the workflow deploys `apps/page/dist` to this repository's Pages and
pushes `apps/blog/dist` to the `gh-pages` branch of pulkitxm/pulkit.blog, which
only hosts the built site. The [deployment guide](docs/deployment.md) covers the
one-time setup and DNS. Generated HTML,
social cards, sitemap, feed, and robots output are never committed. See [SEO and environments](docs/seo-and-environments.md) for preview
origins and `SITE_URL`.

Every page on both sites is also published as Markdown beside its HTML:
`/about/` has `/about.md`, and `/` has `/index.md`. Each site's `/llms.txt`
indexes those copies. See
[Markdown copies and llms.txt](docs/seo-and-environments.md#markdown-copies-and-llmstxt).

## License

The repository is licensed in two parts, and some material is not licensed at all.

The code is under the [PolyForm Noncommercial License 1.0.0](LICENSE): everything in
`packages/`, `tooling/`, and the build and configuration files at the root. You may
read, run, modify, and share it for any noncommercial purpose, and any copy you pass
on must carry the required copyright notice. Commercial use is not licensed.

The writing is under [CC BY-NC-ND 4.0](LICENSE-CONTENT): `apps/page/content`,
`apps/blog/content`, and `docs`. You may republish it with credit to Pulkit and a
link back to the original. You may not use it commercially, and you may not publish
an edited version of a post.

Nothing else is licensed:

- the name Pulkit, the wordmark, the favicon, and the portrait in `packages/theme/assets`
- personal documents in `apps/page/assets/content`, including the resume, offer letters, and relieving letters
- third-party company logos in `apps/page/assets/exp`, which belong to those companies
- the bundled fonts, which carry their own licenses beside them in `packages/theme/assets/fonts`

Building your own site on this code is fine under the code license, but the identity
is not part of it. Replace the branding, the content, and the personal documents
before you deploy.

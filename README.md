# pulkit.page

A small static portfolio and writing archive, built as a Bun and Turborepo
monorepo. Pages are Markdown in `apps/page/content/`; a small static site
generator in `packages/engine` renders them into `apps/page/dist/`. The site uses
Tailwind CSS compiled at build time and a small theme script, without a client
framework.

For a detailed walkthrough, start with the [documentation index](docs/index.md).

## Workspace layout

```text
apps/
  page/               @pulkit/page: the pulkit.page site (content, layouts, assets, styles.css, CNAME)
packages/
  engine/             @pulkit/engine: the static site generator and its `site` CLI
  code/               @pulkit/code: build-time syntax highlighting and Biome formatting
  embeds/             @pulkit/embeds: Markdown embed renderers and their browser scripts
  demos/              @pulkit/demos: interactive motion demos rendered by `:::demo`
  theme/              @pulkit/theme: shared Tailwind base, theme script, fonts, and icons
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

`bun install` also installs the pre-commit hook. `bun run dev` starts every app's
development server; open the URL printed in the terminal. The server prefers
`http://localhost:3000/` and tries higher ports until one binds. Set `PORT=3001` to
require a specific port or `PORT=0` to ask the OS for one. Vite renders HTML and
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
| `bun run build`                            | Build every app into its `dist/`                                  |
| `bun run start`                            | Build, then preview each built app on loopback                    |
| `bun run test`                             | Run every package's tests                                         |
| `bun run ci`                               | Run every gate: tests, build, post-build checks, repository gates |
| `bun run format`                           | Apply Biome fixes and canonical Markdown/YAML formatting          |
| `bun run clean`                            | Remove each app's `dist/`, `.cache/`, `.turbo/`, and Vite caches  |

A single app script can also run directly with `bun run --cwd apps/page <script>`,
for example `bun run --cwd apps/page check:seo`. Unlike the Turbo tasks, direct app
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
Raw HTML is displayed as text and MDX is not supported. Images belong in
`apps/page/assets/`, and shared navigation and footer links live in
`apps/page/content/_site.md`.

Lists are automatic, including nested articles, ordered newest first:

```md
:::list blogs limit=5

:::list exp

:::list blogs/system-design
```

Routes come from file paths:

- `apps/page/content/home.md` becomes `/`
- `apps/page/content/about.md` becomes `/about/`
- `apps/page/content/blogs/index.md` becomes `/blogs/`
- `apps/page/content/blogs/system-design/caching.md` becomes `/blogs/system-design/caching/`

The [authoring guide](docs/authoring-guide.md) covers the full schema, embeds,
demos, layouts, and appearance.

## Deployment

The app's `CNAME` is the single source of the production hostname; it currently
contains `pulkit.page`. GitHub Pages deploys `apps/page/dist` from `main` after every
CI job passes. Generated HTML, social cards, sitemap, and robots output are never
committed. See [SEO and environments](docs/seo-and-environments.md) for preview
origins and `SITE_URL`.

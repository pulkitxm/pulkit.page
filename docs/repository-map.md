# Guided repository map

[Documentation index](index.md) · [Architecture](architecture.md)

## Workspace tree

The repository is a Bun workspace driven by Turborepo. The root [package.json](../package.json) declares three workspace globs: `apps/*`, `packages/*`, and `tooling/*`. Every workspace is private and depends on its siblings through `workspace:*` versions.

```text
apps/page/            @pulkit/page        the pulkit.page portfolio
apps/blog/            @pulkit/blog        the pulkit.blog writing
packages/engine/      @pulkit/engine      static site generator and `site` CLI
packages/theme/       @pulkit/theme       shared stylesheet, layouts, assets, theme script
packages/shared/      @pulkit/shared      HTML escaping and built-site walkers
packages/code/        @pulkit/code        syntax highlighting and code and HTML formatting
packages/embeds/      @pulkit/embeds      Markdown embeds and their browser scripts
packages/demos/       @pulkit/demos       interactive motion demos
packages/profile/     @pulkit/profile     shared author, profile URL, domains, social links
tooling/checks/       @pulkit/checks      repository-wide gates and hook installer
tooling/lighthouse/   @pulkit/lighthouse  parallel Lighthouse reports for both sites
tooling/benchmarks/                       development server benchmark runner
docs/                                     these guides and the migration audit
```

## The site apps

Both apps have the same shape and no code of their own. pulkit.page is the portfolio; pulkit.blog holds every post.

| Path                                                         | Responsibility                                                                     | How to maintain it                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------- |
| [apps/page/content/](../apps/page/content/)                  | 12 portfolio and experience page sources plus `_site.md`                           | Edit Markdown/frontmatter here           |
| [apps/page/content/\_site.md](../apps/page/content/_site.md) | Brand, description fallback, navigation (Writing points to pulkit.blog), copyright | Edits change every pulkit.page page      |
| [apps/page/assets/](../apps/page/assets/)                    | Experience images, company logos, and résumé PDF                                   | Refer to public root-relative `/assets/` |
| [apps/page/CNAME](../apps/page/CNAME)                        | Production hostname `pulkit.page`                                                  | Change only when the domain changes      |
| [apps/blog/content/](../apps/blog/content/)                  | 54 page sources (home, posts, two series categories) plus `_site.md`               | Add and edit posts here                  |
| [apps/blog/content/\_site.md](../apps/blog/content/_site.md) | Brand `pulkit.blog`, `articles: /`, navigation, copyright                          | Edits change every pulkit.blog page      |
| [apps/blog/assets/](../apps/blog/assets/)                    | Post images and video under `assets/content/`                                      | Refer to public root-relative `/assets/` |
| [apps/blog/CNAME](../apps/blog/CNAME)                        | Production hostname `pulkit.blog`                                                  | Change only when the domain changes      |
| `apps/<app>/styles.css`                                      | One line importing `@pulkit/theme/styles.css`                                      | Compiled and minified into `dist/`       |
| `apps/<app>/package.json`                                    | App scripts that call the `site` CLI                                               | Add app tasks here and in `turbo.json`   |

App scripts (`dev`, `build`, `start`, `clean`, `check:seo`, `check:site`, `check:html`, `check:browser`) run with the app as the working directory, so every relative path the engine uses (`content/`, `assets/`, `styles.css`, `CNAME`, `dist/`, `.cache/`) resolves inside that app. Neither app has a `layouts/` directory, so the engine uses the shared layouts in `packages/theme/layouts/`; an app that adds its own `layouts/` would use those instead. The scripts are identical except that the blog's `dev` and `start` scripts set `SITE_PORT=3001`, so its servers prefer port 3001 while pulkit.page prefers 3000.

Both apps share one presentation from `packages/theme`: Comic Relief with a warm light/dark palette, the same header, footer, breadcrumbs, article byline, and 760-pixel column. Only content and `_site.md` differ; the engine advertises `/feed.xml` only on pulkit.blog, whose `_site.md` sets `articles`.

## Packages

| Package                                  | Contents                                                                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [packages/engine](../packages/engine/)   | `src/cli.mjs` (the `site` bin), inventory, rendering, layouts, generation, build, Vite development server, preview, SEO, social cards, Markdown copies and `llms.txt`, render cache, origin resolution, post-build checks, and their tests |
| [packages/shared](../packages/shared/)   | browser-safe `html`, `storage`, `motion`, `frontmatter`, and `markdown` modules plus Node-only `built-site`, `bundle`, `duration`, `failures`, `files`, `hash`, `repository`, and `tailwind` modules, imported by every other workspace    |
| [packages/code](../packages/code/)       | `format-code.ts` (fence hygiene plus Biome's JavaScript API using the root `biome.json`), `highlight.ts` (Shiki tokens mapped to utility classes), and `format-html.ts` (a parse5 HTML printer)                                            |
| [packages/embeds](../packages/embeds/)   | `src/*.mjs` renderers for `:::embed` and `:embed[...]`, `src/registry.mjs`, `src/index.mjs`, browser scripts in `client/`, and `src/bundle.mjs` for bundling them with KaTeX and PhotoSwipe assets                                         |
| [packages/demos](../packages/demos/)     | Demo components, runtime helpers, `showcases/*.json`, `registry.js`, `index.js`, `styles.css`, plus `src/render.mjs` for `:::demo` and `src/assets.mjs` for CSS, Poppins fonts, and script bundles                                         |
| [packages/theme](../packages/theme/)     | `styles.css` (Tailwind layers, sources, dark variant, view transitions, fonts, and tokens), `layouts/` with partials, `assets/` (favicons, fonts, portrait), `src/client/theme.ts`, and `src/lib/files.ts`                                 |
| [packages/profile](../packages/profile/) | `profile.json`: author name, profile URL `https://pulkit.page/`, both site domains, and the default social links, merged by the engine's `readSiteConfig` under each site's `_site.md`                                                     |

Packages have no build step of their own. Their exports point straight at source files, and the engine bundles or copies browser code into each app's `dist/` during a build.

## Tooling

[tooling/checks](../tooling/checks/) holds the repository-wide gates run from the root: `src/commands/` (`check-content.ts`, `check-comments.ts`, `check-em-dashes.ts`, `check-imports.ts`, `check-repository.ts`), the reusable scanners and validators in `src/lib/`, their tests (including the policy CI and pre-commit tests), and `install-hooks.sh`, which the root `postinstall` script runs. Its [turbo.json](../tooling/checks/turbo.json) widens the inputs of its `test` task to `.github/`, `.githooks/`, and the root and workspace manifests, because those tests assert facts about them.

[tooling/lighthouse](../tooling/lighthouse/) holds the Lighthouse runner: `src/commands/lighthouse.ts` discovers each app from its `CNAME`, previews its `dist/` (or reads the production sitemap with `--prod`), and distributes page audits across forked `src/commands/worker.ts` processes, each with its own headless Chrome. Every run writes its own folder under the ignored `reports/lighthouse/`. [tooling/benchmarks/benchmark-dev.py](../tooling/benchmarks/benchmark-dev.py) is the development server benchmark runner described in [development benchmarks](development-benchmarks.md).

## Outputs and deployment files

No generated output is committed. Each `apps/<app>/dist/` is ignored build output: `apps/page/dist/` holds 39 generated files (12 HTML pages, 12 social-card PNGs, 12 Markdown copies, `llms.txt`, `sitemap.xml`, and `robots.txt`); `apps/blog/dist/` holds 166 (54 HTML pages, 54 social-card PNGs, 54 Markdown copies, `llms.txt`, `sitemap.xml`, `robots.txt`, and `feed.xml`). Both also contain the shared theme assets (fonts, favicons, portrait) overlaid by the app's assets, `favicon.ico`, the embed bundles with the PhotoSwipe stylesheet and the KaTeX stylesheet and fonts, the fingerprinted stylesheet and theme script, and CNAME for production builds. Only a site with a demo directive gets the demo bundle, so it is built for pulkit.blog and skipped for pulkit.page. Build clears deployment files while preserving `dist/dev-<port>/`. Do not edit files in `dist/` or store authored assets there. Vite development renders requested pages in memory. Render caches live in `apps/<app>/.cache/generate/`, development bundles in `apps/<app>/.cache/demos-dev/` and `apps/<app>/.cache/embeds-dev/`, Turbo's task cache in the root `.turbo/`, and Lighthouse output in the root `reports/`; all of them are ignored and disposable.

Root-relative URLs assume deployment at the domain root; there is no configurable project-site base path. Repository files describe intended deployment, not proof that remote DNS or Pages settings are correct.

## Root configuration

| Path                                                      | Role                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| [package.json](../package.json)                           | Workspaces, root Turbo commands, repository gates, `postinstall`           |
| [turbo.json](../turbo.json)                               | Task graph, `transit` invalidation, cache outputs, `verify` aggregate      |
| [biome.json](../biome.json)                               | Formatting, lint rules, exclusions, CLI exceptions                         |
| [knip.json](../knip.json)                                 | Per-workspace entry points and project files for dead-code checks          |
| [.htmlvalidate.json](../.htmlvalidate.json)               | Recommended HTML rules plus local policy                                   |
| [.github/workflows/ci.yml](../.github/workflows/ci.yml)   | Verify, browser smoke, workflow checks, the CI gate, and both deploys      |
| [.githooks/pre-commit](../.githooks/pre-commit)           | Validate the staged snapshot in a temporary repository                     |
| [.gitignore](../.gitignore)                               | Ignore `node_modules`, `dist`, `extras/`, `.cache/`, `.turbo/`, `reports/` |
| [.github/actionlint.yaml](../.github/actionlint.yaml)     | Registers the `ubuntu-26.04` runner label for actionlint                   |
| [apps/page/turbo.json](../apps/page/turbo.json)           | Adds `apps/blog/content` to the portfolio build inputs                     |
| [tooling/checks/turbo.json](../tooling/checks/turbo.json) | Adds workflow, hook and manifest files to the policy test inputs           |
| [bun.lock](../bun.lock)                                   | The locked dependency tree; also an input of the render cache version      |
| [README.md](../README.md)                                 | Front page: layout, quick start, and common commands                       |
| [docs/](./)                                               | This explanation and the historical migration audit                        |

The local `node_modules/` trees are installed tooling, not authoritative source. `extras/pulkitxm.com/` is historical reference, not an alternative active source tree. The [migration explanation](migration-audit.md) covers why the reference and its richer runtime should not be confused with the current site.

## Where to start reading code

Start with the [architecture overview](architecture.md), then read [site-inventory.mjs](../packages/engine/src/site-inventory.mjs) for route discovery and [generate.mjs](../packages/engine/src/generate.mjs) for writing the rendered site, then [render-page.mjs](../packages/engine/src/render-page.mjs) for Markdown and metadata behavior. Next, [layouts.mjs](../packages/engine/src/layouts.mjs) explains template substitution, and [build.mjs](../packages/engine/src/build.mjs) shows rendering into `dist/` followed by asset copying. [cli.mjs](../packages/engine/src/cli.mjs) maps each `site` subcommand to its module. The [rendering flow](rendering-flow.md) connects these functions using real examples.

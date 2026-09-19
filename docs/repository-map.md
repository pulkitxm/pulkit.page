# Guided repository map

[Documentation index](index.md)

## Workspace tree

The repository is a Bun workspace driven by Turborepo. The root [package.json](../package.json) declares three workspace globs: `apps/*`, `packages/*`, and `tooling/*`. Every workspace is private and depends on its siblings through `workspace:*` versions.

```text
apps/page/            @pulkit/page     the pulkit.page portfolio
apps/blog/            @pulkit/blog     the pulkit.blog writing
packages/engine/      @pulkit/engine   static site generator and `site` CLI
packages/code/        @pulkit/code     syntax highlighting and Biome formatting
packages/embeds/      @pulkit/embeds   Markdown embeds and their browser scripts
packages/demos/       @pulkit/demos    interactive motion demos
packages/theme/       @pulkit/theme    shared stylesheet, layouts, assets, theme script
packages/profile/     @pulkit/profile  shared author, profile URL, domains, social links
tooling/checks/       @pulkit/checks   repository-wide gates and hook installer
tooling/benchmarks/                    development server benchmark runner
docs/                                  these guides and the migration audit
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

| Package                                  | Contents                                                                                                                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [packages/engine](../packages/engine/)   | `src/cli.mjs` (the `site` bin), inventory, rendering, layouts, generation, build, Vite development server, preview, SEO, social cards, render cache, origin resolution, post-build checks, and their tests |
| [packages/code](../packages/code/)       | `format-code.mjs`, `format-html.mjs`, and `highlight.mjs`: Biome formatting with the root `biome.json` and Shiki highlighting                                                                              |
| [packages/embeds](../packages/embeds/)   | `src/*.mjs` renderers for `:::embed` and `:embed[...]`, `src/registry.mjs`, `src/index.mjs`, browser scripts in `client/`, and `src/bundle.mjs` for bundling them with KaTeX and PhotoSwipe assets         |
| [packages/demos](../packages/demos/)     | Demo components, runtime helpers, `showcases/*.json`, `registry.js`, `index.js`, `styles.css`, plus `src/render.mjs` for `:::demo` and `src/assets.mjs` for CSS, Poppins fonts, and script bundles         |
| [packages/theme](../packages/theme/)     | `styles.css` (Tailwind layers, sources, dark variant, view transitions, fonts, and tokens), `layouts/` with partials, `assets/` (favicons, fonts, portrait), `theme.js`, and `src/files.mjs`               |
| [packages/profile](../packages/profile/) | `profile.json`: author name, profile URL `https://pulkit.page/`, both site domains, and the default social links, merged by the engine's `readSiteConfig` under each site's `_site.md`                     |

Packages have no build step of their own. Their exports point straight at source files, and the engine bundles or copies browser code into each app's `dist/` during a build.

## Tooling

[tooling/checks](../tooling/checks/) holds the repository-wide gates run from the root: `check-content.mjs`, `check-comments.mjs`, `check-em-dashes.mjs`, `check-imports.mjs`, `check-repository.mjs`, the shared `repository-files.mjs`, their tests (including the policy CI and pre-commit tests), and `install-hooks.sh`, which the root `postinstall` script runs. [tooling/benchmarks/benchmark-dev.py](../tooling/benchmarks/benchmark-dev.py) is the development server benchmark runner described in [development benchmarks](development-benchmarks.md).

## Outputs and deployment files

No generated output is committed. Each `apps/<app>/dist/` is ignored build output: `apps/page/dist/` holds 12 HTML pages, 12 social-card PNGs, 12 Markdown copies, `llms.txt`, `sitemap.xml`, and `robots.txt`; `apps/blog/dist/` holds 54 HTML pages, 54 social-card PNGs, 54 Markdown copies, `llms.txt`, `sitemap.xml`, `robots.txt`, and `feed.xml`. Both also contain the shared theme assets (fonts, favicons, portrait) overlaid by the app's assets, `favicon.ico`, embed bundles, the fingerprinted stylesheet and theme script, and CNAME for production builds. Only a site with a demo directive gets the demo bundle, so it is built for pulkit.blog and skipped for pulkit.page. Build clears deployment files while preserving `dist/dev-<port>/`. Do not edit files in `dist/` or store authored assets there. Vite development renders requested pages in memory. Render caches live in `apps/<app>/.cache/generate/`, and Turbo's task cache lives in the root `.turbo/`; both are ignored and disposable.

Root-relative URLs assume deployment at the domain root; there is no configurable project-site base path. Repository files describe intended deployment, not proof that remote DNS or Pages settings are correct.

## Root configuration

| Path                                                            | Role                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| [package.json](../package.json)                                 | Workspaces, root Turbo commands, repository gates, `postinstall`      |
| [turbo.json](../turbo.json)                                     | Task graph, `transit` invalidation, cache outputs, `verify` aggregate |
| [biome.json](../biome.json)                                     | Formatting, lint rules, exclusions, CLI exceptions                    |
| [knip.json](../knip.json)                                       | Per-workspace entry points and project files for dead-code checks     |
| [.htmlvalidate.json](../.htmlvalidate.json)                     | Recommended HTML rules plus local policy                              |
| [.github/workflows/ci.yml](../.github/workflows/ci.yml)         | Verify, browser smoke, workflow checks, and the CI gate               |
| [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) | Deploys both sites from a successful CI run on main                   |
| [.githooks/pre-commit](../.githooks/pre-commit)                 | Validate the staged snapshot in a temporary repository                |
| [.gitignore](../.gitignore)                                     | Ignore `node_modules`, `dist`, `extras/`, `.cache/`, and `.turbo/`    |
| [README.md](../README.md)                                       | Front page: layout, quick start, and common commands                  |
| [docs/](./)                                                     | This explanation and the historical migration audit                   |

The local `node_modules/` trees are installed tooling, not authoritative source. `extras/pulkitxm.com/` is historical reference, not an alternative active source tree. The [migration explanation](migration-audit.md) covers why the reference and its richer runtime should not be confused with the current site.

## Where to start reading code

Read [site-inventory.mjs](../packages/engine/src/site-inventory.mjs) for route discovery and [generate.mjs](../packages/engine/src/generate.mjs) for writing the rendered site, then [render-page.mjs](../packages/engine/src/render-page.mjs) for Markdown and metadata behavior. Next, [layouts.mjs](../packages/engine/src/layouts.mjs) explains template substitution, and [build.mjs](../packages/engine/src/build.mjs) shows rendering into `dist/` followed by asset copying. [cli.mjs](../packages/engine/src/cli.mjs) maps each `site` subcommand to its module. The [rendering flow](rendering-flow.md) connects these functions using real examples.

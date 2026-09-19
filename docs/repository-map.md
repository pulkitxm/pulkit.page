# Guided repository map

[Documentation index](index.md)

## Workspace tree

The repository is a Bun workspace driven by Turborepo. The root [package.json](../package.json) declares three workspace globs: `apps/*`, `packages/*`, and `tooling/*`. Every workspace is private and depends on its siblings through `workspace:*` versions.

```text
apps/page/            @pulkit/page     the pulkit.page site
packages/engine/      @pulkit/engine   static site generator and `site` CLI
packages/code/        @pulkit/code     syntax highlighting and Biome formatting
packages/embeds/      @pulkit/embeds   Markdown embeds and their browser scripts
packages/demos/       @pulkit/demos    interactive motion demos
packages/theme/       @pulkit/theme    Tailwind base, theme script, fonts, icons
tooling/checks/       @pulkit/checks   repository-wide gates and hook installer
tooling/benchmarks/                    development server benchmark runner
docs/                                  these guides and the migration audit
```

## The site app

| Path                                                         | Responsibility                                                   | How to maintain it                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------- |
| [apps/page/content/](../apps/page/content/)                  | 66 page sources plus `_site.md` shared configuration             | Edit Markdown/frontmatter here           |
| [apps/page/content/\_site.md](../apps/page/content/_site.md) | Brand, description fallback, navigation, social links, copyright | Edits change every rendered page         |
| [apps/page/layouts/](../apps/page/layouts/)                  | `home`, `simple`, `article` HTML shells and shared partials      | Edit templates, validate, rebuild        |
| [apps/page/styles.css](../apps/page/styles.css)              | Imports the shared base, defines fonts and color tokens          | Compiled and minified into `dist/`       |
| [apps/page/assets/](../apps/page/assets/)                    | Article and experience images, portrait, and résumé PDF          | Refer to public root-relative `/assets/` |
| [apps/page/CNAME](../apps/page/CNAME)                        | Production hostname                                              | Change only when the domain changes      |
| [apps/page/package.json](../apps/page/package.json)          | App scripts that call the `site` CLI                             | Add app tasks here and in `turbo.json`   |

App scripts (`dev`, `build`, `start`, `clean`, `check:layouts`, `check:seo`, `check:site`, `check:html`, `check:browser`) run with `apps/page` as the working directory, so every relative path the engine uses (`content/`, `layouts/`, `assets/`, `styles.css`, `CNAME`, `dist/`, `.cache/`) resolves inside the app.

## Packages

| Package                                | Contents                                                                                                                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [packages/engine](../packages/engine/) | `src/cli.mjs` (the `site` bin), inventory, rendering, layouts, generation, build, Vite development server, preview, SEO, social cards, render cache, origin resolution, post-build checks, and their tests |
| [packages/code](../packages/code/)     | `format-code.mjs`, `format-html.mjs`, and `highlight.mjs`: Biome formatting with the root `biome.json` and Shiki highlighting                                                                              |
| [packages/embeds](../packages/embeds/) | `src/*.mjs` renderers for `:::embed` and `:embed[...]`, `src/registry.mjs`, `src/index.mjs`, browser scripts in `client/`, and `src/bundle.mjs` for bundling them with KaTeX and PhotoSwipe assets         |
| [packages/demos](../packages/demos/)   | Demo components, runtime helpers, `showcases/*.json`, `registry.js`, `index.js`, `styles.css`, plus `src/render.mjs` for `:::demo` and `src/assets.mjs` for CSS, Poppins fonts, and script bundles         |
| [packages/theme](../packages/theme/)   | `base.css` (Tailwind layers, sources, dark variant, view transitions), `theme.js` (theme toggle and carousel), `fonts/`, and `icons/`                                                                      |

Packages have no build step of their own. Their exports point straight at source files, and the engine bundles or copies browser code into each app's `dist/` during a build.

## Tooling

[tooling/checks](../tooling/checks/) holds the repository-wide gates run from the root: `check-content.mjs`, `check-comments.mjs`, `check-em-dashes.mjs`, `check-imports.mjs`, `check-repository.mjs`, the shared `repository-files.mjs`, their tests (including the policy CI and pre-commit tests), and `install-hooks.sh`, which the root `postinstall` script runs. [tooling/benchmarks/benchmark-dev.py](../tooling/benchmarks/benchmark-dev.py) is the development server benchmark runner described in [development benchmarks](development-benchmarks.md).

## Outputs and deployment files

No generated output is committed. `apps/page/dist/` is ignored build output: 66 HTML pages, 66 social-card PNGs, `sitemap.xml`, and `robots.txt`, plus copied assets, theme fonts and icons, demo and embed bundles, the fingerprinted stylesheet and theme script, and CNAME for production builds. Build clears deployment files while preserving `dist/dev-<port>/`. Do not edit files in `dist/` or store authored assets there. Vite development renders requested pages in memory. Render caches live in `apps/page/.cache/generate/`, and Turbo's task cache lives in the root `.turbo/`; both are ignored and disposable.

Root-relative URLs assume deployment at the domain root; there is no configurable project-site base path. Repository files describe intended deployment, not proof that remote DNS or Pages settings are correct.

## Root configuration

| Path                                                    | Role                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| [package.json](../package.json)                         | Workspaces, root Turbo commands, repository gates, `postinstall`      |
| [turbo.json](../turbo.json)                             | Task graph, `transit` invalidation, cache outputs, `verify` aggregate |
| [biome.json](../biome.json)                             | Formatting, lint rules, exclusions, CLI exceptions                    |
| [knip.json](../knip.json)                               | Per-workspace entry points and project files for dead-code checks     |
| [.htmlvalidate.json](../.htmlvalidate.json)             | Recommended HTML rules plus local policy                              |
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | Verify, browser smoke, workflow checks, gate, Pages deployment        |
| [.githooks/pre-commit](../.githooks/pre-commit)         | Validate the staged snapshot in a temporary repository                |
| [.gitignore](../.gitignore)                             | Ignore `node_modules`, `dist`, `extras/`, `.cache/`, and `.turbo/`    |
| [README.md](../README.md)                               | Front page: layout, quick start, and common commands                  |
| [docs/](./)                                             | This explanation and the historical migration audit                   |

The local `node_modules/` trees are installed tooling, not authoritative source. `extras/pulkitxm.com/` is historical reference, not an alternative active source tree. The [migration explanation](migration-audit.md) covers why the reference and its richer runtime should not be confused with the current site.

## Where to start reading code

Read [site-inventory.mjs](../packages/engine/src/site-inventory.mjs) for route discovery and [generate.mjs](../packages/engine/src/generate.mjs) for writing the rendered site, then [render-page.mjs](../packages/engine/src/render-page.mjs) for Markdown and metadata behavior. Next, [layouts.mjs](../packages/engine/src/layouts.mjs) explains template substitution, and [build.mjs](../packages/engine/src/build.mjs) shows rendering into `dist/` followed by asset copying. [cli.mjs](../packages/engine/src/cli.mjs) maps each `site` subcommand to its module. The [rendering flow](rendering-flow.md) connects these functions using real examples.

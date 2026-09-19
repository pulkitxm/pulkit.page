# Maintenance, findings, and snapshot

[Documentation index](index.md) · [Architecture](architecture.md)

## Current inspection scope

This refresh describes the repository as the code stands now. The earlier history is summarized here because the guides used to be written against it: the single static site became Bun and Turborepo workspaces, with the site in `apps/page`, the generator in `packages/engine`, formatting and highlighting in `packages/code`, embeds in `packages/embeds`, demos in `packages/demos`, the shared theme in `packages/theme`, and the repository gates in `tooling/checks`. The one-time MDX importer, the custom `ci.mjs` runner (replaced by Turbo's `verify` task), and the root `.nojekyll` were removed. The image popup script moved from `assets/image-popup.js` to `packages/embeds/client/components/image-popup.ts` and is served from `/assets/embeds/image-popup.js`.

A later change split the writing into its own site. Every post, its images, and the demo usage moved from `apps/page` to the new `apps/blog` app, which publishes to pulkit.blog with posts at root routes (`/blogs/git-worktrees/` became `/git-worktrees/`). pulkit.page no longer has a `/blogs/` archive; its Writing navigation and home paragraph link to `https://pulkit.blog/`. The engine gained the optional `articles` field, the `all` collection and `by-year` grouping for lists, article meta lines, and the Atom feed, and author and social details moved to the shared `packages/profile`.

pulkit.page has 13 content Markdown files, 12 public pages, and 61 tracked app assets, and its build renders 39 files (12 HTML, 12 PNG cards, 12 Markdown copies, `llms.txt`, sitemap, robots) into `apps/page/dist/`. pulkit.blog has 55 content Markdown files, 54 public pages, and 198 tracked app assets, and its build renders 166 files (54 HTML, 54 PNG cards, 54 Markdown copies, `llms.txt`, sitemap, robots, feed) into `apps/blog/dist/`. None of the generated files are committed. The historical migration audit still records 58 imported sources and 197 copied assets.

Changes since that split that these documents now describe: both sites take one theme, one layout set and one shared asset folder from `packages/theme`; `packages/shared` holds the HTML escaping helper and the built-site walkers that the engine, embeds, code package, checks and Lighthouse runner reuse; generated HTML is printed by a parse5 formatter in `packages/code` instead of repeated Biome passes; every page is also published as Markdown with an `llms.txt` index; every code block has a sticky copy button; the carousel, lightbox and demo scripts load only on pages that use them; `tooling/lighthouse` reports on both sites in parallel; and the two deploy jobs moved into the CI workflow so both deployments appear in the run graph that approved them.

Live DNS, deployed Pages configuration, external links, and tutorial factual freshness were not independently verified.

## Daily editing

```sh
bun install
bun run dev
```

Use the printed URLs: with PORT unset, pulkit.page starts at 3000 and pulkit.blog starts at 3001 (its `dev` script sets `SITE_PORT=3001`), and each walks to higher ports until one binds. PORT requests a specific port; PORT=0 requests an available one. To run only one site, use `bunx turbo run dev --filter=@pulkit/page` or `--filter=@pulkit/blog`.

```sh
bun run format
bun run ci
```

Format is repository-wide and may fix code as well as layout. Review its diff in a shared checkout. For page edits, commit only the Markdown and any assets or templates; there is no generated output to stage, and the staged-snapshot hook builds and checks the site from the staged sources. Turbo replays unchanged tasks from `.turbo/cache`, so repeated runs of `bun run ci` are fast when little changed.

After a page rename/removal, update inbound links; the next build clears the app's `dist/`, so the old route disappears. There is no automatic redirect for an old route. Empty collections throw, so removing their last detail page also requires changing the collection directive.

## Production and preview builds

```sh
bun run serve
```

A default build uses the HTTPS origin in each app's CNAME: `apps/page/CNAME` for pulkit.page and `apps/blog/CNAME` for pulkit.blog. `bun run serve` builds when needed and then previews `dist/` on loopback. To generate matching preview metadata and validate it:

```sh
NODE_ENV=staging SITE_URL=https://preview.example.com bun run build
NODE_ENV=staging SITE_URL=https://preview.example.com bunx turbo run check:seo --filter=@pulkit/page
```

Use [SEO and environments](seo-and-environments.md) for URL constraints and CNAME inclusion. Changing production CNAME takes effect on the next production build; no committed output needs updating. `bun run clean` removes each app's output and caches when a cold build is needed.

## Troubleshooting

| Symptom                                | Cause or diagnostic                                                    | Action                                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Unknown metadata field url             | Origin is not configured in frontmatter                                | Use CNAME or SITE\_URL                                                                        |
| SEO canonical mismatch                 | Validator environment differs from build environment                   | Supply the same NODE\_ENV and SITE\_URL                                                       |
| Hook fails despite local fixes         | Correct sources are only unstaged                                      | Review the index and stage matching intended versions                                         |
| Post code comment considered forbidden | File is outside `apps/<app>/content/`, so the exception does not apply | Keep posts under an app's `content/`; inspect path-specific scanText behavior                 |
| Unknown fence language in docs         | Scanner cannot classify that language                                  | Use appropriate supported syntax or deliberately extend policy; do not strip article comments |
| Dev displays old content               | Rendering failed or browser not refreshed                              | Inspect logs, correct input, refresh; restart for server changes                              |
| Package edit not reflected in a build  | Stale local cache suspected                                            | Run `bun run clean`, then build again; package sources are Turbo and render cache inputs      |
| External demo/certificate broken       | Remote host changed                                                    | Verify and update authored link manually                                                      |

## Known limits and recommendations

The development server no longer writes HTML into `dist/` at all: it renders in memory and stores cache entries under the app's `.cache/generate/`, keyed by a `dist/dev-<port>` identity string that is never created on disk. The reservation of `dist/dev-<port>/` roots therefore survives only as insurance: build cleanup preserves them, the built-site walkers skip them, and route discovery rejects them, but nothing writes them. A build and a development server can run in the same checkout without interfering.

Preview origins are isolated, but robots still allows indexing. Public preview protection needs a deliberate policy; no noindex mode is implemented. Social-card wrapping retains text but has no bounds/visual-fit test. Long titles should be visually checked. SEO validation confirms selected local relationships, not search-engine acceptance or remote availability.

Tags influence related writing and JSON-LD, not tag archives. Dates sort and supply publication metadata; they do not schedule publication or establish modification time. Draft is not supported. Collection discovery, related scores, and JSON-LD collection ordering use different documented tie-break rules. localeCompare has no explicit locale, so runtime differences warrant investigation if ordering differs between machines.

Both sites' browser CSS uses the Comic Relief web font with system fallbacks; card rendering uses a bundled IBM Plex Mono TTF. Every file in `packages/theme/assets/` is copied into each site even when unused by browser CSS, including that TTF. Knip checks code/dependency reachability, not source-asset or Markdown garbage collection. No source-image compression, redirects (including from the old pulkit.page `/blogs/` routes), feed validation, browser visual regression, or external-link monitor is implemented. The deploy jobs in the [CI workflow](../.github/workflows/ci.yml) publish both sites; see [deployment](deployment.md).

The [benchmark runner](../tooling/benchmarks/benchmark-dev.py) takes an app directory such as `apps/page` or `apps/blog` and drives it with the engine CLI. The [Lighthouse runner](../tooling/lighthouse/src/commands/lighthouse.ts) reports category scores and failing audits per page, but only a page whose audit hits a runtime error fails the command, so low scores need reading rather than waiting for a nonzero exit.

Local development and CI both use Bun 1.4.2. Keep the historical audit unchanged; record new migration decisions separately. Preserve comments in post code examples: Markdown under any `apps/<app>/content/` is explicitly exempt from comment stripping, while the separate em-dash rule still applies to their text.

## Verification record

This refresh reread every workspace manifest, the root and per-workspace `turbo.json` files, `biome.json`, `knip.json`, `.htmlvalidate.json`, the pre-commit hook and its installer, the CI workflow, and the sources of every package and tool, then corrected every path, command, module and count in these documents against them. Both sites were built and `bun run ci` was run, which covers the tests, both builds, the layout and post-build checks, and the repository gates; the file counts above come from that build. Documentation relative links and anchors were checked with a throwaway script, since no repository gate inspects them, so they should be rechecked when files move. The browser smoke job, the GitHub actionlint, zizmor, gitleaks and audit jobs, a Lighthouse run, and a live deployment were not run here.

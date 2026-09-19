# Maintenance, findings, and snapshot

[Documentation index](index.md)

## Current inspection scope

This refresh inspected merged commit `d0e897b` on September 18, 2026. The checkout was clean at the start, and the interrupted documentation edits carried over when the folder moved. Its current location is `/Volumes/sandisk-apfs/codingAndFun/samaan/pulkit.page-worktrees/pulkit.page`. Relative documentation links continue to work after the move; shell commands below run from that root.

The current project has 67 content Markdown files, 66 public pages, 204 source assets, and 201 committed generated files (66 HTML, 66 PNG cards, 66 Markdown copies, llms.txt, sitemap, robots). The historical migration audit still records 58 imported sources and 197 copied assets. The previous guides described pre-SEO behavior; this refresh incorporates the merged metadata, cards, environment isolation, policy enforcement, and restored article-code comments.

Documentation is the only intended tracked change in this refresh. No article examples, application scripts, dependency files, generated production output, or audit data are edited to make the explanation fit. Live DNS, deployed Pages configuration, external links, and tutorial factual freshness were not independently verified.

## Daily editing

```sh
bun install
bun run dev
```

Use the printed URL: unset PORT walks 3000, 3001, 3002, and so on until a port binds. PORT=3001 requests a specific port; PORT=0 requests an available one. Preview output is isolated under dist and does not refresh production pages.

```sh
bun run format
bun run generate
bun run ci
```

Format is repository-wide and may fix code as well as layout. Review its diff in a shared checkout. For documentation-only changes, use scoped formatting and do not regenerate production pages unnecessarily. For page edits, stage source and all affected generated HTML/cards/crawler files together; the staged-snapshot hook checks the committed relationship.

```sh
bun run generate --clean
bun run check:generated
```

Use clean after page rename/removal, then review removed output and update inbound links. There is no automatic redirect for an old route. Empty collections throw, so removing their last detail page also requires changing the collection directive.

## Production and preview builds

```sh
bun run build
python3 -m http.server 4173 --directory dist
```

A default build uses the HTTPS origin in CNAME. To generate matching preview metadata and validate it:

```sh
NODE_ENV=staging SITE_URL=https://preview.example.com bun run build
NODE_ENV=staging SITE_URL=https://preview.example.com bun run check:seo
```

Use [SEO and environments](seo-and-environments.md) for URL constraints and CNAME inclusion. Changing production CNAME requires regenerating committed HTML, cards, sitemap, and robots before any build can pass its production prerequisite.

## Troubleshooting

| Symptom                                      | Cause or diagnostic                                                 | Action                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Missing/stale HTML, PNG, sitemap or robots   | Inputs/origin/font differ from generation                           | Generate in the intended environment, inspect all output differences                          |
| Extra generated asset                        | The selected output tree contains a file the generator does not own | Review it; clean only the intended generated directory                                        |
| Extra dev HTML during build                  | Active preview recreates a subdirectory while build renders dist    | Avoid concurrent build and preview in the same checkout; restart preview after build          |
| Unknown metadata field url                   | Origin is not configured in frontmatter                             | Use CNAME or SITE\_URL                                                                        |
| Environment-specific output cannot use pages | Preview flags target committed production output                    | Use dist or a valid nested dist directory                                                     |
| Standalone development PORT=0 fails          | No running server has resolved an actual port                       | Use dev command or an explicit SITE\_URL/resolved port                                        |
| SEO canonical mismatch                       | Validator environment differs from build environment                | Supply the same NODE\_ENV and SITE\_URL                                                       |
| Hook fails despite local fixes               | Correct sources/outputs are only unstaged                           | Review the index and stage matching intended versions                                         |
| Article code comment considered forbidden    | File location or scanner entry point bypasses article exception     | Preserve article examples; inspect path-specific scanText behavior                            |
| Unknown fence language in docs               | Scanner cannot classify that language                               | Use appropriate supported syntax or deliberately extend policy; do not strip article comments |
| Dev displays old content                     | Regeneration failed or browser not refreshed                        | Inspect logs, correct input, refresh; restart for server changes                              |
| External demo/certificate broken             | Remote host changed                                                 | Verify and update authored link manually                                                      |

## Known limits and recommendations

Build now preserves reserved `dist/dev-<port>/` roots while replacing deployment files. Generation and deployment reference validation exclude these local preview roots. The earlier shared-build race described in this audit is addressed by that separation; development servers no longer need to stop for production assembly.

Preview origins are isolated, but robots still allows indexing. Public preview protection needs a deliberate policy; no noindex mode is implemented. Social-card wrapping retains text but has no bounds/visual-fit test. Long titles should be visually checked. SEO validation confirms selected local relationships, not search-engine acceptance or remote availability.

Tags influence related writing and JSON-LD, not tag archives. Dates sort and supply publication metadata; they do not schedule publication or establish modification time. Draft is not supported. Collection discovery, related scores, and JSON-LD collection ordering use different documented tie-break rules. localeCompare has no explicit locale, so runtime differences warrant investigation if exact sync differs.

Browser CSS uses system fonts; card rendering uses a bundled TTF. Other font assets are copied even when unused by browser CSS. Knip checks code/dependency reachability, not source-asset or Markdown garbage collection. No source-image compression, redirects, RSS/Atom, browser visual regression, or external-link monitor is implemented.

Local development and CI both use Bun 1.4.2. Keep the historical audit unchanged; record new migration decisions separately. Preserve comments in historical article examples: they are explicitly exempt from comment stripping, while the separate em-dash rule still applies to their text.

## Verification record

The refresh reread generation, rendering, SEO/card construction, environment selection, dev serving, build, checks, policies, tests, layouts, styles, workflow, content metadata, and generated inventories. The article catalog was refreshed from current metadata. Documentation formatting and relative links are checked separately because the deployment checker does not inspect documentation links. Final results are recorded after validation; a failure in an earlier run is not treated as a passed check.

The refreshed snapshot passed all 15 local CI checks and 85 tests with zero failures, including exact generated sync, build, local links, Knip, text policies, imports, shell syntax, and SEO validation for all 66 pages. Validation ran in a disposable copy with installed dependencies linked in, avoiding the active development output conflict; it did not create a branch or Git worktree. The temporary copy was removed afterward. The separate GitHub actionlint/zizmor job and a live deployment were not run.

Scoped validation covers 13 Markdown documents (README plus 12 guides) and 216 relative links. The only tracked changes from this refresh are documentation. These results describe the inspected commit plus the refreshed guides, not a claim about later application edits.

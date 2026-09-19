# Understanding pulkit.page

This is a static publishing system for two sites, organized as a Bun and Turborepo monorepo: the pulkit.page portfolio lives in `apps/page`, and the pulkit.blog writing lives in `apps/blog`. Reusable pieces live in workspace packages: the generator in `packages/engine`, the shared look in `packages/theme`, small shared helpers in `packages/shared`, code formatting and highlighting in `packages/code`, Markdown embeds in `packages/embeds`, interactive demos in `packages/demos`, and the shared author profile in `packages/profile`. Repository-wide gates live in `tooling/checks`, with Lighthouse reporting in `tooling/lighthouse` and a development server benchmark in `tooling/benchmarks`. Markdown defines the pages. Nothing generated is committed; a build renders HTML, social cards, Markdown copies, `llms.txt`, sitemap, robots, and (for pulkit.blog) an Atom feed into each app's `dist/` for the production or a preview origin. Visitors need no application server or JavaScript framework; site JavaScript is limited to the theme toggle and view transitions, carousels, code copy buttons, embeds, and demos.

## Suggested reading order

1. [Architecture](architecture.md): how the workspaces fit together, how a Markdown file becomes a page in a build and in development, what is cached, and the Turborepo task graph.
2. [Repository map](repository-map.md): the workspace tree, which files you edit, which are generated, and which are historical.
3. [Scripts and commands](scripts-and-commands.md): root and app scripts, Turbo tasks, modules, checks, hooks, and workflows.
4. [Authoring guide](authoring-guide.md): schema, syntax, embeds, demos, layouts, appearance, and safe editing recipes.
5. [Content inventory](content-inventory.md): all page types on both sites, portfolio pages, experience, posts, metadata, and the linked article catalog.
6. [Article catalog](article-catalog.md): every pulkit.blog post, its route, date, subject, and tags.
7. [Rendering and deployment flow](rendering-flow.md): follow an actual page from Markdown to GitHub Pages across the package boundaries.
8. [Continuous integration](continuous-integration.md): the workflow jobs, the concurrency model, the CI gate, and the pre-commit hook.
9. [Deployment](deployment.md): how both sites reach GitHub Pages, and the one-time setup for pulkit.blog.
10. [Quality checks and limits](quality-checks.md): what validation proves and what it misses.
11. [Repository policies](repository-policies.md): the no-comments, no-em-dash, formatting, dead-code, and contribution rules.
12. [SEO and environments](seo-and-environments.md): metadata, cards, origin selection, preview isolation, and validation.
13. [Development benchmarks](development-benchmarks.md): request-time rendering measurements and a reproducible runner.
14. [Maintenance and snapshot](maintenance-and-snapshot.md): findings, troubleshooting, and suggested improvements.
15. [Migration audit explained](migration-audit.md): what `content-migration.json` means and why it is not a manifest.

## Scope of this explanation

These documents describe the current implemented behavior of the checked-in code, not an earlier migration snapshot. Local development and GitHub Actions both use Bun 1.4.2. The validation record is in [maintenance and snapshot](maintenance-and-snapshot.md).

Canonical URLs, Open Graph and Twitter metadata, JSON-LD, social-card PNGs, Markdown copies of every page, `llms.txt`, sitemap, breadcrumbs, related writing, and an Atom feed for sites with articles are implemented. Production uses each app's CNAME; development and custom environments use their resolved origin. See [SEO and environments](seo-and-environments.md) for the complete behavior and limitations.

Documentation is repository material and is not copied into the published website. All explanations concern checked code and local content, not a verification of live DNS, deployed GitHub settings, external services, or the technical accuracy of every tutorial.

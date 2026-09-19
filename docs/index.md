# Understanding pulkit.page

This is a static publishing system for two sites, organized as a Bun and Turborepo monorepo: the pulkit.page portfolio lives in `apps/page`, and the pulkit.blog writing lives in `apps/blog`. Reusable pieces live in workspace packages: the generator in `packages/engine`, code formatting and highlighting in `packages/code`, Markdown embeds in `packages/embeds`, interactive demos in `packages/demos`, the shared theme in `packages/theme`, and the shared author profile in `packages/profile`. Repository-wide gates live in `tooling/checks`. Markdown defines the pages. Nothing generated is committed; a build renders HTML, social cards, sitemap, robots, and (for pulkit.blog) an Atom feed into each app's `dist/` for the production or a preview origin. Visitors need no application server or JavaScript framework; site JavaScript is limited to the theme toggle, carousels, embeds, and demos.

## Suggested reading order

1. [Repository map](repository-map.md): the workspace tree, which files you edit, which are generated, and which are historical.
2. [Scripts and commands](scripts-and-commands.md): root and app scripts, Turbo tasks, modules, checks, hooks, and workflows.
3. [Authoring guide](authoring-guide.md): schema, syntax, embeds, demos, layouts, appearance, and safe editing recipes.
4. [Content inventory](content-inventory.md): all page types on both sites, portfolio pages, experience, posts, metadata, and the linked article catalog.
5. [Article catalog](article-catalog.md): every pulkit.blog post, its route, date, subject, and tags.
6. [Rendering and deployment flow](rendering-flow.md): follow an actual page from Markdown to its Vercel deployment across the package boundaries.
7. [Deployment](deployment.md): how CI deploys both sites to Vercel, and the one-time project and domain setup.
8. [Quality checks and limits](quality-checks.md): what validation proves and what it misses.
9. [SEO and environments](seo-and-environments.md): metadata, cards, origin selection, preview isolation, and validation.
10. [Development benchmarks](development-benchmarks.md): request-time rendering measurements and a reproducible runner.
11. [Maintenance and snapshot](maintenance-and-snapshot.md): findings, troubleshooting, and suggested improvements.
12. [Migration audit explained](migration-audit.md): what `content-migration.json` means and why it is not a manifest.

## Scope of this explanation

This explanation describes the repository after its conversion from a single static site into Turborepo workspaces. It describes current implemented behavior, not the earlier migration-only snapshot. Local development and GitHub Actions both use Bun 1.4.2. The validation record is in [maintenance and snapshot](maintenance-and-snapshot.md).

Canonical URLs, Open Graph and Twitter metadata, JSON-LD, social-card PNGs, sitemap, breadcrumbs, related writing, and an Atom feed for sites with articles are implemented. Production uses each app's CNAME; development and custom environments use their resolved origin. See [SEO and environments](seo-and-environments.md) for the complete behavior and limitations.

Documentation is repository material and is not copied into the published website. All explanations concern checked code and local content, not a verification of live DNS, deployed GitHub settings, external services, or the technical accuracy of every tutorial.

## Repository policies

See [repository text and dead-code policies](repository-policies.md) for the current no-comments, no-em-dash, and Knip checks.

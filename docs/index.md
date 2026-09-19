# Understanding pulkit.page

This is a static publishing system for a portfolio and a substantial writing archive. Markdown defines the pages. Nothing generated is committed; build renders HTML, social cards, sitemap, and robots output into `dist/` for the production or a preview origin. Visitors need no application server or JavaScript framework; the only executable site JavaScript changes the color theme.

## Suggested reading order

1. [Migration audit explained](migration-audit.md): what `content-migration.json` means and why it is not a manifest.
2. [Repository map](repository-map.md): which files you edit, which are generated, and which are historical.
3. [Content inventory](content-inventory.md): all page types, portfolio pages, experience, metadata, and the linked article catalog.
4. [Article catalog](article-catalog.md): every article, its date, subject, and tags.
5. [Rendering and deployment flow](rendering-flow.md): follow an actual page from Markdown to GitHub Pages.
6. [Scripts and commands](scripts-and-commands.md): entry points, dependencies, mutations, checks, hooks, and workflows.
7. [Authoring guide](authoring-guide.md): schema, syntax, layouts, appearance, and safe editing recipes.
8. [Quality checks and limits](quality-checks.md): what validation proves and what it misses.
9. [SEO and environments](seo-and-environments.md): metadata, cards, origin selection, preview isolation, and validation.
10. [Development benchmarks](development-benchmarks.md): request-time rendering measurements and a reproducible runner.
11. [Maintenance and snapshot](maintenance-and-snapshot.md): findings, troubleshooting, and suggested improvements.

## Scope of this explanation

This explanation was refreshed on September 18, 2026 against clean commit `d0e897b` after the SEO, environment handling, and repository policy changes were merged. It describes current implemented behavior, not the earlier migration-only snapshot. Local development and GitHub Actions both use Bun 1.4.2. The validation record is in [maintenance and snapshot](maintenance-and-snapshot.md).

Canonical URLs, Open Graph and Twitter metadata, JSON-LD, social-card PNGs, sitemap, breadcrumbs, and related writing are implemented. Production uses the root CNAME; development and custom environments use their resolved origin in isolated output. See [SEO and environments](seo-and-environments.md) for the complete behavior and limitations.

Documentation is repository material and is not copied into the published website. All explanations concern checked code and local content, not a verification of live DNS, deployed GitHub settings, external services, or the technical accuracy of every tutorial.

## Repository policies

See [repository text and dead-code policies](repository-policies.md) for the current no-comments, no-em-dash, and Knip checks.

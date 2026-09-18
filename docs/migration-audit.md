# The migration audit and reference project

[Documentation index](index.md)

## What the JSON records

[content-migration.json](content-migration.json) is a historical migration audit. It records the conversion of the old site's MDX into ordinary Markdown. It is not a runtime manifest, route registry, asset bundler input, or current synchronization source of truth.

| Field                 | Meaning                                                                                                   | Snapshot evidence                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `pages`               | Old source relative to `extras/pulkitxm.com/content`, new repository output, and original code-node count | 58 mappings: 51 articles, two series indexes, five experience pages  |
| `pages[].codeBlocks`  | Number of original Markdown code AST nodes before component conversion                                    | 628 across the original sources; not a count recomputed during build |
| `assets`              | Sorted unique destination paths copied while converting local images                                      | 197 paths; repeated uses count once                                  |
| `components`          | Occurrences of each encountered MDX JSX element name                                                      | 99 names, 249 occurrences, including ordinary HTML tags              |
| `experienceTreatment` | Editorial note about later treatment of experience content                                                | Full original write-ups; article prose and code preserved            |

For example, `blogs/system-design/caching.mdx` maps to [content/blogs/system-design/caching.md](../content/blogs/system-design/caching.md), with 30 original code blocks. `experiences/magicapi.mdx` maps to [content/experience/magicapi.md](../content/experience/magicapi.md): the plural directory becomes singular. The source field is not relative to `docs/` or the repository root.

The inventory includes 73 `DemoShowcase` wrappers, eight `ImageGrid` instances, six `EasingCurveDemo` instances, 14 `Math` instances, and numerous HTML tags such as `br`. These counts record encountered elements, not how many live widgets survive. Parent wrappers and nested demonstrations are counted separately because conversion traverses their children.

All 197 listed assets exist in the current checkout. The current `assets/` tree contains 204 files: the audit omits the separately supplied résumé PDF and six font/license files, including the IBM Plex Mono TTF now used by social-card generation. It is therefore unsuitable as an exhaustive current asset manifest. Build copies the entire asset tree without consulting it. The 66 generated social cards live under `pages/og/`, outside this copied-source inventory.

## Who creates it and who reads it

The top-level execution of [scripts/import-reference.mjs](../scripts/import-reference.mjs) builds `report.pages`, `report.assets`, and `report.components`, then writes the JSON. Its manual package command is `bun run import:reference`; the ignored reference checkout must be present. Do not run it as an editing or refresh command.

The importer is the only application code that references the audit path. Generation discovers files in `content/`; sync runs that generator; build verifies production output and renders the selected environment. CI invokes those scripts without reading audit fields. Generic JSON formatting, repository path/size checks, and text-policy checks inspect the audit as ordinary repository data, but never use its contents to select routes or verify migration completeness.

The current importer does not write `experienceTreatment`. That field is present in the committed audit at `c055301`; it describes the editorial state beyond the importer's report schema. Similarly, current experience pages contain required `period` metadata that the importer does not produce. The import is one historical phase, not a recipe for recreating today's entire tree.

## Conversion mechanics

The importer reads the original asset registry at `extras/pulkitxm.com/src/assets/index.ts` with Babel's TypeScript parser. Its `literal` function accepts literals, static templates, previously resolved identifiers, arrays, objects, and TypeScript assertions. Unsupported dynamic expressions fail. It parses each MDX body using Unified, Remark Parse, GFM, and MDX, recursively converts its AST, normalizes mixed inline/block children, then serializes ordinary Markdown.

| Original feature                                         | Static treatment in `convert`                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Prose, lists, links, code                                | Retained as Markdown nodes; links and images may have rewritten URLs           |
| `Image`, `BlogImage`, `ImagePopup`                       | Markdown images; optional captions become paragraphs                           |
| `ImageGrid`, `BlogGallery`                               | Sequence of ordinary images, without gallery controls                          |
| `DemoShowcase`, `div`, `center`, `details`, `small`, `u` | Wrapper removed and converted children kept; no collapsible/details behavior   |
| `summary`, `strong`, `code`, `CodeQuote`, `CmdKey`       | Bold, inline code, blockquote, or command-key text                             |
| `InstallTabs`                                            | One shell fence containing `npm install`; other package-manager tabs disappear |
| `Math`                                                   | Inline code or a `math` fence; no mathematical typesetting engine              |
| `InfoTip`, `TechBadges`                                  | Plain text with explanatory tip or dot-separated technology names              |
| `YoutubeEmbed`, video, iframe, document viewers/tabs     | External video/document links rather than embeds                               |
| Tweets and replies                                       | Text blockquotes with outbound post links                                      |
| Names ending in `Demo` or `Playground`                   | Link labeled “Interactive example” to the original article                     |
| `br`, `track`                                            | A space, or no output, respectively                                            |

Unknown components and other unsupported MDX nodes throw instead of silently disappearing. Conversion is not execution of React components. Images referenced through the registry or public directory are copied beneath `assets/content/`; remote HTTP(S) images remain remote. Local PDFs/videos become `https://www.pulkit.page` links. Recognized old blog links are redirected to discovered local blog routes, `/series/` becomes `/blogs/`, and `/exp/` becomes `/experience/`. These are content rewrites, not deployed HTTP redirect rules.

`codeBlocks` traverses source and converted trees. The importer checks that each original block's text appears in the converted tree and again after serialization. This tests presence of code text, not exact ordering or multiplicity when duplicate blocks have identical text; it does not prove equivalence of every prose sentence. Components can introduce new code blocks, so final counts need not equal the audit counts.

At inspection, BullMQ has 14 current code blocks versus 13 recorded originals, and Bloom Filters has 20 versus 17. Those differences alone do not prove loss or damage: conversion can add fences and later editing can change counts. Preserve the audit as historical evidence rather than rewriting it to match current content.

## Historical source versus ongoing authoring

The local ignored [reference directory](../extras/pulkitxm.com/) is a much larger Next.js/React application. Its package includes MDX rendering, animation libraries, Prisma, Redis, Hono, authentication, and email tooling. Its app routes include newsletter/admin, guestbook, component showcases, Claude Directory, feeds, sitemap/robots, and dynamic OG generation. Those packages and routes are not part of the root static portfolio.

The static project preserves the article archive and selected imagery; it simplifies experience into five short summaries and replaces rich widgets with readable static equivalents or links. Home, About, Contact, Writing landing, Experience landing, Résumé, tools, and services are authored separately. The importer only walks reference `.mdx` files, so it does not generate those manually authored portfolio pages.

`faf7b6b` introduced the Markdown portfolio, `c055301` added the migration audit and regression coverage, and `2f0028b` documented strict conventions. The ignored reference is available locally but is not committed as part of the current source tree. A fresh clone does not need it for generation or CI.

The importer refuses to overwrite an existing destination Markdown file, and fails on missing images or unsupported expressions/components. It can copy assets and write earlier pages before a later failure; it is not an atomic migration. It also emits `draft` for an unpublished reference page, although today's strict content schema rejects `draft`. These are further reasons not to treat it as an ongoing synchronizer. The audit was neither regenerated nor deleted during this documentation task.

## Policy cleanup after migration

The migration audit remains historical. The later no-comments and no-em-dash cleanup removed comments from tutorial examples and replaced forbidden punctuation. Historical byte-preservation statements describe the initial import, not the current bodies. Original code-block counts were not rewritten to hide those later edits.

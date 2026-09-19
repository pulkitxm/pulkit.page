# The migration audit and reference project

[Documentation index](index.md)

## What the JSON records

[content-migration.json](content-migration.json) is a historical migration audit. It records the conversion of the old site's MDX into ordinary Markdown. It is not a runtime manifest, route registry, asset bundler input, or current source of truth.

| Field                 | Meaning                                                                                                   | Snapshot evidence                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `pages`               | Old source relative to `extras/pulkitxm.com/content`, new repository output, and original code-node count | 58 mappings: 51 articles, two series indexes, five experience pages  |
| `pages[].codeBlocks`  | Number of original Markdown code AST nodes before component conversion                                    | 628 across the original sources; not a count recomputed during build |
| `assets`              | Sorted unique destination paths copied while converting local images                                      | 197 paths; repeated uses count once                                  |
| `components`          | Occurrences of each encountered MDX JSX element name                                                      | 99 names, 249 occurrences, including ordinary HTML tags              |
| `experienceTreatment` | Editorial note about later treatment of experience content                                                | Full original write-ups; article prose and code preserved            |

For example, `blogs/system-design/caching.mdx` was imported as `content/blogs/system-design/caching.md` under `apps/page/`, with 30 original code blocks; that post now lives at [apps/blog/content/system-design/caching.md](../apps/blog/content/system-design/caching.md). `experiences/magicapi.mdx` maps to [content/exp/magicapi.md](../apps/page/content/exp/magicapi.md): the plural directory becomes the shorter `exp` route. The source field is not relative to `docs/` or the repository root, and the output field predates the workspace split and the move of the writing to pulkit.blog: experience paths now live under `apps/page/`, while `content/blogs/` sources now live directly under `apps/blog/content/` and their `assets/content/` images under `apps/blog/assets/content/`.

The inventory includes 73 `DemoShowcase` wrappers, eight `ImageGrid` instances, six `EasingCurveDemo` instances, 14 `Math` instances, and numerous HTML tags such as `br`. These counts record encountered elements, not how many live widgets survive. Parent wrappers and nested demonstrations are counted separately because conversion traverses their children.

The audit omits the separately supplied résumé PDF, the fonts now kept in `packages/theme/assets/fonts/`, and media added when the experience write-ups were restored. It is therefore unsuitable as an exhaustive current asset manifest. Build copies each app's entire `assets/` tree without consulting it. The generated social cards are rendered into each app's `dist/og/` by the build, outside this copied-source inventory.

## Who reads it

A one-time importer, since removed from the repository, wrote this JSON while converting the reference MDX into Markdown. No current code reads the audit: the engine discovers files in each app's `content/` and renders the selected environment into that app's `dist/`, and CI never consults its fields. Generic JSON formatting, repository path/size checks, and text-policy checks inspect it as ordinary repository data, but never use its contents to select routes or verify migration completeness.

The `experienceTreatment` field and the experience pages' `period` metadata were added editorially after the import; the audit is one historical phase, not a recipe for recreating today's tree. Code-block counts can differ from current content, since later editing and restored components add or change fences. Preserve the audit as historical evidence rather than rewriting it to match current content.

## Historical source versus ongoing authoring

The local ignored [reference directory](../extras/pulkitxm.com/) is a much larger Next.js/React application. Its package includes MDX rendering, animation libraries, Prisma, Redis, Hono, authentication, and email tooling. Its app routes include newsletter/admin, guestbook, component showcases, Claude Directory, feeds, sitemap/robots, and dynamic OG generation. Those packages and routes are not part of the static portfolio.

The static project preserves the article archive, the full experience write-ups, and selected imagery. Rich widgets were first flattened into readable static equivalents or links; later work restored many of them as build-time embeds in `packages/embeds` and interactive demos in `packages/demos`. Home, About, Contact, Experience landing, Résumé, tools, and services on pulkit.page, and the pulkit.blog home, are authored separately.

`faf7b6b` introduced the Markdown portfolio, `c055301` added the migration audit and regression coverage, and `2f0028b` documented strict conventions. The ignored reference is available locally but is not committed as part of the current source tree. A fresh clone does not need it for generation or CI.

## Policy cleanup after migration

The migration audit remains historical. The later no-comments and no-em-dash cleanup removed comments from tutorial examples and replaced forbidden punctuation. Historical byte-preservation statements describe the initial import, not the current bodies. Original code-block counts were not rewritten to hide those later edits.

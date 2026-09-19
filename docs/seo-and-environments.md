# SEO, social cards, and environments

[Documentation index](index.md) · [Rendering flow](rendering-flow.md)

## One origin for every output

[resolveSiteOrigin](../scripts/site-origin.mjs) supplies the origin used by canonical URLs, JSON-LD entity IDs, social-image URLs, sitemap locations, robots, and card hostname branding. `_site.md` does not allow a `url` field, preventing a second production-domain configuration source.

| Environment                           | Origin without override                                 | Default generation output |
| ------------------------------------- | ------------------------------------------------------- | ------------------------- |
| Unset or production                   | HTTPS plus root CNAME (`https://pulkit.page` currently) | `pages/`                  |
| Development                           | `http://127.0.0.1:<PORT>`, default 3000                 | `dist/`                   |
| Other NODE\_ENV                       | Fails unless SITE\_URL is supplied                      | `dist/`                   |
| Explicit SITE\_URL in any environment | Validated override                                      | `dist/`                   |

SITE\_URL must be an absolute HTTP(S) origin without credentials, non-root path, query, or fragment. Trailing slash is normalized. CNAME must be one hostname matching the local validation pattern. SITE\_OUTPUT\_DIR allows `pages`, `dist`, or lowercase kebab-case nested directories under dist; it rejects traversal and arbitrary paths. Explicit SITE\_URL or nonproduction NODE\_ENV cannot target pages. Production with no override can explicitly target dist.

```sh
bun run generate
NODE_ENV=staging SITE_URL=https://preview.example.com bun run build
NODE_ENV=staging SITE_URL=https://preview.example.com bun run check:seo
```

Use matching environment variables for build and SEO validation. `check:seo` reads dist and resolves the current environment again; it does not infer the build origin from generated files. `check:generated` honors the caller's environment, while build explicitly forces its prerequisite sync to production. No environment-specific output should be committed under pages.

## Development preview and port selection

[dev.mjs](../scripts/dev.mjs) runs Vite on loopback. It prefers port 3000 and tries higher ports when busy. An occupied explicit PORT fails; `PORT=0` requests an available port. The actual bound origin supplies development canonicals, social metadata, sitemap, and robots.

[dev-renderer.mjs](../scripts/dev-renderer.mjs) discovers Markdown metadata lazily and renders only requested HTML and social cards. It never writes development HTML into dist or committed pages. Content and layout changes invalidate the inventory and trigger browser reloads. Dependency keys preserve unaffected pages and fences. Source CSS uses Vite hot replacement; other served assets use Vite's file watching. Bun watches imported server modules and restarts the server when they change. Configuration and font changes invalidate cached work.

Standalone generation with development PORT=0 still needs SITE\_URL because no listening server exists to resolve an origin. Production assembly verifies the full production snapshot; preview builds render their selected origin. Full static builds remain independent of the request-time dev server.

## Page metadata and graphs

[seo.mjs](../scripts/seo.mjs) and `seoHead` in [render-page.mjs](../scripts/render-page.mjs) derive metadata from existing content. The document title retains the entire title with ` | Pulkit` appended. Each generated page receives a canonical, index/follow robots instruction, Open Graph fields, Twitter large-card fields, and one JSON-LD graph. Non-index blogs use article Open Graph type and publication-date/author metadata; other pages use website type.

| JSON-LD entity               | What it represents                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| Person                       | Shared brand/person, root URL, social sameAs links                                          |
| WebSite                      | Site name, description, language, publisher reference                                       |
| ImageObject                  | Page card URL, dimensions, title caption                                                    |
| WebPage                      | Normal page with website and image references                                               |
| AboutPage / ContactPage      | Matching standalone page types                                                              |
| CollectionPage with ItemList | Index pages and their descendant non-index entries                                          |
| BlogPosting                  | Non-index blog title, description, datePublished, author/publisher, image, tags as keywords |
| BreadcrumbList               | Actual ancestor routes followed by the current page                                         |

Experience pages remain WebPage about the person; role and period do not become asserted employer relationships. No modification date, rating, qualification, or inferred career date is invented. `safeJson` escapes angle brackets, ampersands, and Unicode line separators so JSON cannot terminate its script tag; parsing still recovers the original values.

## Breadcrumbs, collections, and related articles

`ancestors` selects the home route plus actual index routes that prefix the current route, sorted by path length. For caching the visible chain is Home, Writing, System Design, Caching. The current page gets aria-current; ancestor links are root-relative.

`relatedPages` selects only other non-index blog articles. Each case-insensitive tag overlap adds one point; sharing a nested series adds three. Zero-score items are excluded. Highest score wins, ties use route lexical order, and at most three are emitted. There is no date weighting or semantic search. Tags now affect related navigation and JSON-LD but still do not produce tag archives.

`relatedNavigation` also shows immediate descendant collection pages on non-home routes. The Writing page therefore exposes the two series through generated collection navigation as well as its authored introduction links. Collection schema lists descendants sorted by date and route; visible Markdown lists use date and title. Tied-date ordering can consequently differ between the two lists without changing membership.

## Cards and crawler files

[og-images.mjs](../scripts/og-images.mjs) creates one 1200 by 630 PNG per route. Home maps to `/og/home/card.png`; caching maps to `/og/blogs/system-design/caching/card.png`. Cards contain brand/category, title, resolved hostname, and period or date, falling back to “Software engineer”. They use a dark monochrome SVG rasterized by pinned resvg, with bundled IBM Plex Mono TTF and system fonts disabled.

Title wrapping is greedy at 29 characters per line; font size drops from 54 to 44 if there are more than four lines. The function retains words, but neither generation nor tests prove every long title fits visually. PNG signature/dimensions and deterministic bytes are tested; actual typography/clipping still merits visual review. The README records that the current design is provisional pending the original visual reference.

Sitemap includes every discovered page exactly once with its canonical URL. Blog articles carry `lastmod` from their publication `date`; other pages have no trustworthy date and stay undated rather than getting an invented one. Robots allows crawling and advertises that sitemap. Generated output comprises 66 HTML files, 66 cards, 66 Markdown copies, `llms.txt`, and the two crawler files. Cards are generation outputs, not part of the historical copied-image audit.

## Markdown copies and llms.txt

[markdown-export.mjs](../scripts/markdown-export.mjs) writes every page a second time as GitHub-flavored Markdown beside its HTML: `/` becomes `/index.md`, `/about/` becomes `/about.md`, and `/blogs/system-design/` becomes `/blogs/system-design.md`. GitHub Pages serves them as static files, so no routing is involved. Each copy opens with the title as H1, the description as a quote, and a short fact list (canonical URL, publication date, role and period, tags, parent collection), followed by the body, collection and related-writing lists, and footnotes.

The body is the authored Markdown with site-specific syntax resolved into portable Markdown. Lists become link lists, images and carousels become images, math becomes `$…$` and `$$…$$`, info tips become footnotes, tweets and replies become quotes, documents and videos become links, and demos become a note linking to the page plus the demo's source files as fences. Raw `<code>`, `<strong>`, and `<br>` become Markdown; `<details>` stays as HTML; wrapper tags are dropped. Code fences are never rewritten. Every link is absolute, and links to site pages point at their Markdown copies so agents can crawl Markdown only. An embed or HTML tag without a Markdown fallback fails generation.

`llms.txt` follows the llmstxt.org shape: the brand as H1, the homepage description as a quote, a note on the `.md` convention, then one section for top-level pages and one per collection, each entry linking to the Markdown copy with its date or role and description. Every HTML page links to its copy with `<link rel="alternate" type="text/markdown">` and a View as Markdown footer link. The development server renders both on request.

## Validation and limitations

[check-seo.mjs](../scripts/check-seo.mjs) validates dist against source metadata and the resolved origin. It checks one matching canonical, one H1/main, full title, selected unique meta fields, one parseable graph with expected context, unique top-level entity IDs, page/website linkage, BlogPosting facts when present, PNG signature/dimensions, same-origin absolute href existence, exact sitemap membership, and robots sitemap advertisement. It also rejects duplicate page titles/descriptions globally.

This is not full Schema.org validation. It does not require every possible graph entity/type, exhaustively validate breadcrumb/ItemList members, prove every @id resolves, verify all Open Graph fields, or inspect card appearance. It does not fetch external URLs or establish Google indexing/rich-result eligibility. Its regular expressions depend on the generator's HTML shape. Source metadata correctness remains an editorial responsibility.

Previews currently emit the same index/follow robots metadata and allow-all robots file as production. Custom-origin isolation avoids production canonical leakage but does not make a publicly hosted preview non-indexable. Decide deliberately how to protect public previews; no preview noindex feature is implemented. RSS/Atom, redirects, and remote search-console integration remain absent.

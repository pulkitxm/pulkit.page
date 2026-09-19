# SEO, social cards, and environments

[Documentation index](index.md) · [Architecture](architecture.md) · [Rendering flow](rendering-flow.md)

## One origin for every output

[resolveSiteOrigin](../packages/engine/src/site-origin.mjs) supplies the origin used by canonical URLs, JSON-LD entity IDs, social-image URLs, sitemap locations, feed links, robots, and card hostname branding. `_site.md` does not allow a `url` field, preventing a second production-domain configuration source.

| Environment                           | Origin without override                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Unset or production                   | HTTPS plus the app's CNAME: `https://pulkit.page` for `apps/page`, `https://pulkit.blog` for `apps/blog` |
| Development                           | `http://127.0.0.1:<PORT>`, default 3000 (3001 for pulkit.blog)                                           |
| Other NODE\_ENV                       | Fails unless SITE\_URL is supplied                                                                       |
| Explicit SITE\_URL in any environment | Validated override                                                                                       |

Every build writes to the app's `dist/`: `apps/page/dist/` for pulkit.page and `apps/blog/dist/` for pulkit.blog. Each app has its own `CNAME` (`apps/page/CNAME` and `apps/blog/CNAME`), so each site's production origin comes from its own file. `NODE_ENV` and `SITE_URL` are Turbo global environment inputs, so changing either one produces a different build cache entry.

SITE\_URL must be an absolute HTTP(S) origin without credentials, non-root path, query, or fragment. Trailing slash is normalized. CNAME must be one hostname matching the local validation pattern.

```sh
bun run build
NODE_ENV=staging SITE_URL=https://preview.example.com bun run build
NODE_ENV=staging SITE_URL=https://preview.example.com bunx turbo run check:seo --filter=@pulkit/blog
```

Use matching environment variables for build and SEO validation. Through Turbo, `check:seo` depends on `build`, so the filtered command above rebuilds for that environment first unless a matching cached build exists. `check:seo` reads dist and resolves the current environment again; it does not infer the build origin from generated files. Production builds copy CNAME into dist; custom-origin builds omit it. No build output is committed.

## Development preview and port selection

[dev.mjs](../packages/engine/src/dev.mjs) runs Vite on loopback from the app directory. It prefers port 3000, or the port in `SITE_PORT` when set, and tries higher ports when busy. pulkit.blog's `dev` script sets `SITE_PORT=3001`, so `bun run dev` runs both sites side by side. An occupied explicit PORT fails; `PORT=0` requests an available port. The actual bound origin supplies development canonicals, social metadata, sitemap, feed, and robots.

[dev-renderer.mjs](../packages/engine/src/dev-renderer.mjs) discovers Markdown metadata lazily and renders only requested HTML and social cards. It never writes development HTML into dist. Content and layout changes invalidate the inventory and trigger browser reloads. Dependency keys preserve unaffected pages and fences. Source CSS uses Vite hot replacement; other served assets use Vite's file watching. Bun watches imported server modules and restarts the server when they change. Configuration and font changes invalidate cached work.

A build with development PORT=0 still needs SITE\_URL because no listening server exists to resolve an origin. Production and preview builds both render their selected origin. Full static builds remain independent of the request-time dev server.

## Page metadata and graphs

[seo.mjs](../packages/engine/src/seo.mjs) and `seoHead` in [render-page.mjs](../packages/engine/src/render-page.mjs) derive metadata from existing content. The document title is the page title followed by `|` and the site's brand (` | Pulkit` or ` | pulkit.blog`); when that would exceed 70 characters, only the page title is used. Home uses the brand alone. Each generated page receives a canonical, index/follow robots instruction, Open Graph fields, Twitter large-card fields, and one JSON-LD graph. Article pages, the non-index pages under a site's `articles` prefix (every post on pulkit.blog), use article Open Graph type with publication-date metadata and `article:author` pointing at the profile URL `https://pulkit.page/`; other pages use website type.

| JSON-LD entity               | What it represents                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Person                       | Author name and profile URL from `@pulkit/profile`, social sameAs links                                                               |
| WebSite                      | Site name, description, language, publisher reference                                                                                 |
| ImageObject                  | Page card URL, dimensions, title caption                                                                                              |
| WebPage                      | Normal page with website and image references                                                                                         |
| AboutPage / ContactPage      | Matching standalone page types                                                                                                        |
| CollectionPage with ItemList | Index pages and their descendant non-index entries; the articles root lists every post                                                |
| BlogPosting                  | Post title, description, datePublished, author/publisher, image, tags as keywords, and part of its category page or the articles root |
| BreadcrumbList               | Actual ancestor routes followed by the current page                                                                                   |

Experience pages remain WebPage about the person; role and period do not become asserted employer relationships. No modification date, rating, qualification, or inferred career date is invented. `safeJson` escapes angle brackets, ampersands, and Unicode line separators so JSON cannot terminate its script tag; parsing still recovers the original values.

## Breadcrumbs, collections, and related articles

`ancestors` selects the home route plus actual index routes that prefix the current route, sorted by path length. For pulkit.blog's caching post the BreadcrumbList chain is Home, System Design, Caching. Visible breadcrumbs render in every shared layout on both sites; the current page gets aria-current and ancestor links are root-relative.

`relatedPages` runs only on article pages and selects other posts of the same site. Each case-insensitive tag overlap adds one point; sharing a category directory below the articles root adds three. Zero-score items are excluded. Highest score wins, ties use route lexical order, and at most three are emitted. There is no date weighting or semantic search. Tags now affect related navigation and JSON-LD but still do not produce tag archives.

`relatedNavigation` also shows immediate descendant collection pages on non-home routes. On pulkit.blog the home renders the related slot too, but home is excluded from collection navigation, so the two categories are reached through its authored links and the navigation. Collection schema lists descendants sorted by date and route; visible Markdown lists use date and title. Tied-date ordering can consequently differ between the two lists without changing membership.

## Cards and crawler files

[og-images.mjs](../packages/engine/src/og-images.mjs) creates one 1200 by 630 PNG per route. Home maps to `/og/home/card.png`; pulkit.blog's caching post maps to `/og/system-design/caching/card.png`. Cards contain brand/category, title, resolved hostname, and period or date, falling back to “Software engineer”.

`cardCategory` picks the category text. An index page uses its own title, so `/system-design/` reads System Design and `/exp/` reads Experience. Any other page uses the title of its parent collection index when one exists, so the caching post also reads System Design and an experience detail reads Experience. Otherwise article pages and the articles root read Writing (the blog home and standalone posts), and everything else reads Portfolio. They use a dark monochrome SVG rasterized by pinned resvg, with bundled IBM Plex Mono TTF and system fonts disabled.

Title wrapping is greedy at 29 characters per line; font size drops from 54 to 44 if there are more than four lines. The function retains words, but neither generation nor tests prove every long title fits visually. PNG signature/dimensions and deterministic bytes are tested; actual typography/clipping still merits visual review. The current monochrome design is provisional: the requested `pulkitdixon.com` reference could not be located locally and must be supplied before matching it.

Sitemap includes every discovered page exactly once with its canonical URL. Articles carry `lastmod` from their publication `date`; other pages have no trustworthy date and stay undated rather than getting an invented one. Robots allows crawling and advertises that sitemap.

A site with an `articles` field also gets `/feed.xml`, an Atom feed of all its posts, newest first. The feed carries the site brand as its title, the site description as its subtitle, self and site links, the author name and profile URL, and one entry per post with title, canonical link and ID, the post's date as both published and updated time (midnight UTC), and its description as the summary. The feed's updated time is the newest post's date. The development server serves it as `application/atom+xml`, the rendered head of every pulkit.blog page advertises it with an Atom alternate link, and the RSS entry appended to the site's social links points at it. pulkit.page has no articles and therefore no feed.

pulkit.page's output comprises 12 HTML files, 12 cards, 12 Markdown copies, `llms.txt`, sitemap, and robots; pulkit.blog's comprises 54 HTML files, 54 cards, 54 Markdown copies, `llms.txt`, sitemap, robots, and `feed.xml`. Cards are generation outputs, not part of the historical copied-image audit.

## Markdown copies and llms.txt

[markdown-export.mjs](../packages/engine/src/markdown-export.mjs) writes every page of both sites a second time as GitHub-flavored Markdown beside its HTML: `/` becomes `/index.md`, `/about/` becomes `/about.md`, and `/system-design/caching/` becomes `/system-design/caching.md`. GitHub Pages serves them as static files, so no routing is involved. Each copy opens with the title as H1, the description as a quote, and a short fact list (canonical URL, publication date for articles, role and period, tags, parent collection), followed by the body, collection and related-writing lists, and footnotes.

The body is the authored Markdown with site-specific syntax resolved into portable Markdown. Lists become link lists (grouped under year headings for `by-year`), images and carousels become images, math becomes `$…$` and `$$…$$`, info tips become footnotes, tweets and replies become quotes, documents and videos become links, and demos become a note linking to the page plus the demo's source files as fences. Raw `<code>`, `<strong>`, and `<br>` become Markdown; `<details>` stays as HTML; wrapper tags are dropped. Code fences are never rewritten. Every link is absolute, and links to the site's own pages point at their Markdown copies so agents can crawl Markdown only. An embed or HTML tag without a Markdown fallback fails the build.

`llms.txt` follows the llmstxt.org shape: the site brand as H1, the site description as a quote, a note on the `.md` convention, then sections for top-level pages, root-level articles (Writing), and each collection, every entry linking to its Markdown copy with its date or role and description. An Elsewhere section points at the `llms.txt` of each external site in the navigation, so pulkit.page and pulkit.blog lead agents to each other. Every HTML page links to its copy with `<link rel="alternate" type="text/markdown">` and a View as Markdown footer link. The development server renders both on request.

## Validation and limitations

[check-seo.mjs](../packages/engine/src/check-seo.mjs) validates dist against source metadata and the resolved origin. It loads the site configuration through the same `readSiteConfig` as the build, including the shared profile. It checks one matching canonical, one H1/main, full title, selected unique meta fields (a meta carrying a `media` attribute, such as the light and dark `theme-color` pair, is exempt), one parseable graph with expected context, unique top-level entity IDs, page/website linkage, BlogPosting facts when present, PNG signature/dimensions, same-origin absolute href existence, exact sitemap membership, robots sitemap advertisement, and, on sites with `articles`, that `feed.xml` lists every article exactly once. It also rejects duplicate page titles/descriptions globally.

This is not full Schema.org validation. It does not require every possible graph entity/type, exhaustively validate breadcrumb/ItemList members, prove every @id resolves, verify all Open Graph fields, or inspect card appearance. It does not fetch external URLs or establish Google indexing/rich-result eligibility. Its regular expressions depend on the generator's HTML shape. Source metadata correctness remains an editorial responsibility.

Previews currently emit the same index/follow robots metadata and allow-all robots file as production. Custom-origin isolation avoids production canonical leakage but does not make a publicly hosted preview non-indexable. Decide deliberately how to protect public previews; no preview noindex feature is implemented. Old pulkit.page `/blogs/` routes are intentionally not redirected and return 404. Remote search-console integration remains absent. [Deployment](deployment.md) describes how each site reaches GitHub Pages.

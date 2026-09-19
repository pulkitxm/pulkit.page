# Content inventory and organization

[Documentation index](index.md)

## The current collection

The content is split between two apps. `apps/page/content/` holds 13 Markdown files for pulkit.page: 12 public pages and `_site.md`. `apps/blog/content/` holds 55 Markdown files for pulkit.blog: 54 public pages and `_site.md`. pulkit.page has six standalone portfolio pages, the experience index, and five experience details. pulkit.blog has its home, two series category indexes, and 51 posts. Every page has a title and description; the 51 posts and five experience details have dates; all posts have tags. Both homes explicitly select the `home` layout. No source declares a draft state.

| Site        | Group                | Source count | Organization                                                        |
| ----------- | -------------------- | ------------ | ------------------------------------------------------------------- |
| pulkit.page | Standalone portfolio | 6            | Home, About, Contact, Résumé, tools, services                       |
| pulkit.page | Experience           | 6            | Collection index plus five full role write-ups under `content/exp/` |
| pulkit.blog | Home                 | 1            | Short introduction, then every post grouped by year                 |
| pulkit.blog | Standalone posts     | 28           | Directly under `apps/blog/content/`, each at a root route           |
| pulkit.blog | Design Engineering   | 11           | Category index plus 10 posts under `content/design-engineering/`    |
| pulkit.blog | System Design        | 14           | Category index plus 13 posts under `content/system-design/`         |
| Both        | Shared metadata      | 2            | One `_site.md` per app, which creates no route                      |

The [article catalog](article-catalog.md) lists every post with a source link, route, date, subject, and tags. Post dates range from April 28, 2024 (Typewriter Effect) to August 9, 2026 (Kaksha). Most tutorials use H2/H3 sections, labeled code fences, screenshots or diagrams, links, and comparison tables where useful. Personal stories use prose and images. Design Engineering posts and one System Design post embed interactive demos from `packages/demos` through demo directives; see the [authoring guide](authoring-guide.md#interactive-demos).

## Standalone portfolio pages

| Source                                                  | Route            | Content and purpose                                                                                                                          |
| ------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [home.md](../apps/page/content/home.md)                 | `/`              | Portrait and introduction; Noveum.ai; links to About/Contact; latest three experience entries and a Writing paragraph linking to pulkit.blog |
| [about.md](../apps/page/content/about.md)               | `/about/`        | Short professional profile, community background, GitHub, pulkit.blog writing, and experience links, and links to secondary pages            |
| [contact.md](../apps/page/content/contact.md)           | `/contact/`      | Email, Cal booking link, X, LinkedIn; no local form or backend                                                                               |
| [resume.md](../apps/page/content/resume.md)             | `/resume/`       | Download link to local `/assets/content/resume.pdf`, plus experience/contact links                                                           |
| [gears.md](../apps/page/content/gears.md)               | `/gears/`        | Desk setup, everyday carry, peripherals, and software; outbound product links                                                                |
| [work-with-me.md](../apps/page/content/work-with-me.md) | `/work-with-me/` | Websites, full-stack products, mobile apps, performance/design services, and a short engagement process                                      |

The tools list includes a MacBook/BenQ desk setup, phone/watch/earbuds, keyboard/mouse, and Cursor, Raycast, ChatGPT, Notion, and WisprFlow. These are authored inventory statements, not recommendations newly researched by this documentation task. The résumé is an asset download, not a generated document.

## Collection pages

On pulkit.blog, [home.md](../apps/blog/content/home.md) introduces the writing, links the two series and the author's portfolio, and lists every post with the `all` collection grouped by year. The category indexes themselves do not appear in that list, because index pages are never posts.

[design-engineering/index.md](../apps/blog/content/design-engineering/index.md) becomes `/design-engineering/` and contains its collection directive. [system-design/index.md](../apps/blog/content/system-design/index.md) becomes `/system-design/` and adds a paragraph linking the external systems repository before its directive. Both categories also appear in the blog's navigation, and each post in them links back to its category from its meta line. On pulkit.page, [exp/index.md](../apps/page/content/exp/index.md) introduces the work history and lists experience details.

Collections are directory-prefix selections, not explicit membership arrays or tags. A post's directory determines which category list includes it; every post also appears in the blog home's list. All collection indexes use the simple shell by default. Breadcrumbs (on pulkit.page, whose layouts include them) and collection navigation derive from these real index routes; tags separately help select related posts.

## Experience details

| Source                                                        | Role and period                             | Sorting date | Selected contributions                                                                               |
| ------------------------------------------------------------- | ------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| [magicapi.md](../apps/page/content/exp/magicapi.md)           | Software Engineer, MagicAPI; 2025–present   | 2025-03-01   | API.market dashboard/onboarding, wallet/vouchers, Noveum traces/datasets/ETL, AWS migration          |
| [crowdvolt.md](../apps/page/content/exp/crowdvolt.md)         | Software Engineer, CrowdVolt (YC W24); 2025 | 2025-02-03   | Web features, fixes, performance, lint/format consistency, design collaboration                      |
| [datawavelabs.md](../apps/page/content/exp/datawavelabs.md)   | Full Stack Engineer; 2024                   | 2024-04-01   | Cloud data platform, auth/access, storage integration, infrastructure workflows, Redis notifications |
| [geeksforgeeks.md](../apps/page/content/exp/geeksforgeeks.md) | Campus Mantri; 2024–2025                    | 2024-04-01   | Workshops, learning resources, competitions, campus community; external certificate link             |
| [deviators.md](../apps/page/content/exp/deviators.md)         | Chairperson; 2024–2025                      | 2024-02-01   | Coding community, 36-hour hackathon, registration/payment platform, event infrastructure             |

Each page carries the original site's full write-up: prose, screenshots and photos under `apps/page/assets/content/exp/`, technology lists, and offer letters and other documents, now stored beside those images rather than linked to the original site. Image grids, document viewers and tabs, the hero video, and the embedded post use the components described in the [authoring guide](authoring-guide.md). Dates are sorting keys; displayed periods are independent human-readable strings.

## Shared metadata and assets

[apps/page/content/\_site.md](../apps/page/content/_site.md) sets brand `Pulkit`, a software-engineer description, and `© 2026 Pulkit`. Main navigation is Writing (`https://pulkit.blog/`), Experience, About, and Contact. It has no `articles` field, so pulkit.page has no posts, feed, or RSS link.

[apps/blog/content/\_site.md](../apps/blog/content/_site.md) sets brand `pulkit.blog`, a description of the writing, `© 2026 Pulkit`, and `articles: /`. Main navigation is System design, Design engineering, and About (`https://pulkit.page/`).

Neither file sets `social`, so both sites use the GitHub, X, and LinkedIn links from [@pulkit/profile](../packages/profile/profile.json); pulkit.blog also gets an RSS link to `/feed.xml`. The brand links home separately in each header. There is no homepage nav entry, and active navigation is exact-match only.

[apps/page/assets/](../apps/page/assets/) holds 60 tracked files: experience screenshots, photos, and documents under `assets/content/exp/`, company logos under `assets/exp/`, the portrait, and the separately supplied résumé. [apps/blog/assets/content/](../apps/blog/assets/content/) holds 199 tracked files: post images under historical topic directory names in `blogs/`, public-gallery images under `public/blogs/`, a series video under `public/series/`, and a portrait. Image folder names need not match current post slugs: the Markdown URL is authoritative. The historical audit lists 197 copied images. Fonts and favicons live in `packages/theme`. Build copies the app's whole asset tree, regardless of whether a page references each file.

The local reference has additional routes and content systems that are deliberately absent here. See [migration history](migration-audit.md) for the preserved/simplified/omitted distinctions rather than assuming the reference app's route inventory describes the published static portfolio.

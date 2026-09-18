# Content inventory and organization

[Documentation index](index.md)

## The current collection

There are 67 Markdown files in `content/`: 66 public pages and one shared configuration file. The 66 pages comprise six standalone portfolio pages, four collection indexes, 51 articles, and five experience details. All 66 have title and description; the 51 articles and five experience details have dates; all articles have tags. Only home explicitly selects a layout. No article source currently declares a draft state.

| Group                | Source count | Organization                                                              |
| -------------------- | ------------ | ------------------------------------------------------------------------- |
| Standalone portfolio | 6            | Home, About, Contact, Résumé, tools, services                             |
| All-writing index    | 1            | Manual introduction and links to the two series, then recursive blog list |
| Standalone articles  | 28           | Directly under `content/blogs/`, excluding its index                      |
| Design Engineering   | 11           | Series index plus 10 articles                                             |
| System Design        | 14           | Series index plus 13 articles                                             |
| Experience           | 6            | Collection index plus five full role write-ups                            |
| Shared metadata      | 1            | `_site.md`, which creates no route                                        |

The [article catalog](article-catalog.md) lists every article with a source link, date, subject, and tags. Article dates range from April 28, 2024 (Typewriter Effect) to August 9, 2026 (Kaksha). Most tutorials use H2/H3 sections, labeled code fences, screenshots or diagrams, links, and comparison tables where useful. Personal stories use prose and images. Migrated interactive demos are links, not executable widgets.

## Standalone portfolio pages

| Source                                        | Route            | Content and purpose                                                                                                              |
| --------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [home.md](../content/home.md)                 | `/`              | “Building & breaking things.” introduction; Noveum.ai; links to About/Contact; latest three experience entries and five articles |
| [about.md](../content/about.md)               | `/about/`        | Short professional profile, community background, GitHub/writing/experience links, and links to secondary pages                  |
| [contact.md](../content/contact.md)           | `/contact/`      | Email, Cal booking link, X, LinkedIn; no local form or backend                                                                   |
| [resume.md](../content/resume.md)             | `/resume/`       | Download link to local `/assets/content/resume.pdf`, plus experience/contact links                                               |
| [gears.md](../content/gears.md)               | `/gears/`        | Desk setup, everyday carry, peripherals, and software; outbound product links                                                    |
| [work-with-me.md](../content/work-with-me.md) | `/work-with-me/` | Websites, full-stack products, mobile apps, performance/design services, and a short engagement process                          |

The tools list includes a MacBook/BenQ desk setup, phone/watch/earbuds, keyboard/mouse, and Cursor, Raycast, ChatGPT, Notion, and WisprFlow. These are authored inventory statements, not recommendations newly researched by this documentation task. The résumé is an asset download, not a generated document.

## Collection pages

[blogs/index.md](../content/blogs/index.md) is Writing: it manually links the two series and then lists all eligible articles recursively using the broad blog list directive. The series indexes themselves do not appear in that automatic list, because all `/index.md` sources are excluded from lists.

[design-engineering/index.md](../content/blogs/design-engineering/index.md) contains its collection directive. [system-design/index.md](../content/blogs/system-design/index.md) adds a paragraph linking the external systems repository before its directive. [exp/index.md](../content/exp/index.md) introduces the work history and lists experience details.

Collections are directory-prefix selections, not explicit membership arrays or tags. A post's directory determines which series list includes it; all nested blog articles also belong to the broad Writing list. All collection indexes use the simple shell by default. Breadcrumbs and collection navigation derive from these real index routes; tags separately help select related articles.

## Experience details

| Source                                              | Role and period                             | Sorting date | Selected contributions                                                                               |
| --------------------------------------------------- | ------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| [magicapi.md](../content/exp/magicapi.md)           | Software Engineer, MagicAPI; 2025–present   | 2025-03-01   | API.market dashboard/onboarding, wallet/vouchers, Noveum traces/datasets/ETL, AWS migration          |
| [crowdvolt.md](../content/exp/crowdvolt.md)         | Software Engineer, CrowdVolt (YC W24); 2025 | 2025-02-03   | Web features, fixes, performance, lint/format consistency, design collaboration                      |
| [datawavelabs.md](../content/exp/datawavelabs.md)   | Full Stack Engineer; 2024                   | 2024-04-01   | Cloud data platform, auth/access, storage integration, infrastructure workflows, Redis notifications |
| [geeksforgeeks.md](../content/exp/geeksforgeeks.md) | Campus Mantri; 2024–2025                    | 2024-04-01   | Workshops, learning resources, competitions, campus community; external certificate link             |
| [deviators.md](../content/exp/deviators.md)         | Chairperson; 2024–2025                      | 2024-02-01   | Coding community, 36-hour hackathon, registration/payment platform, event infrastructure             |

Each page carries the original site's full write-up: prose, screenshots and photos under `assets/content/exp/`, technology lists, and offer letters and other documents, now stored beside those images rather than linked to the original site. Image grids, document viewers and tabs, the hero video, and the embedded post use the components described in the [authoring guide](authoring-guide.md). Dates are sorting keys; displayed periods are independent human-readable strings.

## Shared metadata and assets

[content/\_site.md](../content/_site.md) sets brand `Pulkit`, a software-engineer description, and `© 2026 Pulkit`. Main navigation is Writing, Experience, About, and Contact. Social links are GitHub, X, and LinkedIn. The brand links home separately in the header. There is no homepage nav entry, and active navigation is exact-match only.

[assets/content/](../assets/content/) includes imported WebP/GIF images under historical topic directory names, public-gallery images under `public/blogs/`, and the separately supplied résumé. Image folder names need not match current article slugs: the Markdown URL is authoritative. The historical audit lists 197 copied images; six font/license files plus the résumé bring current assets to 204 files. Build copies all of them, regardless of whether a page references them.

The local reference has additional routes and content systems that are deliberately absent here. See [migration history](migration-audit.md) for the preserved/simplified/omitted distinctions rather than assuming the reference app's route inventory describes the published static portfolio.

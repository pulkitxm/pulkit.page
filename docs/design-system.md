# design.pulkit.page design system

[Documentation index](index.md)

design.pulkit.page presents one engineer to three kinds of visitor: someone deciding whether to hire or work with Pulkit, a peer looking at what he built, and a reader who arrived on a post. Each needs to answer one question fast: who is this, what has he shipped, and is the writing worth reading. Reading is the main activity, so the system is built around a calm, editorial reading surface, with motion reserved for a few moments that orient the visitor.

The site has its own identity. It takes only the data of pulkit.page and pulkit.blog, which it mounts through the engine, and keeps the shared light and dark mechanism of the theme script. Its tokens, type and components live in [packages/motion/styles.css](../packages/motion/styles.css) and the layouts in [apps/design/layouts](../apps/design/layouts/). Because it redefines the theme's colour and font variables, Markdown rendered by the engine, including embeds and code, takes on the same identity without per-component overrides.

## Grid

Every page uses one twelve-column grid with a 1360px maximum width, 24px gutters and a page margin of `clamp(20px, 4vw, 56px)`. Columns 1 to 3 hold section numbers, dates and other metadata; headlines and lists start at column 4, and prose runs from column 4 to column 10, about 68 characters per line. Galleries, card grids and lists may span all twelve columns. Below 64rem the grid collapses to one column and metadata becomes a line above its content.

## Type

Three families, each with one job:

| Family           | Role                                                    | Files                                     |
| ---------------- | ------------------------------------------------------- | ----------------------------------------- |
| Instrument Serif | Display, headlines, section titles, row and card titles | `instrument-serif-latin.woff2` and italic |
| Geist            | Reading text, statements and interface                  | `geist-latin.woff2`, variable weight      |
| Geist Mono       | Metadata: dates, numbers, labels, uppercase             | `geist-mono-latin.woff2`                  |

All three are Latin subsets from Fontsource under the SIL Open Font License, served from `apps/design/assets/fonts/` with `font-display: swap`. The serif and Geist are preloaded, and metric-adjusted local fallbacks keep the swap from shifting layout.

| Role      | Size                        | Line height | Used for                                |
| --------- | --------------------------- | ----------- | --------------------------------------- |
| Display   | `clamp(96px, 21vw, 340px)`  | 0.8         | The name on the home page               |
| Headline  | `clamp(56px, 8.5vw, 136px)` | 0.92        | Page titles                             |
| Section   | `clamp(48px, 6.5vw, 104px)` | 0.95        | Numbered home sections                  |
| Row, card | `clamp(26px, 2.6vw, 38px)`  | 1.1         | Experience, writing and work titles     |
| Statement | `clamp(21px, 2vw, 28px)`    | 1.35        | The home statement, Now, and page leads |
| Body      | 18px Geist                  | 1.7         | Prose                                   |
| Label     | 11px Geist Mono, uppercase  | 1.5         | Dates, numbers and metadata             |

Hover on a serif title switches it to italic instead of changing colour or moving it.

## Colour

| Token     | Light     | Dark      | Role                                                |
| --------- | --------- | --------- | --------------------------------------------------- |
| `bg`      | `#f2f0eb` | `#0e0e0d` | Page                                                |
| `fg`      | `#141413` | `#ecebe6` | Text, rules, the inverted footer, particle ink      |
| `muted`   | `#65635d` | `#9a978f` | Secondary text and metadata                         |
| `line`    | `#d9d5cc` | `#282725` | Hairlines between rows                              |
| `surface` | `#e8e5dd` | `#171716` | Code, image frames                                  |
| accent    | `#ff4a1c` | `#ff6436` | Markers only: current page dot, progress, selection |

The accent never carries small text, so contrast stays with `fg` and `muted`. The syntax colours are redefined to match.

## Components

- **Header**: the name in serif italic, navigation from column 4 with a dot on the current page, the local time and the theme switch. On small screens the navigation moves into a full-screen menu.
- **Hero**: a label line, the name at display size, the statement from column 7, and an index of the home sections.
- **Section**: a full-width rule, the section number in the margin and its title in serif.
- **Case card**: an image at 16:10, the project in serif, one line on what it is, and a metadata line. Cards sit in two staggered columns.
- **Row**: dates in the margin, the title in serif, its role or detail beneath. Experience, writing and every index page share it.
- **Photo card**: a 4:5 crop with the event title in serif and the date.
- **Prose**: Geist at reading width, serif section headings, serif italic quotes on an accent rule, code on `surface`.
- **Footer**: an inverted block with a large serif invitation, navigation, social links and page metadata.

## Motion budget

Motion is allowed only where it explains something. Everything else is still.

| Moment             | Where                        | Why it moves                                                            |
| ------------------ | ---------------------------- | ----------------------------------------------------------------------- |
| Particle sculpture | Home hero, index page heads  | The signature: it changes shape as the home page moves between sections |
| Page transition    | Every navigation             | Keeps the visitor oriented: the new page opens from where they clicked  |
| Theme switch       | Theme button                 | The page turns over to its other side, showing what changed             |
| Menu               | Small screens                | The menu opens from the button that opened it                           |
| Feedback           | Links, rows, buttons, inputs | Hover, focus and press confirm that an element responds                 |

Not allowed: scroll reveals, split text, counting numbers, animated images or code blocks, parallax on content, marquees and custom cursors. Feedback transitions last 150 to 250ms. With reduced motion the sculpture renders one still frame and transitions are skipped.

## Performance

- The particle sculpture renders in a Web Worker on an `OffscreenCanvas` with [OGL](https://github.com/oframe/ogl), so geometry generation and every frame stay off the main thread. The page posts pointer and scroll positions to it. It starts as soon as the page script runs, caps the device pixel ratio at 1.5, sizes its point count to the device, and stops drawing while the canvas is off screen or the tab is hidden. Browsers without `OffscreenCanvas` render on the main thread with the same code.
- Scrolling is native. One passive scroll listener feeds one animation frame loop; nothing reads layout during scroll.
- The reading progress bar is a CSS scroll-driven animation and needs no JavaScript.
- Animations only change `transform`, `opacity` and `clip-path`, which the compositor runs without layout or paint.
- Page styles are inlined, two fonts are preloaded, images ship responsive sizes from the build, and the only page script is one deferred module of about 5 KB.

# design.pulkit.page design system

[Documentation index](index.md)

design.pulkit.page presents one engineer to three kinds of visitor: someone deciding whether to hire or work with Pulkit, a peer looking at what he built, and a reader who arrived on a post. Each needs to answer one question fast: who is this, what has he shipped, and is the writing worth reading. Reading is the main activity, so the system is built around a calm reading surface, with motion reserved for a few moments that orient the visitor.

The site shares the theme of pulkit.page and pulkit.blog: the same colour tokens, Comic Relief, the theme script and its light and dark modes. Everything below is layered on those tokens in [packages/motion/styles.css](../packages/motion/styles.css) and the layouts in [apps/design/layouts](../apps/design/layouts/).

## Grid

Every page uses one twelve-column grid with a 1280px maximum width, 24px gutters and a page margin of `clamp(20px, 4vw, 56px)`. The grid has two zones:

| Zone   | Columns | Holds                                                               |
| ------ | ------- | ------------------------------------------------------------------- |
| Margin | 1 to 3  | Section labels, breadcrumbs, dates, reading time and other metadata |
| Main   | 4 to 12 | Headlines, lists, cards and media                                   |

Prose sits in columns 4 to 10, about 68 characters per line. Galleries, card grids and wide tables may use the full main zone. The header aligns its navigation to column 4, so the navigation, every headline and every paragraph start on the same vertical line. Below 64rem the grid collapses to one column and margin content becomes a small label above the main content.

## Type

Comic Relief carries all reading text. The system monospace face carries labels and metadata, always uppercase with wide tracking, so structure reads differently from content.

| Role      | Size                         | Line height | Used for                              |
| --------- | ---------------------------- | ----------- | ------------------------------------- |
| Display   | `clamp(84px, 16vw, 232px)`   | 0.85        | The name on the home page only        |
| Headline  | `clamp(40px, 6vw, 84px)`     | 0.95        | Page titles                           |
| Statement | `clamp(22px, 2.4vw, 34px)`   | 1.25        | Home statement and the Now paragraph  |
| Lead      | `clamp(18px, 1.6vw, 23px)`   | 1.4         | Page descriptions under headlines     |
| Section   | `clamp(26px, 2.8vw, 36px)`   | 1.1         | Headings inside prose and home blocks |
| Body      | 17px                         | 1.7         | Prose                                 |
| Row title | `clamp(19px, 1.8vw, 24px)`   | 1.2         | Experience, writing and work rows     |
| Label     | 11px monospace, 0.12em track | 1.4         | Margin labels, dates, metadata        |

## Colour roles

| Token     | Role                                                             |
| --------- | ---------------------------------------------------------------- |
| `bg`      | Page                                                             |
| `fg`      | Primary text, the particle ink                                   |
| `muted`   | Secondary text and metadata                                      |
| `line`    | Hairline rules between rows and sections                         |
| `surface` | Code, quotes and card backgrounds                                |
| `syn-s`   | The single accent: current page, hover on rows, focus, selection |

## Components

- **Header**: wordmark in column 1, navigation from column 4, theme switch at the right edge. On small screens the navigation moves into a full-screen menu.
- **Page head**: breadcrumb in the margin, headline and lead in the main zone, and on index pages the particle sculpture behind the right half.
- **Section**: a numbered label in the margin and the content in the main zone, separated from the next section by a hairline.
- **Index row**: title, a short secondary line and metadata, with an arrow that appears on hover. Experience, writing and selected work all use it.
- **Card**: an event cover with a title and date beneath, in a two or four column grid.
- **Prose**: Markdown content at reading width, with code, quotes and images framed by `surface` and `line`.
- **Footer**: a contact line, navigation and social links, and the wordmark set large as a closing mark.

## Motion budget

Motion is allowed only where it explains something. Everything else is still.

| Moment             | Where                        | Why it moves                                                            |
| ------------------ | ---------------------------- | ----------------------------------------------------------------------- |
| Particle sculpture | Home hero, index page heads  | The signature: it changes shape as the home page moves between sections |
| Page transition    | Every navigation             | Keeps the visitor oriented: the new page opens from where they clicked  |
| Theme switch       | Theme button                 | The page turns over to its other side, showing what changed             |
| Menu               | Small screens                | The menu opens from the button that opened it                           |
| Feedback           | Links, rows, buttons, inputs | Hover, focus and press confirm that an element responds                 |

Not allowed: scroll reveals, split text, counting numbers, animated images or code blocks, parallax on content, marquees and custom cursors. Feedback transitions last 150 to 250ms and only change colour, opacity or a translation of at most 4px. With reduced motion the sculpture renders one still frame and transitions are skipped.

## Performance

- The particle sculpture renders in a Web Worker on an `OffscreenCanvas` with [OGL](https://github.com/oframe/ogl), so geometry generation and every frame stay off the main thread. The page posts pointer and scroll positions to it. It starts as soon as the page script runs, caps the device pixel ratio at 1.5, sizes its point count to the device, and stops drawing while the canvas is off screen or the tab is hidden. Browsers without `OffscreenCanvas` render on the main thread with the same code.
- Scrolling is native. One passive scroll listener feeds one animation frame loop; nothing reads layout during scroll.
- The reading progress bar is a CSS scroll-driven animation and needs no JavaScript.
- Animations only change `transform`, `opacity` and `clip-path`, which the compositor runs without layout or paint.
- Page styles are inlined, fonts are preloaded, images ship responsive sizes from the build, and the only page script is one deferred module.

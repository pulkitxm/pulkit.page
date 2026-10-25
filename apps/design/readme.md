# Design portfolio spike

A seven-page static HTML portfolio for a future `design.pulkit.page`. The preview runs locally; no hosting is configured.

Run from the repository root:

```sh
bun run dev:design
```

Open <http://127.0.0.1:4178/>. The server binds to this laptop only.

The small Python standard-library builder combines shared HTML fragments into `dist/`. Each output page contains its CSS and scripts inline. Fonts and the portrait are served locally. There is no framework, backend, CDN request, or runtime build dependency.

To rebuild after editing:

```sh
python3 apps/design/build.py
```

## Pages

- `index.html`: an introduction, scroll-driven design process, project collection, and contact invitation.
- `work.html`: a full visual index with direct links to every project.
- `kaksha.html`, `edith.html`, `pulkit-page.html`: individual project stories, design decisions, interface detail sequences, color systems, and next-project navigation.
- `about.html`: personal background and experience linked to the main portfolio.
- `contact.html`: email, copy-email action, scheduling, and social links.

These are real personal projects presented through new visual studies. The compositions use synthetic interface content and are explicitly distinguished from shipping product screenshots. No commissioned work or results are invented.

## Motion

The home page includes a scroll-scrubbed knot-to-ring transformation, moving typography, a pinned card sequence, and a horizontal project gallery. Project pages include cover parallax, pinned detail zooms, staggered reveals, and color-system reveals. Navigation uses layered page curtains with native URLs, direct loading, and browser history.

Pointer interactions include a following ring and trail, contextual project cursor, perspective tilt, magnetic directional controls, and a pointer-responsive sculpture. Touch layouts stack project stories and cards vertically. System reduced-motion preferences and a persistent motion toggle disable scroll pinning and decorative movement while preserving all content and navigation.

## Editing

`source/layout.html` contains the shared page structure. `source/pages/` contains page content. Artwork fragments are shared across the index and project pages. `source/styles.html` and `source/motion.html` contain the styling and interaction code. `source/libraries.html` contains embedded GSAP and ScrollTrigger distributions.

## Reference study

Starting collection: <https://www.awwwards.com/websites/developer/>

Public HTML, styles, and browser bundles were downloaded locally for inspection from:

| Reference                        | Technique studied                                   | Original adaptation                                                |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| <https://brandonyasin.com/>      | Spatial project gallery and restrained captions     | Scroll-driven work collection and generous visual framing          |
| <https://dennissnellenberg.com/> | Magnetic controls, delayed cursor, scroll scrubbing | Magnetic arrows, contextual cursor, and scroll-linked compositions |
| <https://jesperlandberg.com/>    | Spatial presentation and WebGL motion               | Original canvas sculpture with depth-sorted geometry               |
| <https://huyml.co/>              | Editorial hierarchy and expressive typography       | Grotesk and italic serif typography across a complete portfolio    |

The downloads contain public client assets, not private repositories or server code. Reference artwork and implementation bundles are not shipped with this portfolio.

Research files and manifests are in `.cache/design-research/`. Checkpoint archives are in `.cache/design-checkpoints/`. Both are ignored by Git. The archives preserve checkpoints from the original local spike. Published revisions follow the repository commit workflow.

## Dependencies and hosting

GSAP 3.13.0, ScrollTrigger, Space Grotesk, and Instrument Serif notices are preserved in `THIRD-PARTY-LICENSES.txt`. The portrait comes from the existing repository. Interface compositions and geometric artwork were created for this spike.

When deployment is requested, build and serve `apps/design/dist/` as static files. No DNS, production routing, hosting, or deployment configuration has been changed.

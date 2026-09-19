---
title: Renaming Tailwind Classes at Build Time
description: I taught this site's build to swap every Tailwind utility for a one or two letter class
  name. Here's how it works, what it saved in real bytes, and why it's a size trick, not a way to
  hide your styles.
date: 2026-09-20
tags:
  - Tailwind CSS
  - CSS
  - Build Tools
  - Performance
  - Web Performance
---

Open the source of any Tailwind site and you'll see markup like this:

```html
<div class="mx-auto max-w-190 px-7 max-sm:px-5.5">
```

Readable, great to write, and repeated on every element of every page you ship. So I asked a simple question: can the build rename all of that to something short, the same way a JS minifier renames variables?

It can. As of this week, pulkit.blog ships this instead:

```html
<div class="x r2 v6 md">
```

## How it works

The rename is one extra step at the end of the build, after Tailwind compiles the stylesheet:

1. Parse the compiled CSS with [Lightning CSS](https://lightningcss.dev) and walk every selector, including the ones nested inside `:is()`, `:not()` and `:has()`. Tailwind's `**:` and arbitrary variants live in there.
2. Give each class a short name: `a`, `b`, ... `z`, then `a0`, `b0` and so on.
3. Rewrite the `class` attributes in every built HTML page with the same map.

The interesting part is what it must **not** rename:

- **Classes that scripts refer to by name.** If a script toggles `hidden`, renaming it breaks the toggle silently. So any class that appears in a shipped script keeps its name. Here that's just three: `block`, `hidden` and `group`.
- **Classes owned by other stylesheets**, like KaTeX and PhotoSwipe. Their CSS still says `.katex`.
- **Anything inside a `<script>` tag.** The demos on this blog carry highlighted source code as JSON, and those classes are styled by the demo's own stylesheet inside a shadow root.

Development builds skip the step entirely, so while I'm working I still see `max-sm:px-5.5` in DevTools.

## What it actually saved

I measured it against the same commit without the rename:

|                    | Before  | After   | Gzipped change |
| ------------------ | ------- | ------- | -------------- |
| Stylesheet         | 37.4 KB | 31.3 KB | -16%           |
| 54 blog pages      | 4.52 MB | 3.65 MB | -7%            |
| 12 portfolio pages | 295 KB  | 237 KB  | -11%           |

Gzip already squeezes repeated class names hard, so the compressed win is smaller than the raw one. It works out to roughly 1 KB less CSS and 1 KB less HTML per page load. Small, but free once it's in the build.

To make sure nothing moved, I compared the computed style of every element on all 66 routes, on desktop and mobile, in light and dark mode. Zero differences.

## Should you do this?

Do it if you want a few free kilobytes on a content-heavy site and your build already has a post-processing step to hang it on.

Don't do it to hide your styles. The browser needs the full stylesheet to render the page, so anyone can open DevTools and read every computed value. Renaming `gap-4` to `x7` removes the Tailwind vocabulary, not the design.

Two costs to know about:

- **Names aren't stable.** They're deterministic for the same source, but adding one class can shift most names on the site. Use `data-*` attributes for tests, analytics and scripts, never the generated names.
- **Debugging production gets harder.** `class="v w5 s7"` tells you nothing. Keep dev builds unrenamed.

For this blog, that's a trade I'm happy with.

---
title: Renaming Tailwind Classes at Build Time
description: I wanted to rename every Tailwind class on my site so nobody could read my CSS. It
  didn't hide anything, but it did make every page smaller. Here's what I built and what I learned.
date: 2026-09-20
tags:
  - Tailwind CSS
  - CSS
  - Build Tools
  - Performance
  - Web Performance
---

I was working on this site the other day, writing Tailwind classes like I always do, when I opened the page source and saw this:

```html
<div class="mx-auto max-w-190 px-7 max-sm:px-5.5">
```

Anyone who knows Tailwind can read that like a sentence: centered, max width, padding, less padding on small screens. My whole design was sitting there in plain English on every element of every page.

So I had an idea. JavaScript minifiers rename variables to single letters, so why not do the same to class names at build time? Rename everything to short, meaningless names, and nobody can read my CSS anymore.

I built it. Now the same element ships like this:

```html
<div class="x r2 v6 md">
```

The build compiles the stylesheet with Tailwind, walks every selector in it with [Lightning CSS](https://lightningcss.dev), gives each class a short name (`a`, `b`, ... `z`, then `a0`, `b0`), and rewrites the `class` attributes in every built page with the same map. Development builds skip the step, so I still see readable names while working.

The tricky part was knowing what not to rename. If a script toggles `hidden` and the build renames it, the toggle breaks silently. So any class that appears in a shipped script keeps its name, which on this site was just `block`, `hidden` and `group`. Classes that belong to other stylesheets, like KaTeX's, stay too. So does anything inside a `<script>` tag, because the demos on this blog carry highlighted code as JSON with their own styles.

Then I checked whether it actually worked, and a few things surprised me.

First, it doesn't hide anything. The browser needs the full stylesheet to draw the page, so anyone can open DevTools, click an element and read every computed value: `display: flex`, `gap: 1rem`, every color. Renaming `gap-4` to `x7` removes the Tailwind vocabulary, not the design. My original goal was a dead end.

Second, it made the site smaller, more than I expected:

|                    | Before  | After   | Gzipped change |
| ------------------ | ------- | ------- | -------------- |
| Stylesheet         | 37.4 KB | 31.3 KB | -16%           |
| 54 blog pages      | 4.52 MB | 3.65 MB | -7%            |
| 12 portfolio pages | 295 KB  | 237 KB  | -11%           |

Gzip already compresses repeated class names well, so the real win is smaller than the raw numbers. It's still roughly 1 KB less CSS and 1 KB less HTML on every page load, for free.

Third, nothing broke. I compared the computed style of every element on all 66 routes, on desktop and mobile, in light and dark mode, against a build without the rename. Zero differences.

And fourth, there are costs. The names are the same every time you build the same code, but adding a single class can shift most of them, so never use the generated names for tests, analytics or scripts. Use `data-*` attributes instead. And debugging production gets harder, because `class="v w5 s7"` tells you nothing.

Those were my observations, and I thought they were worth writing down. If you run a content-heavy site and your build already has a step to hang this on, it's a few free kilobytes on every page. Just don't do it to protect your CSS, because it won't.

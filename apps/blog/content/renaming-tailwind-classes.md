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

After shipping it, I noticed a few things. It doesn't actually hide anything. The browser needs the full stylesheet to draw the page, so anyone can open DevTools and still read every computed value. Renaming `gap-4` to `x7` removes the Tailwind vocabulary, not the design.

What it did do was make every page smaller. The stylesheet dropped 16% and the HTML about 7 to 11% after gzip, which is roughly 2 KB less on every page load. Nothing broke either: every element on all 66 routes computed exactly the same styles as before.

The one catch is that the names aren't stable. Adding a single class can shift most of them, so they should never be used in tests or scripts.

So my original goal was a dead end, but the size win was real, and I kept it. If you want to try it on your own site, here's the prompt I'd hand to a coding agent.

<details>

<summary>Prompt: rename Tailwind classes at build time</summary>

```text
Add a production-only build step that renames every class in my compiled
Tailwind stylesheet to a short generated name, and rewrites the built HTML
to match. Development builds must keep the original class names.

Where it runs
- After Tailwind has compiled the final CSS and all HTML pages are written,
  and before any step that fingerprints or hashes the CSS file.
- Operate on the build output directory only. Never touch source files.

Renaming the CSS
- Parse the compiled stylesheet with Lightning CSS and use its Selector
  visitor to find class names. Recurse into nested selectors inside :is(),
  :where(), :not(), :has() and :nth-child(... of ...), because Tailwind
  puts classes for variants like **: and [&_a]: there.
- Assign names in a deterministic order: a..z, then a0, b0, and so on.
  Every name must start with a letter.
- Skip any generated name that already exists as a class anywhere in the
  output, so a renamed class never collides with one that was kept.

Classes that must keep their names
- Any class that appears as a whole word in a shipped JavaScript file that
  touches the page (classList, querySelector, className, template strings).
- Any class defined in another stylesheet that styles the page, such as
  KaTeX or a lightbox library.
- Ignore scripts and styles that only render inside a shadow root; they
  cannot see the page's classes.

Rewriting the HTML
- Rewrite only real class="..." attributes. Leave the contents of <script>,
  <style> and HTML comments untouched, including JSON payloads that contain
  HTML strings.
- Decode HTML entities in each class token before looking it up, because
  arbitrary variants like [&>p]:mb-2 are written as [&amp;>p]:mb-2.
- Leave any class that is not in the rename map exactly as it was.

Verification
- Unit tests for: name generation (unique, valid identifiers), HTML
  rewriting (scripts, styles, comments and escaped code are untouched,
  entities are decoded), and an end-to-end run on a small fixture
  directory with kept and renamed classes.
- Build the site with and without the step, then load every route in a
  headless browser at desktop and mobile widths in light and dark mode.
  Compare getComputedStyle for every element and its ::before and
  ::after. There must be zero differences.
- Report raw and gzipped sizes of the stylesheet and HTML before and after.
- Log how many classes were renamed and how many were kept.
```

</details>

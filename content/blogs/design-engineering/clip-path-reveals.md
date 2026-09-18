---
title: Invisible Scissors
description: clip-path trims elements into circles and polygons, but it is also a powerful animation
  tool. Learn how inset clipping works, build before and after sliders without extra wrappers,
  reveal images without layout shift, and fire reveals with Intersection Observer.
date: 2026-03-25
tags:
  - CSS
  - clip-path
  - Reveals
  - Motion Design
---

You have probably seen `clip-path` used to turn a box into a triangle or a circle. It is a layout neutral way to change what gets painted. That same idea is what makes `clip-path` so good for motion. Once you start animating the shape of the clip, you get wipes, reveals, and masks that stay on the compositor friendly path.

## TL;DR

- **`clip-path` hides pixels, not layout.** The element still occupies the same box as before, similar to `transform`
- **Basic shapes** include `circle`, `ellipse`, `polygon`, `inset`, and `url()` for SVG paths
- **`inset(top right bottom left)`** is the workhorse for wipes and sliders because every value maps to a straight edge you can drive with a pointer or a timeline
- **Before and after comparisons** can clip the top layer with `inset(0 var(--r) 0 0)` instead of juggling extra overflow wrappers
- **Image reveals** can animate from `inset(100%)` to `inset(0)` so the asset is already sized and no height animation causes reflow
- **Scroll triggers** pair naturally with the [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) so the reveal starts when the user can actually see it

## What gets clipped

`clip-path` defines a region. Pixels outside that region are not drawn. Pixels inside stay visible. It is a visual cut, not a change to width, height, or document flow.

[Interactive example: Clip Path Basics](https://www.pulkit.blog/series/design-engineering/clip-path-reveals)

Because layout is unchanged, you can stack two full size layers, clip only the top one, and get a perfect split without resizing either child.

## Why inset shows up in so many animations

`circle(50% at 50% 50%)` is intuitive. The radius is `50%` and the position is the center of the element. Other keywords like `ellipse`, `polygon`, and `url("...")` (an SVG clip source) cover more exotic shapes.

For interactive wipes and scroll reveals, `inset` is usually the right default. It takes up to four offsets, top, right, bottom, and left, measured from each edge toward the center. A value of `100%` on every side (`inset(100%)`) clips the whole element away. `inset(0)` shows everything.

[Interactive example: Inset](https://www.pulkit.blog/series/design-engineering/clip-path-reveals)

`inset(0 50% 0 0)` pulls the clip inward from the right by half the width, so only the left half of the layer stays visible. Swap which edge you inset and you change the direction of the wipe.

## Before and after sliders

A classic pattern is two images aligned in the same box. The top image gets a clip that follows the handle. As the user drags, you update one inset value from `0%` to `100%`.

[Interactive example: Comparison Slider](https://www.pulkit.blog/series/design-engineering/clip-path-reveals)

You could solve the same problem with two elements and `overflow: hidden` plus animated widths, but `clip-path` keeps both layers full size and often stays cheaper to paint during the drag because you are not thrashing layout.

## A vertical split on type

The same stacking trick works for typography. Layer a stroked outline and a solid fill, then clip each layer with complementary insets. Moving the split line reads as a single treatment instead of a literal slider.

[Interactive example: Text Mask](https://www.pulkit.blog/series/design-engineering/clip-path-reveals)

Here the outline uses something like `inset(0 0 calc(100% - var(--y)) 0)` while the fill uses `inset(var(--y) 0 0 0)`, both driven from the same pointer position.

## Reveals without reflow

Animating `height` from `0` to `auto` is still awkward on the web. Animating `clip-path` from fully clipped to `inset(0)` gives a similar feeling with a fixed box. The content is already there, you are only changing what is visible, so surrounding layout does not jump when the reveal finishes.

[Interactive example: Image Reveal](https://www.pulkit.blog/series/design-engineering/clip-path-reveals)

That difference matters for images and hero media where you do not want the page to reflow as the file appears.

## Triggering when the element is on screen

A reveal that runs while the element is below the fold might finish before the user scrolls to it. You want the animation tied to visibility.

The Intersection Observer API is the lightweight choice. Create an observer with a sensible `threshold`, toggle a class or state when `isIntersecting` is true, and run the `clip-path` transition in CSS or inline styles. If you already ship [Framer Motion](https://www.framer.com/motion/), its `useInView` hook wraps the same idea with a React friendly API, at the cost of pulling the library into that bundle.

[Interactive example: Scroll Reveal](https://www.pulkit.blog/series/design-engineering/clip-path-reveals)

Pass the scrollable container as the `root` option when the reveal lives inside an overflow element so thresholds are measured against the right viewport.

## Conclusion

`clip-path` is a mask you can animate. `inset` gives you predictable edges for sliders, scroll reveals, and progressive disclosure without resizing the DOM, and it lands on the compositor in modern browsers so it stays cheap to paint. When you need diagonals or organic cuts, `polygon()` can morph between shapes as long as both states share the same number of points, though it is easier to get wrong than four straight edges.

Pair reveals with Intersection Observer so they fire when the user can see them, profile on real devices when using complex `path()` or `url(#svg)` clips, and once you know what to look for you will notice this pattern on every polished production site you visit.

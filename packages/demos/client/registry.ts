import type { DemoHandle, DemoLoader, DemoModule, DemoProps } from "./types.ts";

interface LegacyDemoModule {
  mount: (root: HTMLElement, props: DemoProps) => unknown;
}

function isDemoHandle(value: unknown): value is DemoHandle {
  return typeof value === "object" && value !== null;
}

function legacyDemo(module: LegacyDemoModule): DemoModule {
  return {
    mount(root, props) {
      const handle = module.mount(root, props);
      return isDemoHandle(handle) ? handle : undefined;
    },
  };
}

export const components: Readonly<Record<string, DemoLoader>> = {
  "backwards-fill": () => import("./components/backwards-fill.ts"),
  "ball-drop": () => import("./components/ball-drop.ts"),
  "blinking-cursor": () => import("./components/blinking-cursor.ts"),
  "bounce-comparison": () => import("./components/bounce-comparison.ts"),
  "button-hover": () => import("./components/button-hover.ts"),
  "button-press": () => import("./components/button-press.ts"),
  "button-press-pattern": () => import("./components/button-press-pattern.ts"),
  "card-reveal": () => import("./components/card-reveal.ts"),
  "clip-path-basics": () => import("./components/clip-path-basics.ts"),
  "comparison-slider": () => import("./components/comparison-slider.ts"),
  "cubic-bezier-playground": () => import("./components/cubic-bezier-playground.ts"),
  "duration-comparison": () => import("./components/duration-comparison.ts"),
  "easing-curve": () => import("./components/easing-curve.ts"),
  "easing-personalities": () => import("./components/easing-personalities.ts"),
  "element-size": () => import("./components/element-size.ts"),
  "fade-in": () => import("./components/fade-in.js").then(legacyDemo),
  "fill-mode": () => import("./components/fill-mode.js").then(legacyDemo),
  "flip-card-pattern": () => import("./components/flip-card-pattern.js").then(legacyDemo),
  "frequency-toggle": () => import("./components/frequency-toggle.js").then(legacyDemo),
  "gpu-acceleration": () => import("./components/gpu-acceleration.js").then(legacyDemo),
  "hold-to-delete": () => import("./components/hold-to-delete.js").then(legacyDemo),
  "hover-button": () => import("./components/hover-button.js").then(legacyDemo),
  "image-reveal": () => import("./components/image-reveal.js").then(legacyDemo),
  "infinite-animation": () => import("./components/infinite-animation.js").then(legacyDemo),
  inset: () => import("./components/inset.js").then(legacyDemo),
  interruptibility: () => import("./components/interruptibility.js").then(legacyDemo),
  "interruptibility-comparison": () =>
    import("./components/interruptibility-comparison.js").then(legacyDemo),
  "interruptible-transition": () =>
    import("./components/interruptible-transition.js").then(legacyDemo),
  "janky-vs-smooth": () => import("./components/janky-vs-smooth.js").then(legacyDemo),
  "keyboard-nav": () => import("./components/keyboard-nav.js").then(legacyDemo),
  "list-expansion": () => import("./components/list-expansion.js").then(legacyDemo),
  marquee: () => import("./components/marquee.js").then(legacyDemo),
  "notification-dot": () => import("./components/notification-dot.js").then(legacyDemo),
  "perceptual-duration": () => import("./components/perceptual-duration.js").then(legacyDemo),
  "performance-stress-test": () =>
    import("./components/performance-stress-test.js").then(legacyDemo),
  perspective: () => import("./components/perspective.js").then(legacyDemo),
  "physics-comparison": () => import("./components/physics-comparison.js").then(legacyDemo),
  "play-state": () => import("./components/play-state.js").then(legacyDemo),
  "product-vs-marketing": () => import("./components/product-vs-marketing.js").then(legacyDemo),
  purpose: () => import("./components/purpose.js").then(legacyDemo),
  "reduced-motion": () => import("./components/reduced-motion.js").then(legacyDemo),
  rotate: () => import("./components/rotate.js").then(legacyDemo),
  "scale-vs-width-height": () => import("./components/scale-vs-width-height.js").then(legacyDemo),
  "scroll-reveal": () => import("./components/scroll-reveal.js").then(legacyDemo),
  "shake-pattern": () => import("./components/shake-pattern.js").then(legacyDemo),
  "skeleton-loader": () => import("./components/skeleton-loader.js").then(legacyDemo),
  skew: () => import("./components/skew.js").then(legacyDemo),
  "slide-in-pattern": () => import("./components/slide-in-pattern.js").then(legacyDemo),
  "sliding-window-log": () => import("./components/sliding-window-log.js").then(legacyDemo),
  "spatial-relationship": () => import("./components/spatial-relationship.js").then(legacyDemo),
  "spinner-speed": () => import("./components/spinner-speed.js").then(legacyDemo),
  "spring-config-playground": () =>
    import("./components/spring-config-playground.js").then(legacyDemo),
  "spring-vs-easing": () => import("./components/spring-vs-easing.js").then(legacyDemo),
  "stacked-animations": () => import("./components/stacked-animations.js").then(legacyDemo),
  "taste-comparison": () => import("./components/taste-comparison.js").then(legacyDemo),
  "text-mask": () => import("./components/text-mask.js").then(legacyDemo),
  "tilt-card": () => import("./components/tilt-card.js").then(legacyDemo),
  "toast-interrupt": () => import("./components/toast-interrupt.js").then(legacyDemo),
  "toast-stack": () => import("./components/toast-stack.js").then(legacyDemo),
  "tooltip-delay": () => import("./components/tooltip-delay.js").then(legacyDemo),
  "transform-order": () => import("./components/transform-order.js").then(legacyDemo),
  "transform-origin": () => import("./components/transform-origin.js").then(legacyDemo),
  "transform-vs-margin": () => import("./components/transform-vs-margin.js").then(legacyDemo),
  "transition-basics": () => import("./components/transition-basics.js").then(legacyDemo),
  "transition-property": () => import("./components/transition-property.js").then(legacyDemo),
  "translate-percentage": () => import("./components/translate-percentage.js").then(legacyDemo),
  "uncanny-valley": () => import("./components/uncanny-valley.js").then(legacyDemo),
  "vercel-badge": () => import("./components/vercel-badge.js").then(legacyDemo),
};

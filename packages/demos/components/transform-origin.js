import { Check, ChevronDown } from "lucide";
import { createSlider } from "../runtime/slider.js";
import { cn, escapeHtml, html, icon, refs } from "../runtime/ui.js";

const origins = [
  { label: "Center", name: "center", value: "center" },
  { label: "Top Left", name: "top-left", value: "top left" },
  { label: "Top Right", name: "top-right", value: "top right" },
  { label: "Bottom Left", name: "bottom-left", value: "bottom left" },
  { label: "Bottom Right", name: "bottom-right", value: "bottom right" },
];

const dotPositions = {
  "top-left": { left: "0%", top: "0%" },
  "top-right": { left: "100%", top: "0%" },
  "bottom-left": { left: "0%", top: "100%" },
  "bottom-right": { left: "100%", top: "100%" },
};

const triggerClass = cn(
  "flex h-11 w-fit cursor-pointer items-center justify-between gap-2 whitespace-nowrap rounded-md",
  "border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none",
  "transition-[color,box-shadow]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  "motion-reduce:transition-none",
  "data-placeholder:text-muted-foreground",
  "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2",
  "dark:bg-input/30 dark:hover:bg-input/50",
  "[&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
  "h-9 w-full",
);

const contentClass = cn(
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-10001 max-h-(--radix-select-content-available-height) min-w-32 origin-(--radix-select-content-transform-origin) cursor-pointer overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in",
  "data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
);

const viewportClass = cn(
  "p-1",
  "h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width) scroll-my-1",
);

const itemClass =
  "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2";

const presenceStyles = `@keyframes select-enter{from{opacity:0;transform:translate3d(0,var(--select-enter-y,0),0) scale3d(.95,.95,.95)}}@keyframes select-exit{to{opacity:0;transform:translate3d(0,var(--select-enter-y,0),0) scale3d(.95,.95,.95)}}[data-select-content][data-state=open]{animation:select-enter .15s ease}[data-select-content][data-state=closed]{animation:select-exit .15s ease}[data-select-content][data-side=bottom]{--select-enter-y:-.5rem}[data-select-content][data-side=top]{--select-enter-y:.5rem}`;

export function mount(root) {
  let selectedOrigin = "center";
  let rotatePerc = 0;
  let animate = false;
  const timers = new Set();
  let cleanupSelect = () => {};

  function later(callback, delay) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  }

  function build() {
    cleanupSelect();
    root.innerHTML = html`<style>${presenceStyles}</style><div class="flex size-full flex-col items-center justify-center gap-6 p-6">
      <div class="relative flex h-48 w-48 items-center justify-center">
        <div class="absolute inset-0 rounded-lg border-2 border-neutral-300 border-dashed dark:border-neutral-700"></div>
        <div data-ref="box" class="relative flex size-24 items-center justify-center rounded-lg bg-linear-to-br from-cyan-500 to-blue-600 font-medium text-sm text-white shadow-lg transition-transform duration-500 ease-out">
          <span data-ref="dot" class="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400 shadow-md ring-2 ring-white"></span>
        </div>
      </div>
      <div class="flex w-full max-w-md flex-row items-center gap-3">
        <div data-ref="selectColumn" class="flex min-w-0 flex-1 flex-col gap-1.5">
          <label class="text-neutral-600 text-xs dark:text-neutral-400" for="transform-origin-select">Transform origin</label>
          <button type="button" role="combobox" aria-autocomplete="none" aria-expanded="false" dir="ltr" data-state="closed" data-slot="select-trigger" data-size="default" id="transform-origin-select" data-ref="trigger" class="${triggerClass}"><span data-slot="select-value" data-ref="valueText" style="pointer-events: none;"></span>${icon(ChevronDown, "size-4 opacity-50")}</button>
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <label data-ref="rotationLabel" class="text-neutral-600 text-xs dark:text-neutral-400" for="rotation-slider"></label>
          <div data-ref="sliderSlot" class="flex h-9 items-center"></div>
        </div>
      </div>
      <p class="max-w-sm text-center text-neutral-500 text-xs dark:text-neutral-400">The yellow dot shows the origin point. Notice how the rotation pivots around it.</p>
    </div>`;
    const elements = refs(root);
    const slider = createSlider({
      min: 0,
      max: 100,
      step: 1,
      value: rotatePerc,
      onValueChange: (next) => {
        rotatePerc = next;
        render();
      },
    });
    slider.element.id = "rotation-slider";
    elements.sliderSlot.append(slider.element);
    cleanupSelect = setupSelect(elements.trigger, (value) => {
      selectedOrigin = value;
      animate = false;
      render();
      later(() => {
        animate = true;
        render();
      }, 100);
    });

    function render() {
      const origin = origins.find((entry) => entry.value === selectedOrigin);
      const dot = dotPositions[origin?.name] ?? { left: "50%", top: "50%" };
      const rotateDeg = rotatePerc * (360 / 100);
      elements.box.style.transform = animate ? `rotate(${rotateDeg}deg)` : "rotate(0deg)";
      elements.box.style.transformOrigin = selectedOrigin;
      elements.dot.style.left = dot.left;
      elements.dot.style.top = dot.top;
      elements.valueText.textContent = origin?.label ?? "";
      elements.rotationLabel.textContent = `Rotation: ${rotatePerc}%`;
    }

    renderCurrent = render;
    render();
  }

  let renderCurrent = () => {};

  function setupSelect(trigger, onValueChange) {
    const shadow = root.getRootNode();
    let wrapper = null;
    let content = null;
    let pointerStart = null;
    let highlighted = -1;

    function place() {
      const rect = trigger.getBoundingClientRect();
      const below = innerHeight - rect.bottom;
      const above = rect.top;
      const height = content.offsetHeight;
      const side = height > below && above > below ? "top" : "bottom";
      const y = side === "bottom" ? rect.bottom : rect.top - height;
      wrapper.style.transform = `translate(${rect.left}px, ${y}px)`;
      content.dataset.side = side;
      content.style.setProperty("--radix-select-trigger-width", `${rect.width}px`);
      content.style.setProperty("--radix-select-trigger-height", `${rect.height}px`);
      content.style.setProperty(
        "--radix-select-content-available-height",
        `${side === "bottom" ? below : above}px`,
      );
      content.style.setProperty(
        "--radix-select-content-transform-origin",
        side === "bottom" ? "0% 0px" : "0% 100%",
      );
    }

    function items() {
      return content ? [...content.querySelectorAll("[role=option]")] : [];
    }

    function highlight(index) {
      const list = items();
      highlighted = Math.max(0, Math.min(list.length - 1, index));
      for (const [position, item] of list.entries()) {
        if (position === highlighted) {
          item.dataset.highlighted = "";
          item.focus({ preventScroll: true });
        } else {
          delete item.dataset.highlighted;
        }
      }
    }

    function open(fromPointer) {
      if (content) {
        return;
      }
      trigger.dataset.state = "open";
      trigger.setAttribute("aria-expanded", "true");
      wrapper = document.createElement("div");
      wrapper.dataset.radixPopperContentWrapper = "";
      wrapper.style.cssText =
        "position: fixed; left: 0px; top: 0px; min-width: max-content; z-index: 10001;";
      wrapper.innerHTML = `<div role="listbox" data-select-content data-slot="select-content" data-state="open" data-side="bottom" data-align="start" dir="ltr" tabindex="-1" class="${contentClass}" style="box-sizing: border-box; display: flex; flex-direction: column; outline: none; pointer-events: auto;"><div role="presentation" data-radix-select-viewport class="${viewportClass}" style="position: relative; flex: 1 1 0%; overflow: hidden auto;">${origins
        .map((origin) => {
          const checked = origin.value === trigger.dataset.value;
          return `<div role="option" data-slot="select-item" data-value="${escapeHtml(origin.value)}" aria-selected="${checked}" data-state="${checked ? "checked" : "unchecked"}" tabindex="-1" class="${itemClass}"><span class="absolute right-2 flex size-3.5 items-center justify-center">${checked ? `<span aria-hidden="true">${icon(Check, "size-4")}</span>` : ""}</span><span>${escapeHtml(origin.label)}</span></div>`;
        })
        .join("")}</div></div>`;
      content = wrapper.firstElementChild;
      shadow.append(wrapper);
      place();
      const list = items();
      highlight(
        Math.max(
          0,
          list.findIndex((item) => item.dataset.state === "checked"),
        ),
      );
      pointerStart = fromPointer;
      content.addEventListener("pointermove", (event) => {
        const item = event.target.closest("[role=option]");
        if (item) {
          highlight(items().indexOf(item));
        }
      });
      content.addEventListener("pointerleave", () => content?.focus({ preventScroll: true }));
      content.addEventListener("pointerup", (event) => {
        const item = event.target.closest("[role=option]");
        if (!item) {
          return;
        }
        if (
          pointerStart &&
          Math.abs(event.clientX - pointerStart.x) <= 10 &&
          Math.abs(event.clientY - pointerStart.y) <= 10
        ) {
          pointerStart = null;
          return;
        }
        select(item.dataset.value);
      });
      content.addEventListener("pointerdown", () => {
        pointerStart = null;
      });
      content.addEventListener("keydown", (event) => {
        const moves = { ArrowDown: 1, ArrowUp: -1 };
        if (event.key in moves) {
          highlight(highlighted + moves[event.key]);
        } else if (event.key === "Home") {
          highlight(0);
        } else if (event.key === "End") {
          highlight(items().length - 1);
        } else if (event.key === "Enter" || event.key === " ") {
          select(items()[highlighted]?.dataset.value);
        } else if (event.key === "Escape" || event.key === "Tab") {
          close();
        } else {
          return;
        }
        event.preventDefault();
      });
      addEventListener("pointerdown", outside, true);
      addEventListener("resize", close);
      addEventListener("scroll", reposition, true);
    }

    function reposition() {
      if (content) {
        place();
      }
    }

    function outside(event) {
      if (!event.composedPath().some((node) => node === wrapper || node === trigger)) {
        close();
      }
    }

    function select(value) {
      if (value === undefined) {
        return;
      }
      const changed = value !== trigger.dataset.value;
      trigger.dataset.value = value;
      close();
      if (changed) {
        onValueChange(value);
      }
    }

    function close() {
      if (!content) {
        return;
      }
      removeEventListener("pointerdown", outside, true);
      removeEventListener("resize", close);
      removeEventListener("scroll", reposition, true);
      trigger.dataset.state = "closed";
      trigger.setAttribute("aria-expanded", "false");
      const closing = wrapper;
      content.dataset.state = "closed";
      content.style.pointerEvents = "none";
      content = null;
      wrapper = null;
      closing.firstElementChild.addEventListener("animationend", () => closing.remove(), {
        once: true,
      });
      setTimeout(() => closing.remove(), 300);
      trigger.focus({ preventScroll: true });
    }

    trigger.dataset.value = selectedOrigin;
    trigger.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.ctrlKey) {
        return;
      }
      if (event.pointerType === "mouse") {
        event.preventDefault();
        if (content) {
          close();
        } else {
          trigger.focus({ preventScroll: true });
          open({ x: event.clientX, y: event.clientY });
        }
      }
    });
    trigger.addEventListener("click", (event) => {
      if (event.pointerType && event.pointerType !== "mouse" && !content) {
        open(null);
      }
    });
    trigger.addEventListener("keydown", (event) => {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        open(null);
      }
    });

    return () => {
      if (content) {
        removeEventListener("pointerdown", outside, true);
        removeEventListener("resize", close);
        removeEventListener("scroll", reposition, true);
        wrapper.remove();
        content = null;
        wrapper = null;
      }
    };
  }

  build();
  later(() => {
    animate = true;
    renderCurrent();
  }, 500);

  return {
    replay() {
      animate = false;
      build();
      later(() => {
        animate = true;
        renderCurrent();
      }, 100);
    },
    destroy() {
      cleanupSelect();
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
    },
  };
}

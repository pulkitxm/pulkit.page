import { closestTarget, queryAll, ref } from "../lib/dom.ts";
import { stage } from "../lib/layout.ts";
import { button, buttonClass, html } from "../runtime/ui.ts";
import type { DemoMount } from "../types.ts";

const shapeOptions = {
  circle: { clipPath: "inset(5% 5% 5% 5% round 9999px)", label: "circle" },
  ellipse: { clipPath: "inset(12% 5% 12% 5% round 9999px)", label: "ellipse" },
  inset: { clipPath: "inset(12% 18% 12% 18% round 12px)", label: "inset" },
  none: { clipPath: "inset(0% 0% 0% 0% round 0px)", label: "none" },
};

type Shape = keyof typeof shapeOptions;

const shapeOrder: readonly Shape[] = ["none", "circle", "ellipse", "inset"];
const inlineCode = "rounded bg-neutral-200 px-1 text-xs dark:bg-neutral-800";

function isShape(value: string | undefined): value is Shape {
  return shapeOrder.some((shape) => shape === value);
}

export const mount: DemoMount = (root) => {
  let shape: Shape = "circle";
  root.innerHTML = stage(
    "gap-6 p-6",
    html`
    <div class="flex flex-wrap justify-center gap-2">
      ${shapeOrder.map((id) => button({ size: "sm", label: shapeOptions[id].label, attrs: `data-select="${id}"` }))}
    </div>
    <div
      data-ref="box"
      class="flex size-48 max-w-full items-center justify-center rounded-xl border border-neutral-200 bg-linear-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg dark:border-neutral-700"
      style="transition: clip-path 0.5s cubic-bezier(0.22, 1, 0.36, 1)"
    ><span class="font-medium text-sm">content</span></div>
    <code data-ref="code" class="rounded-md bg-neutral-100 px-3 py-1.5 text-neutral-800 text-xs dark:bg-neutral-800 dark:text-neutral-200"></code>
    <p class="max-w-md text-center text-neutral-600 text-sm dark:text-neutral-400">The box keeps the same layout box. Only painting is clipped, like transforms skipping layout. These presets all use <code class="${inlineCode}">inset()</code> so <code class="${inlineCode}">clip-path</code> can transition; mixing <code class="${inlineCode}">circle()</code>, <code class="${inlineCode}">ellipse()</code>, and <code class="${inlineCode}">none</code> in one element typically does not interpolate.</p>
  `,
  );
  const box = ref(root, "box", HTMLDivElement);
  const code = ref(root, "code", HTMLElement);

  function render() {
    for (const element of queryAll(root, "[data-select]", HTMLButtonElement)) {
      element.className = buttonClass({
        variant: shape === element.dataset.select ? "default" : "outline",
        size: "sm",
      });
    }
    box.style.clipPath = shapeOptions[shape].clipPath;
    code.textContent = `clip-path: ${shapeOptions[shape].clipPath}`;
  }

  root.addEventListener("click", (event) => {
    const id = closestTarget(event, "[data-select]", HTMLElement)?.dataset.select;
    if (isShape(id)) {
      shape = id;
      render();
    }
  });
  render();
};

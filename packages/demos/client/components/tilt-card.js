import { html, refs } from "../runtime/ui.ts";

export function mount(root) {
  let rotation = { x: 0, y: 0 };
  let isHovering = false;
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-6">
    <div class="flex items-center justify-center" style="perspective: 1000px">
      <div data-ref="card" role="img" aria-label="Interactive 3D tilt card demo" class="relative flex h-48 w-64 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 p-6 shadow-2xl">
        <div class="absolute inset-0 rounded-xl bg-white/10 backdrop-blur-sm" style="transform: translateZ(2px)"></div>
        <div class="relative text-center" style="transform: translateZ(30px)">
          <h3 class="font-bold text-white text-xl">Tilt Card</h3>
          <p class="mt-2 text-sm text-white/80">Move your mouse over me</p>
        </div>
        <div class="absolute right-4 bottom-4 left-4 flex justify-between text-white/60 text-xs" style="transform: translateZ(20px)">
          <span data-ref="xLabel"></span>
          <span data-ref="yLabel"></span>
        </div>
      </div>
    </div>
    <p class="max-w-md text-center text-neutral-500 text-xs dark:text-neutral-400">Hover and move your mouse to see the card tilt. Uses rotateX and rotateY with perspective for 3D depth.</p>
  </div>`;
  const { card, xLabel, yLabel } = refs(root);

  function render() {
    card.style.transform = `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`;
    card.style.transformStyle = "preserve-3d";
    card.style.transition = isHovering ? "transform 0.1s ease-out" : "transform 0.3s ease-out";
    xLabel.textContent = `rotateX: ${rotation.x.toFixed(1)}°`;
    yLabel.textContent = `rotateY: ${rotation.y.toFixed(1)}°`;
  }

  card.addEventListener("mousemove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    rotation = {
      x: ((y - centerY) / centerY) * -15,
      y: ((x - centerX) / centerX) * 15,
    };
    render();
  });
  card.addEventListener("mouseleave", () => {
    rotation = { x: 0, y: 0 };
    isHovering = false;
    render();
  });
  card.addEventListener("mouseenter", () => {
    isHovering = true;
    render();
  });
  render();
}

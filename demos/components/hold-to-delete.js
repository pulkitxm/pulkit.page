import { button, html } from "../runtime/ui.js";

function holdButton(fillClass) {
  return button({
    variant: "destructive",
    className: "group relative overflow-hidden bg-red-600 hover:bg-red-600",
    label: `<span class="${fillClass}"></span><span class="relative">Hold to Delete</span>`,
  });
}

export function mount(root) {
  root.innerHTML = html`<div class="flex size-full flex-col items-center justify-center gap-6 p-4">
    <div class="flex gap-8">
      <div class="flex flex-col items-center gap-3">
        ${holdButton("absolute inset-0 origin-left scale-x-0 bg-red-800 transition-transform duration-1000 ease-linear group-active:scale-x-100")}
        <span class="text-neutral-600 text-xs dark:text-neutral-300">Linear (correct)</span>
      </div>
      <div class="flex flex-col items-center gap-3">
        ${holdButton("absolute inset-0 origin-left scale-x-0 bg-red-800 transition-transform duration-1000 ease-in-out group-active:scale-x-100")}
        <span class="text-neutral-600 text-xs dark:text-neutral-300">Ease-in-out (wrong)</span>
      </div>
    </div>
    <p class="max-w-sm text-center text-neutral-600 text-sm dark:text-neutral-300">Hold each button. Linear feels predictable because time passes linearly.</p>
  </div>`;
}

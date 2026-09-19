import { animate } from "motion";
import { buttonClass, html, refs } from "../runtime/ui.ts";

const marketingButton =
  "bg-linear-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600";

const variants = {
  marketing: {
    backdrop: {
      className: "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm",
      transition: { duration: 0.3 },
    },
    content: html`<div data-ref="content">
      <p class="mb-3 font-medium text-sm">Memorable and expressive</p>
      <button type="button" data-close class="${buttonClass({ className: `w-full ${marketingButton}`, size: "sm" })}">Got it</button>
    </div>`,
    modal: {
      animate: { opacity: 1, scale: 1, y: 0 },
      className:
        "absolute top-full left-1/2 z-50 mt-2 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-purple-200 bg-linear-to-br from-white to-purple-50 p-4 shadow-2xl dark:border-purple-800 dark:from-neutral-800 dark:to-purple-900/20",
      exit: { opacity: 0, scale: 0.9, y: 10 },
      initial: { opacity: 0, scale: 0.8, y: 20 },
      transition: {
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
        scale: { damping: 25, stiffness: 300, type: "spring" },
      },
    },
  },
  product: {
    backdrop: {
      className: "fixed inset-0 z-40 bg-black/20",
      transition: { duration: 0.15 },
    },
    content: html`<p class="mb-3 text-sm">Quick and functional</p>
      <button type="button" data-close class="${buttonClass({ className: "w-full", size: "sm" })}">Close</button>`,
    modal: {
      animate: { opacity: 1, scale: 1 },
      className:
        "absolute top-full left-1/2 z-50 mt-2 w-48 -translate-x-1/2 rounded-lg border border-neutral-300 bg-white p-4 shadow-xl dark:border-neutral-600 dark:bg-neutral-800",
      exit: { opacity: 0, scale: 0.95 },
      initial: { opacity: 0, scale: 0.95 },
      transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] },
    },
  },
};

function createPresence(anchor, variant) {
  let current = null;

  function open() {
    if (current?.exiting) {
      current.exiting = false;
      for (const animation of current.animations) {
        animation.stop();
      }
      current.animations = [
        animate(current.backdrop, { opacity: 1 }, variant.backdrop.transition),
        animate(current.modal, variant.modal.animate, variant.modal.transition),
      ];
      return;
    }
    if (current) {
      return;
    }
    const backdrop = document.createElement("div");
    backdrop.className = variant.backdrop.className;
    backdrop.style.opacity = "0";
    backdrop.addEventListener("click", close);
    const modal = document.createElement("div");
    modal.className = variant.modal.className;
    modal.innerHTML = variant.content;
    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-close]")) {
        close();
      }
    });
    anchor.append(backdrop, modal);
    animate(modal, variant.modal.initial, { duration: 0 });
    const { content } = refs(modal);
    if (content) {
      animate(content, { opacity: 0, y: 10 }, { duration: 0 });
      animate(content, { opacity: 1, y: 0 }, { delay: 0.1 });
    }
    current = {
      animations: [
        animate(backdrop, { opacity: 1 }, variant.backdrop.transition),
        animate(modal, variant.modal.animate, variant.modal.transition),
      ],
      backdrop,
      exiting: false,
      modal,
    };
  }

  function close() {
    if (!current || current.exiting) {
      return;
    }
    const entry = current;
    entry.exiting = true;
    for (const animation of entry.animations) {
      animation.stop();
    }
    entry.animations = [
      animate(entry.backdrop, { opacity: 0 }, variant.backdrop.transition),
      animate(entry.modal, variant.modal.exit, variant.modal.transition),
    ];
    Promise.all(entry.animations).then(() => {
      if (current === entry && entry.exiting) {
        entry.backdrop.remove();
        entry.modal.remove();
        current = null;
      }
    });
  }

  return { open };
}

export function mount(root) {
  root.innerHTML = html`<div class="flex size-full items-center justify-center gap-8 p-4">
    <div class="flex flex-col items-center gap-3">
      <span class="font-medium text-neutral-600 text-xs dark:text-neutral-400">Product UI</span>
      <div data-ref="product" class="relative">
        <button type="button" data-ref="productOpen" class="${buttonClass({ variant: "secondary" })}">Open Modal</button>
      </div>
      <span class="text-neutral-600 text-xs dark:text-neutral-400">150ms, subtle</span>
    </div>
    <div class="h-24 w-px bg-neutral-300 dark:bg-neutral-700"></div>
    <div class="flex flex-col items-center gap-3">
      <span class="font-medium text-neutral-600 text-xs dark:text-neutral-400">Marketing Page</span>
      <div data-ref="marketing" class="relative">
        <button type="button" data-ref="marketingOpen" class="${buttonClass({ className: marketingButton })}">Learn More</button>
      </div>
      <span class="text-neutral-600 text-xs dark:text-neutral-400">400ms, expressive</span>
    </div>
  </div>`;
  const { product, productOpen, marketing, marketingOpen } = refs(root);
  const productPresence = createPresence(product, variants.product);
  const marketingPresence = createPresence(marketing, variants.marketing);
  productOpen.addEventListener("click", productPresence.open);
  marketingOpen.addEventListener("click", marketingPresence.open);
}

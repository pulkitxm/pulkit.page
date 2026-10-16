import { lucideSvg } from "@pulkit/shared/icons";
import { CircleAlert, CircleCheck } from "lucide";

const visibleFor = 4000;

function region(): HTMLElement {
  const existing = document.querySelector<HTMLElement>("[data-toasts]");
  if (existing) {
    return existing;
  }
  const created = document.createElement("section");
  created.dataset.toasts = "";
  created.setAttribute("aria-label", "Notifications");
  created.setAttribute("aria-live", "polite");
  created.className =
    "pointer-events-none fixed right-4 bottom-4 z-50 flex w-[356px] max-w-[calc(100vw-2rem)] flex-col gap-2";
  document.body.append(created);
  return created;
}

export function toast(message: string, tone: "success" | "error" = "success"): void {
  const item = document.createElement("div");
  item.className =
    "pointer-events-auto flex items-center gap-2 rounded-[8px] border border-line bg-bg px-4 py-3 text-md text-fg shadow-[0_4px_12px_rgb(0_0_0/0.1)] transition-[opacity,translate] duration-300 starting:translate-y-2 starting:opacity-0";
  item.innerHTML =
    tone === "success"
      ? lucideSvg(CircleCheck, "size-4 shrink-0 text-[#22c55e]")
      : lucideSvg(CircleAlert, "size-4 shrink-0 text-[#ef4444]");
  item.append(message);
  region().append(item);
  setTimeout(() => {
    item.classList.add("opacity-0");
    setTimeout(() => item.remove(), 300);
  }, visibleFor);
}

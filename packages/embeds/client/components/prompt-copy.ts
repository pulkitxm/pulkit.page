import { lucideSvg } from "@pulkit/shared/icons";
import { Check, Copy } from "lucide";
import { toast } from "../lib/toast.ts";

const resetDelay = 2000;

async function promptText(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Prompt replied ${response.status}`);
  }
  return new Blob([await response.text()], { type: "text/plain" });
}

export function setupPromptCopy(button: HTMLButtonElement): void {
  const icon = button.querySelector("svg");
  const size = icon?.getAttribute("class") ?? "size-4";
  const url = button.dataset.prompt ?? "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const showIcon = (copied: boolean): void => {
    button.querySelector("svg")?.remove();
    button.insertAdjacentHTML(
      "afterbegin",
      copied ? lucideSvg(Check, `${size} text-[#22c55e]`) : lucideSvg(Copy, size),
    );
  };
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.busy) {
      return;
    }
    button.dataset.busy = "true";
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": promptText(url) })]);
      showIcon(true);
      toast("Prompt copied to clipboard");
      clearTimeout(timer);
      timer = setTimeout(() => {
        showIcon(false);
        delete button.dataset.busy;
      }, resetDelay);
    } catch {
      delete button.dataset.busy;
      toast("Couldn't copy the prompt", "error");
    }
  });
  button.hidden = false;
}

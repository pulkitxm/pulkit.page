const resetDelay = 2000;

async function promptText(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Prompt replied ${response.status}`);
  }
  return new Blob([await response.text()], { type: "text/plain" });
}

export function setupPromptCopy(button: HTMLButtonElement): void {
  const idle = button.textContent ?? "";
  const url = button.dataset.prompt ?? "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const show = (label: string): void => {
    button.textContent = label;
    clearTimeout(timer);
    timer = setTimeout(() => {
      button.textContent = idle;
      button.disabled = false;
    }, resetDelay);
  };
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Copying…";
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": promptText(url) })]);
      show("Copied");
    } catch {
      show("Copy failed, use Read the prompt");
    }
  });
  button.hidden = false;
}

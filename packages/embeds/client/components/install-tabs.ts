import { readStoredJson, writeStoredJson } from "@pulkit/shared/storage";
import { attachCopyButton } from "../lib/copy-feedback.ts";
import { findElement, findElements, requireElement } from "../lib/dom.ts";

const storageKey = "preferred-package-manager";
const managers: readonly unknown[] = ["bun", "pnpm", "npm", "yarn"];

function readPreference(): string {
  const stored = readStoredJson(storageKey);
  return typeof stored === "string" && managers.includes(stored) ? stored : "bun";
}

function select(roots: readonly HTMLElement[], manager: string): void {
  for (const root of roots) {
    for (const button of findElements(root, "[data-install-manager]", HTMLElement)) {
      button.setAttribute("aria-pressed", String(button.dataset.installManager === manager));
    }
    for (const block of findElements(root, "[data-install-command]", HTMLElement)) {
      block.hidden = block.dataset.installCommand !== manager;
    }
  }
}

function setupRoot(roots: readonly HTMLElement[], root: HTMLElement): void {
  for (const button of findElements(root, "[data-install-manager]", HTMLElement)) {
    button.addEventListener("click", () => {
      const manager = button.dataset.installManager ?? "";
      writeStoredJson(storageKey, manager);
      select(roots, manager);
    });
  }
  attachCopyButton(
    requireElement(root, "[data-install-copy]", HTMLElement),
    () => findElement(root, "[data-install-command]:not([hidden])", HTMLElement)?.textContent ?? "",
  );
}

export function setupInstallTabs(roots: readonly HTMLElement[]): void {
  for (const root of roots) {
    setupRoot(roots, root);
  }
  addEventListener("storage", (event) => {
    if (event instanceof StorageEvent && event.key === storageKey) {
      select(roots, readPreference());
    }
  });
  select(roots, readPreference());
}

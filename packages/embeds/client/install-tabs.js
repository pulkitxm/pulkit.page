const storageKey = "preferred-package-manager";
const managers = ["bun", "pnpm", "npm", "yarn"];

function readPreference() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return managers.includes(stored) ? stored : "bun";
  } catch {
    return "bun";
  }
}

function writePreference(manager) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(manager));
  } catch {}
}

const roots = [...document.querySelectorAll("[data-install-tabs]")];

function select(manager) {
  for (const root of roots) {
    for (const button of root.querySelectorAll("[data-install-manager]")) {
      button.setAttribute("aria-pressed", String(button.dataset.installManager === manager));
    }
    for (const block of root.querySelectorAll("[data-install-command]")) {
      block.hidden = block.dataset.installCommand !== manager;
    }
  }
}

for (const root of roots) {
  for (const button of root.querySelectorAll("[data-install-manager]")) {
    button.addEventListener("click", () => {
      writePreference(button.dataset.installManager);
      select(button.dataset.installManager);
    });
  }
  const copy = root.querySelector("[data-install-copy]");
  let timer;
  copy.addEventListener("click", async () => {
    const block = root.querySelector("[data-install-command]:not([hidden])");
    await navigator.clipboard.writeText(block.textContent);
    copy.setAttribute("aria-label", "Copied");
    copy.querySelector("[data-copy-idle]").classList.add("hidden");
    copy.querySelector("[data-copy-done]").classList.remove("hidden");
    clearTimeout(timer);
    timer = setTimeout(() => {
      copy.setAttribute("aria-label", "Copy to clipboard");
      copy.querySelector("[data-copy-idle]").classList.remove("hidden");
      copy.querySelector("[data-copy-done]").classList.add("hidden");
    }, 1500);
  });
}

window.addEventListener("storage", (event) => {
  if (event.key === storageKey) {
    select(readPreference());
  }
});

select(readPreference());

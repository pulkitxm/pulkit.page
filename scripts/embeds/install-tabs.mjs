const codeFont = "[font:0.84em/1.65_var(--font-mono)]";
const managers = ["bun", "pnpm", "npm", "yarn"];
const commandVerbs = { bun: "add", npm: "install", pnpm: "add", yarn: "add" };
const iconAttributes =
  'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const copyIcon = `<svg ${iconAttributes} class="size-3.5" data-copy-idle><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const checkIcon = `<svg ${iconAttributes} class="hidden size-3.5" data-copy-done><path d="M20 6 9 17l-5-5"/></svg>`;

function highlightCommand(command, escapeHtml) {
  return command
    .split(/( +)/)
    .map((part, index) => {
      if (!part.trim()) {
        return part;
      }
      const role = index === 0 ? "text-syn-f" : "text-syn-s";
      return `<span class="${role}">${escapeHtml(part)}</span>`;
    })
    .join("");
}

export function render({ packages, manualCode, manualTitle }, { assets, escapeHtml }) {
  if (manualCode || manualTitle) {
    throw new Error("install-tabs manual steps are not supported");
  }
  assets.script("/assets/embeds/install-tabs.js");
  const commands = Object.fromEntries(
    managers.map((manager) => [manager, `${manager} ${commandVerbs[manager]} ${packages}`]),
  );
  const buttons = managers
    .map(
      (manager, index) =>
        `<button type="button" class="cursor-pointer rounded-md border-0 bg-transparent px-3 py-1.5 font-medium font-mono text-muted text-xs hover:text-fg aria-pressed:bg-bg aria-pressed:text-fg aria-pressed:shadow-[0_1px_3px_0_rgb(0_0_0/0.1),0_1px_2px_-1px_rgb(0_0_0/0.1)]" aria-pressed="${index === 0}" data-install-manager="${manager}">${manager}</button>`,
    )
    .join("");
  const blocks = managers
    .map(
      (manager, index) =>
        `<pre tabindex="0" class="m-0 overflow-x-auto rounded-lg border border-line bg-surface p-5 pr-12" data-install-command="${manager}"${index === 0 ? "" : " hidden"}><code class="bash rounded-sm ${codeFont} [tab-size:2]">${highlightCommand(commands[manager], escapeHtml)}</code></pre>`,
    )
    .join("");
  return `<div class="mt-6 mb-6 space-y-4" data-install-tabs><div class="flex w-max items-center gap-1 rounded-lg border border-line bg-surface p-1">${buttons}</div><div class="relative"><button type="button" class="absolute top-3 right-3 z-10 inline-flex size-7 cursor-pointer border-0 bg-transparent p-0 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-line hover:text-fg" aria-label="Copy to clipboard" data-install-copy>${copyIcon}${checkIcon}</button>${blocks}</div></div>`;
}

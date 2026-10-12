import { components } from "./registry.ts";
import { parseFrame, parseProps, parseSources } from "./runtime/dataset.ts";
import { type Frame, mountFrame } from "./runtime/frame.ts";
import { button } from "./runtime/ui.ts";
import type { DemoHandle, DemoModule } from "./types.ts";

type LoadState = "loading" | "ready" | "failed";

const stylesheet = fetch(new URL("demos.css", import.meta.url))
  .then((response) => response.text())
  .then((text) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    return sheet;
  });

const darkQuery = matchMedia("(prefers-color-scheme: dark)");
const hosts = new Set<HTMLElement>();

function isDark(): boolean {
  const theme = document.documentElement.dataset.theme;
  return theme === "dark" || (theme !== "light" && darkQuery.matches);
}

function syncTheme(): void {
  const dark = isDark();
  for (const host of hosts) {
    if (host.hasAttribute("data-dark") !== dark) {
      host.toggleAttribute("data-theme-switching", true);
      host.toggleAttribute("data-dark", dark);
      void getComputedStyle(host.shadowRoot?.firstElementChild ?? host).color;
      requestAnimationFrame(() => host.toggleAttribute("data-theme-switching", false));
    }
  }
}

darkQuery.addEventListener("change", syncTheme);
new MutationObserver(syncTheme).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});

const panelClass = "flex flex-col items-center gap-3 p-6 text-center";
const noteClass = "max-w-xs text-balance text-muted-foreground text-sm";

let sequence = 0;

class DemoShowcaseElement extends HTMLElement {
  private frame: Frame | undefined;
  private instance: DemoHandle | undefined;
  private module: DemoModule | undefined;
  private state: LoadState | undefined;
  private wired = false;
  private sequence = 0;

  connectedCallback(): void {
    hosts.add(this);
    this.toggleAttribute("data-dark", isDark());
    if (!this.frame) {
      visibility.observe(this);
    }
  }

  disconnectedCallback(): void {
    hosts.delete(this);
    visibility.unobserve(this);
    this.instance?.destroy?.();
    this.instance = undefined;
    this.frame?.destroy();
    this.frame = undefined;
    this.state = undefined;
  }

  async reveal(): Promise<void> {
    if (this.frame) {
      return;
    }
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    const sheet = await stylesheet;
    if (!this.isConnected || this.frame) {
      return;
    }
    shadow.adoptedStyleSheets = [sheet];
    if (!this.wired) {
      this.wired = true;
      sequence += 1;
      this.sequence = sequence;
      shadow.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        if (target.closest('[data-action="replay"]')) {
          this.replay();
        } else if (target.closest('[data-action="run"]')) {
          void this.launch();
        }
      });
    }
    this.frame = mountFrame(shadow, {
      frame: parseFrame(this.dataset.frame),
      files: parseSources(this.querySelector('script[type="application/json"]')?.textContent),
      id: this.sequence,
    });
    this.dataset.ready = "";
    if (this.dataset.heavy === undefined) {
      await this.launch();
    } else {
      this.offer();
    }
  }

  private panel(markup: string): void {
    const panel = document.createElement("div");
    panel.className = panelClass;
    panel.innerHTML = markup;
    this.frame?.preview.replaceChildren(panel);
  }

  private offer(): void {
    const note = `demo-note-${this.sequence}`;
    this.panel(
      `${button({
        label: "Run the physics demo",
        attrs: `data-action="run" aria-describedby="${note}"`,
      })}<p id="${note}" class="${noteClass}">Interactive 3D physics. Running it downloads about 1.2 MB of code.</p>`,
    );
  }

  private fail(): void {
    this.state = "failed";
    this.panel(
      `<p class="${noteClass}" role="alert">This demo could not be loaded.</p>${button({
        variant: "secondary",
        label: "Try again",
        attrs: 'data-action="run"',
      })}`,
    );
  }

  private async launch(): Promise<void> {
    if (this.state === "loading" || this.state === "ready") {
      return;
    }
    this.state = "loading";
    if (this.dataset.heavy !== undefined) {
      this.panel(`<p class="${noteClass}" role="status">Loading the demo...</p>`);
    }
    try {
      await this.start();
      this.state = "ready";
    } catch {
      this.fail();
    }
  }

  private async start(): Promise<void> {
    const name = this.dataset.component ?? "";
    const load = components[name];
    if (!load) {
      throw new Error(`Unknown demo component: ${name}`);
    }
    this.module = await load();
    if (this.frame) {
      this.mount();
    }
  }

  private mount(): void {
    this.instance?.destroy?.();
    const frame = this.frame;
    const module = this.module;
    if (!(frame && module)) {
      return;
    }
    const root = document.createElement("div");
    root.style.display = "contents";
    frame.preview.replaceChildren(root);
    this.instance = module.mount(root, parseProps(this.dataset.props)) ?? {};
  }

  private replay(): void {
    if (!this.module) {
      return;
    }
    if (this.instance?.replay) {
      this.instance.replay();
    } else {
      this.mount();
    }
  }
}

const visibility = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.target instanceof DemoShowcaseElement) {
        visibility.unobserve(entry.target);
        void entry.target.reveal();
      }
    }
  },
  { rootMargin: "400px 0px" },
);

customElements.define("demo-showcase", DemoShowcaseElement);

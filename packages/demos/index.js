import { components } from "./registry.js";
import { mountFrame } from "./runtime/frame.js";
import { button } from "./runtime/ui.js";

const stylesheet = fetch(new URL("demos.css", import.meta.url))
  .then((response) => response.text())
  .then((text) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    return sheet;
  });

const darkQuery = matchMedia("(prefers-color-scheme: dark)");
const hosts = new Set();

function isDark() {
  const theme = document.documentElement.dataset.theme;
  return theme === "dark" || (theme !== "light" && darkQuery.matches);
}

function syncTheme() {
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

const visibility = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        visibility.unobserve(entry.target);
        entry.target.reveal();
      }
    }
  },
  { rootMargin: "400px 0px" },
);

const panelClass = "flex flex-col items-center gap-3 p-6 text-center";
const noteClass = "max-w-xs text-balance text-muted-foreground text-sm";

let sequence = 0;

class DemoShowcaseElement extends HTMLElement {
  connectedCallback() {
    hosts.add(this);
    this.toggleAttribute("data-dark", isDark());
    if (!this.frame) {
      visibility.observe(this);
    }
  }

  disconnectedCallback() {
    hosts.delete(this);
    visibility.unobserve(this);
    this.instance?.destroy?.();
    this.instance = undefined;
    this.frame?.destroy();
    this.frame = undefined;
    this.state = undefined;
  }

  async reveal() {
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
        if (event.target.closest('[data-action="replay"]')) {
          this.replay();
        } else if (event.target.closest('[data-action="run"]')) {
          this.launch();
        }
      });
    }
    this.frame = mountFrame(shadow, {
      frame: JSON.parse(this.dataset.frame ?? "{}"),
      files: JSON.parse(this.querySelector('script[type="application/json"]')?.textContent ?? "[]"),
      id: this.sequence,
    });
    this.dataset.ready = "";
    if (this.dataset.heavy === undefined) {
      await this.launch();
    } else {
      this.offer();
    }
  }

  panel(markup) {
    const panel = document.createElement("div");
    panel.className = panelClass;
    panel.innerHTML = markup;
    this.frame.preview.replaceChildren(panel);
  }

  offer() {
    const note = `demo-note-${this.sequence}`;
    this.panel(
      `${button({
        label: "Run the physics demo",
        attrs: `data-action="run" aria-describedby="${note}"`,
      })}<p id="${note}" class="${noteClass}">Interactive 3D physics. Running it downloads about 1.2 MB of code.</p>`,
    );
  }

  fail() {
    this.state = "failed";
    this.panel(
      `<p class="${noteClass}" role="alert">This demo could not be loaded.</p>${button({
        variant: "secondary",
        label: "Try again",
        attrs: 'data-action="run"',
      })}`,
    );
  }

  async launch() {
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

  async start() {
    const load = components[this.dataset.component];
    if (!load) {
      throw new Error(`Unknown demo component: ${this.dataset.component}`);
    }
    this.module = await load();
    if (this.frame) {
      this.mount();
    }
  }

  mount() {
    this.instance?.destroy?.();
    const root = document.createElement("div");
    root.style.display = "contents";
    this.frame.preview.replaceChildren(root);
    this.instance = this.module.mount(root, JSON.parse(this.dataset.props ?? "{}")) ?? {};
  }

  replay() {
    if (!this.module) {
      return;
    }
    if (this.instance.replay) {
      this.instance.replay();
    } else {
      this.mount();
    }
  }
}

customElements.define("demo-showcase", DemoShowcaseElement);

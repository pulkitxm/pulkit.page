import { components } from "./registry.js";
import { mountFrame } from "./runtime/frame.js";

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
        entry.target.start();
      }
    }
  },
  { rootMargin: "400px 0px" },
);

let sequence = 0;

class DemoShowcaseElement extends HTMLElement {
  async connectedCallback() {
    if (this.shadowRoot) {
      return;
    }
    hosts.add(this);
    this.toggleAttribute("data-dark", isDark());
    const shadow = this.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [await stylesheet];
    const files = JSON.parse(
      this.querySelector('script[type="application/json"]')?.textContent ?? "[]",
    );
    sequence += 1;
    this.preview = mountFrame(shadow, {
      frame: JSON.parse(this.dataset.frame ?? "{}"),
      files,
      id: sequence,
    });
    shadow.addEventListener("click", (event) => {
      if (event.target.closest('[data-action="replay"]')) {
        this.replay();
      }
    });
    this.dataset.ready = "";
    visibility.observe(this);
  }

  disconnectedCallback() {
    hosts.delete(this);
  }

  async start() {
    const load = components[this.dataset.component];
    if (!load) {
      throw new Error(`Unknown demo component: ${this.dataset.component}`);
    }
    this.module = await load();
    this.mount();
  }

  mount() {
    this.instance?.destroy?.();
    const root = document.createElement("div");
    root.style.display = "contents";
    this.preview.replaceChildren(root);
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

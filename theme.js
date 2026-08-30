(() => {
  const root = document.documentElement;
  const preference = window.matchMedia("(prefers-color-scheme: dark)");
  const storageKey = "pulkit-theme";

  const readSavedTheme = () => {
    try {
      const value = localStorage.getItem(storageKey);
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  };

  const saveTheme = (theme) => {
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      return;
    }
  };

  const preferredTheme = () => readSavedTheme() || (preference.matches ? "dark" : "light");

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    const themeColor = document.querySelector('meta[name="theme-color"]');
    const toggle = document.querySelector("[data-theme-toggle]");

    themeColor?.setAttribute("content", theme === "dark" ? "#2d1a14" : "#f2eadf");

    if (toggle) {
      toggle.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`);
      toggle.setAttribute("aria-pressed", String(theme === "dark"));
      toggle.querySelector("span").textContent = theme === "dark" ? "Light" : "Dark";
    }
  };

  applyTheme(preferredTheme());

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(preferredTheme());

    document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
      const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
      saveTheme(nextTheme);
      applyTheme(nextTheme);
    });
  });

  preference.addEventListener("change", () => {
    if (!readSavedTheme()) {
      applyTheme(preferredTheme());
    }
  });
})();

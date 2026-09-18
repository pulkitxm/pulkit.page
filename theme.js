const themeKey = "portfolio-theme";
let selectedTheme;
try {
  selectedTheme = localStorage.getItem(themeKey);
} catch {}
if (selectedTheme === "light" || selectedTheme === "dark") {
  document.documentElement.dataset.theme = selectedTheme;
}
document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector("[data-theme-toggle]");
  button?.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(themeKey, theme);
    } catch {}
  });
});

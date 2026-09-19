for (const button of document.querySelectorAll("[data-code-copy]")) {
  const lines = button.closest("[data-code-block]").querySelector("code").children;
  const idle = button.querySelector("[data-copy-idle]");
  const done = button.querySelector("[data-copy-done]");
  let timer;
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText([...lines].map((line) => line.textContent).join("\n"));
    button.setAttribute("aria-label", "Copied");
    idle.classList.add("hidden");
    done.classList.remove("hidden");
    clearTimeout(timer);
    timer = setTimeout(() => {
      button.setAttribute("aria-label", "Copy to clipboard");
      idle.classList.remove("hidden");
      done.classList.add("hidden");
    }, 1500);
  });
}

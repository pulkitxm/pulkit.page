for (const button of document.querySelectorAll("[data-contact-copy]")) {
  const label = button.getAttribute("aria-label");
  let timer;
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(button.dataset.contactCopy);
    button.setAttribute("aria-label", "Copied");
    button.querySelector("[data-copy-idle]").classList.add("hidden");
    button.querySelector("[data-copy-done]").classList.remove("hidden");
    clearTimeout(timer);
    timer = setTimeout(() => {
      button.setAttribute("aria-label", label);
      button.querySelector("[data-copy-idle]").classList.remove("hidden");
      button.querySelector("[data-copy-done]").classList.add("hidden");
    }, 1500);
  });
}

import { buttonClass, cn } from "./ui.js";

const spanBase = "flex items-center justify-center gap-2 transition-opacity";

export function createSwapButton({
  swapped = false,
  label1,
  label2,
  icon,
  iconSwapped,
  labelClassName,
  className,
  variant,
  size,
  onClick,
} = {}) {
  const label1IsLonger = label1.length >= label2.length;
  const hasIcon = icon !== undefined || iconSwapped !== undefined;
  const element = document.createElement("button");
  element.type = "button";
  element.className = buttonClass({
    variant,
    size,
    className: cn("relative select-none", hasIcon && "flex justify-start", className),
  });
  const first = document.createElement("span");
  const second = document.createElement("span");
  element.append(first, second);
  let current = swapped;

  function render() {
    const currentIcon = icon === undefined ? "" : current ? (iconSwapped ?? icon) : icon;
    first.className = cn(
      spanBase,
      !label1IsLonger && "absolute",
      current ? "opacity-0" : "opacity-100",
      labelClassName,
    );
    second.className = cn(
      spanBase,
      label1IsLonger && "absolute",
      current ? "opacity-100" : "opacity-0",
      labelClassName,
    );
    first.innerHTML = currentIcon;
    first.append(label1);
    second.innerHTML = currentIcon;
    second.append(label2);
  }

  if (onClick) {
    element.addEventListener("click", onClick);
  }
  render();
  return {
    element,
    get swapped() {
      return current;
    },
    set swapped(value) {
      current = value;
      render();
    },
  };
}

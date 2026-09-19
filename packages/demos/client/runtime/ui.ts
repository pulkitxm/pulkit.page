import { createElement } from "lucide";
import { twMerge } from "tailwind-merge";

export type ClassValue = string | number | boolean | null | undefined | readonly ClassValue[];
export type HtmlValue = string | number | boolean | null | undefined | readonly HtmlValue[];
export type IconNode = Parameters<typeof createElement>[0];

function flattenClasses(value: ClassValue): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item: ClassValue) => flattenClasses(item));
  }
  return value ? [String(value)] : [];
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(inputs.flatMap(flattenClasses).join(" "));
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm ring-offset-background transition-[colors,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer";

const buttonSizes = {
  card: "h-auto w-full min-w-0 flex-col items-start justify-start gap-0 whitespace-normal p-4 text-left font-normal sm:p-6",
  default: "h-11 px-4 py-2 has-[>svg]:px-3",
  icon: "size-11",
  lg: "h-12 px-8 text-base has-[>svg]:px-6",
  sm: "h-11 px-3 text-sm has-[>svg]:px-2.5",
};

const buttonVariants = {
  default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
  outline:
    "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
};

export type ButtonVariant = keyof typeof buttonVariants;
type ButtonSize = keyof typeof buttonSizes;

export interface ButtonStyle {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  className?: string | undefined;
}

export interface ButtonMarkup extends ButtonStyle {
  label?: string | undefined;
  attrs?: string | undefined;
}

export function buttonClass({
  variant = "default",
  size = "default",
  className = "",
}: ButtonStyle = {}): string {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export function button({
  variant,
  size,
  className,
  label = "",
  attrs = "",
}: ButtonMarkup = {}): string {
  return `<button type="button" class="${buttonClass({ variant, size, className })}" ${attrs}>${label}</button>`;
}

export function icon(node: IconNode, className = ""): string {
  const svg = createElement(node);
  const name = svg.getAttribute("class") ?? "";
  svg.setAttribute("class", cn(name, className));
  svg.setAttribute("aria-hidden", "true");
  return svg.outerHTML;
}

function flattenHtml(value: HtmlValue): string {
  if (Array.isArray(value)) {
    return value.map((item: HtmlValue) => flattenHtml(item)).join("");
  }
  return value === null || value === undefined ? "" : String(value);
}

export function html(strings: TemplateStringsArray, ...values: HtmlValue[]): string {
  return strings.reduce((result, part, index) => {
    return result + part + (index < values.length ? flattenHtml(values[index]) : "");
  }, "");
}

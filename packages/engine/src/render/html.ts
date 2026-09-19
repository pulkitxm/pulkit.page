import { escapeHtml } from "@pulkit/shared/html";

export const linkClasses =
  "text-inherit decoration-muted underline-offset-4 hover:decoration-current";

export const codeFont = "[font:0.84em/1.65_var(--font-mono)]";

export function withClass(html: string, classes: string): string {
  return html.replace(/^<(\w+)/, `<$1 class="${classes}"`);
}

export function safeUrl(value: string | undefined): string {
  if (typeof value !== "string" || !/^(?:\/(?!\/)|https:\/\/|mailto:|#)/.test(value)) {
    throw new Error(`Invalid link: ${value}`);
  }
  return escapeHtml(value);
}

const longDateFormat = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function longDate(date: string): string {
  return longDateFormat.format(new Date(date));
}

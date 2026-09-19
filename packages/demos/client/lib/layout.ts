import { html } from "../runtime/ui.ts";

type CaptionWidth = "max-w-40" | "max-w-xs" | "max-w-sm" | "max-w-md";

export interface CaptionOptions {
  width?: CaptionWidth;
  ref?: string;
}

interface RangeField {
  id: string;
  label: string;
  key: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

const rangeLabel = "font-medium text-neutral-700 text-xs dark:text-neutral-300";
const rangeValue = "font-mono text-neutral-600 text-xs dark:text-neutral-300";
const rangeInput =
  "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-neutral-900 dark:bg-neutral-700 dark:accent-neutral-100";

export function stage(className: string, content: string): string {
  return `<div class="flex size-full flex-col items-center justify-center ${className}">${content}</div>`;
}

export function caption(content: string, { width = "max-w-md", ref }: CaptionOptions = {}): string {
  const attribute = ref === undefined ? "" : ` data-ref="${ref}"`;
  return `<p${attribute} class="${width} text-center text-neutral-500 text-xs dark:text-neutral-400">${content}</p>`;
}

export function label(content: string): string {
  return `<span class="font-medium text-neutral-700 text-xs dark:text-neutral-300">${content}</span>`;
}

export function rangeField({
  id,
  label: text,
  key,
  value,
  min,
  max,
  step,
  unit,
}: RangeField): string {
  const reading =
    unit === undefined
      ? `<span data-ref="${key}Value" class="${rangeValue}">${value}</span>`
      : `<span class="${rangeValue}"><span data-ref="${key}Value">${value}</span>${unit}</span>`;
  return html`<div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between">
      <label for="${id}" class="${rangeLabel}">${text}</label>
      ${reading}
    </div>
    <input id="${id}" data-key="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" class="${rangeInput}" />
  </div>`;
}

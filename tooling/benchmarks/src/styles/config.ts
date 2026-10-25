import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../../../", import.meta.url));
export const variants = [
  {
    id: "utilities",
    label: "Tailwind utilities",
    detail: "Full compiled CSS, original utility names, inline stylesheet.",
  },
  {
    id: "pruned",
    label: "Home-only utilities",
    detail: "Conservatively removes utility rules unrelated to this page.",
  },
  {
    id: "aliases",
    label: "Home-only aliases",
    detail: "The same pruning with one short name per utility and renamed internal properties.",
  },
  {
    id: "composed",
    label: "Current composition",
    detail: "The production compiler, including its source scan and :is() membership selectors.",
  },
  {
    id: "direct",
    label: "Direct combination rules",
    detail: "Tailwind expands generated @apply rules. Only used standalone utility rules remain.",
  },
  {
    id: "external",
    label: "Direct rules, external CSS",
    detail: "The direct-rule output with a separate immutable, cacheable stylesheet.",
  },
] as const;
export type Variant = (typeof variants)[number]["id"];

export const profiles = [
  {
    id: "desktop",
    label: "Desktop reference",
    width: 1440,
    height: 900,
    dpr: 1,
    cpu: 1,
    latency: 0,
    download: 0,
    upload: 0,
    mobile: false,
  },
  {
    id: "mobile",
    label: "Small screen, moderate constraints",
    width: 390,
    height: 844,
    dpr: 2,
    cpu: 4,
    latency: 80,
    download: 10,
    upload: 5,
    mobile: true,
  },
  {
    id: "budget",
    label: "Budget-phone simulation",
    width: 360,
    height: 800,
    dpr: 2,
    cpu: 6,
    latency: 150,
    download: 1.6,
    upload: 0.75,
    mobile: true,
  },
  {
    id: "severe",
    label: "Severely constrained simulation",
    width: 320,
    height: 640,
    dpr: 1,
    cpu: 12,
    latency: 300,
    download: 0.6,
    upload: 0.25,
    mobile: true,
  },
] as const;
export interface Profile {
  id: string;
  label: string;
  width: number;
  height: number;
  dpr: number;
  cpu: number;
  latency: number;
  download: number;
  upload: number;
  mobile: boolean;
}

export interface Artifact {
  variant: Variant;
  directory: string;
  htmlBytes: number;
  htmlGzip: number;
  htmlBrotli: number;
  cssBytes: number;
  cssGzip: number;
  cssRules: number;
  classTokens: number;
  stageMs: Record<string, number>;
}

export interface NavigationSample {
  variant: Variant;
  profile: string;
  round: number;
  cache: "cold" | "warm";
  metrics: Record<string, number | null>;
  errors: string[];
  lcpTarget?: string;
  unsupported?: string[];
}

export interface BuildSample {
  variant: Variant;
  round: number;
  wallMs: number;
  processMs: number;
  stages: Record<string, number>;
}

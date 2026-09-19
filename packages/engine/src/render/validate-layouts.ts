import { join } from "node:path";
import { formatHtml } from "@pulkit/code/format-html";
import { readJson } from "@pulkit/shared/files";
import { repositoryRoot } from "@pulkit/shared/repository";
import { type ConfigData, HtmlValidate } from "html-validate";
import { isRecord } from "../lib/guards.ts";
import {
  applyLayout,
  type LayoutValues,
  layoutDirectory,
  loadLayouts,
  themeScript,
} from "./layouts.ts";

function sampleValues(): LayoutValues {
  return {
    seo: "",
    themeScript: themeScript(),
    breadcrumbs: "",
    related: "",
    title: "Example page",
    description: "Example description",
    brand: "Example",
    author: "Example Author",
    authorUrl: "https://example.com/",
    navigation: '<a href="/">Home</a>',
    copyright: "Example copyright",
    markdown: "/example.md",
    social: '<a href="https://example.com">Example</a>',
    heading: "Example heading",
    content: "<p>Example content</p>",
    date: '<p class="text-sm text-muted"><time datetime="2026-01-01">2026-01-01</time></p>',
  };
}

function validatorConfig(): ConfigData {
  const config = readJson(join(repositoryRoot, ".htmlvalidate.json"));
  if (!isRecord(config)) {
    throw new Error(".htmlvalidate.json must contain a configuration object");
  }
  return config;
}

export async function checkLayouts(directory: string = layoutDirectory()): Promise<number> {
  const layouts = loadLayouts(directory);
  const validator = new HtmlValidate(validatorConfig());
  const values = sampleValues();
  for (const name of layouts.keys()) {
    const report = await validator.validateString(formatHtml(applyLayout(layouts, name, values)));
    if (!report.valid) {
      const messages = report.results.flatMap((result) =>
        result.messages.map((message) => message.message),
      );
      throw new Error(`Invalid HTML in layout ${name}: ${messages.join("; ")}`);
    }
  }
  return layouts.size;
}

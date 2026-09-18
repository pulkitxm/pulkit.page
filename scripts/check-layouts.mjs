import { readFileSync } from "node:fs";
import { HtmlValidate } from "html-validate";
import { formatHtml } from "./format-html.mjs";
import { applyLayout, loadLayouts } from "./layouts.mjs";

export async function checkLayouts(directory = "layouts") {
  const layouts = loadLayouts(directory);
  const validator = new HtmlValidate(JSON.parse(readFileSync(".htmlvalidate.json", "utf8")));
  const values = {
    seo: "",
    breadcrumbs: "",
    related: "",
    title: "Example page",
    description: "Example description",
    brand: "Example",
    navigation: '<a href="/">Home</a>',
    copyright: "Example copyright",
    social: '<a href="https://example.com">Example</a>',
    heading: "Example heading",
    content: "<p>Example content</p>",
    date: '<p class="text-sm text-muted"><time datetime="2026-01-01">2026-01-01</time></p>',
  };
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

if (import.meta.main) {
  console.log(`Validated ${await checkLayouts()} HTML layouts and their partials`);
}

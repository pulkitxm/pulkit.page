import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";
import { compileDemoStyles } from "@pulkit/demos/assets";
import { stylesheetClasses } from "@pulkit/engine/src/lib/compiled-styles.ts";
import { compileTailwind } from "@pulkit/shared/tailwind";
import { themeFile } from "@pulkit/theme/files";
import { variants } from "../styles/config.ts";
import { originalHome } from "../styles/markup.ts";
import { buildVariant } from "../styles/variants.ts";

const output = resolve(process.argv[2] ?? "reports/style-benchmark");
const input = join(output, "input");
mkdirSync(input, { recursive: true });
writeFileSync(join(input, "home.html"), originalHome());
compileTailwind({ input: themeFile("styles.css"), output: join(input, "home.css"), minify: true });
const css = readFileSync(join(input, "home.css"), "utf8");
const catalog = [
  ...new Set([
    ...stylesheetClasses(css, "home.css"),
    ...stylesheetClasses(compileDemoStyles().shadow, "demos.css"),
  ]),
].filter((name) => !name.startsWith("plyr"));
writeFileSync(join(input, "catalog.json"), `${JSON.stringify(catalog)}\n`);
for (const variant of variants) {
  const result = await buildVariant(variant.id, input, join(output, "variants", variant.id));
  console.log(
    `${variant.id}: ${result.htmlGzip} gzip HTML bytes, ${result.cssRules} CSS rules, ${result.classTokens} class tokens`,
  );
}

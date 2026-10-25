import { resolve } from "node:path";
import process from "node:process";
import { type Variant, variants } from "../styles/config.ts";
import { buildVariant } from "../styles/variants.ts";

const [variant, input, output] = process.argv.slice(2);
if (!variants.some((item) => item.id === variant) || !input || !output) {
  throw new Error("Usage: build-style-variant.ts VARIANT INPUT OUTPUT");
}
await buildVariant(variant as Variant, resolve(input), resolve(output));

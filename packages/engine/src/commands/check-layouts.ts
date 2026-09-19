import { checkLayouts } from "../render/validate-layouts.ts";

console.log(`Validated ${await checkLayouts()} HTML layouts and their partials`);

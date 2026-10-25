import { expect, test } from "bun:test";
import { cssRuleCount, pruneCss, renameCss, utilityNames } from "./css.ts";

test("home pruning removes unused utility rules and preserves global rules and conditions", () => {
  const css =
    "body{color:black}.flex{display:flex}.grid{display:grid}@media(min-width:40rem){.sm\\:flex{display:flex}}@property --tw-x{syntax:'<number>';inherits:false;initial-value:0}";
  const result = pruneCss(css, utilityNames(css), new Set(["flex", "sm:flex"]));
  expect(result).toContain("body{color:#000}");
  expect(result).toContain(".flex{display:flex}");
  expect(result).toContain("@media");
  expect(result).toContain("@property");
  expect(result).not.toContain("display:grid");
});

test("aliasing handles nested selectors and registered properties without changing rule order", () => {
  const css = ".flex:is(.group *){--tw-x:1;color:var(--tw-x)}.grid{display:grid}";
  const result = renameCss(
    css,
    new Map([
      ["flex", "a"],
      ["group", "b"],
      ["grid", "c"],
    ]),
    (name) => (name === "--tw-x" ? "--value" : name),
  );
  expect(result).toContain(".a:is(.b *)");
  expect(result).toContain("--value:1");
  expect(result).toContain("var(--value)");
  expect(result.indexOf(".a")).toBeLessThan(result.indexOf(".c"));
  expect(cssRuleCount(result)).toBe(2);
});

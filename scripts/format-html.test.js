import { expect, test } from "bun:test";
import { formatHtml } from "./format-html.mjs";

test("flex and grid children break onto their own lines while inline text stays attached", () => {
  const html = formatHtml(
    '<div class="flex gap-2"><span>first</span><span>second</span></div><p><code>a</code><code>b</code></p>\n',
  );
  expect(html).toContain("<span>first</span>\n  <span>second</span>");
  expect(html).toContain("<code>a</code><code>b</code>");
  expect(html).not.toMatch(/^\s*><span/m);
});

test("responsive display overrides keep whitespace untouched", () => {
  const html = formatHtml('<div class="flex max-sm:block"><b>a</b><i>b</i></div>\n');
  expect(html).toContain("<b>a</b><i>b</i>");
});

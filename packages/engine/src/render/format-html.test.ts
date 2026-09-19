import { expect, test } from "bun:test";
import { formatHtml } from "@pulkit/code/format-html";

const page = (body: string): string =>
  `<!DOCTYPE html><html lang="en"><head><title>t</title></head><body>${body}</body></html>`;

test("prose stays on one line so closing brackets never dangle", () => {
  const html = formatHtml(
    page(
      '<p>See\n   <a class="text-inherit decoration-muted underline-offset-4" href="https://example.com">the docs</a>. It uses <code>x</code>,<code>y</code>.</p>',
    ),
  );
  expect(html).toContain(
    '    <p>See <a class="text-inherit decoration-muted underline-offset-4" href="https://example.com">the docs</a>. It uses <code>x</code>,<code>y</code>.</p>\n',
  );
  expect(html).not.toMatch(/^\s*>|<\/[a-z]+$/m);
});

test("blocks nest with indentation and flex or grid children get their own lines", () => {
  const html = formatHtml(
    page(
      '<div class="flex gap-2"><span>first</span><span>second</span></div><div class="flex max-sm:block"><b>a</b><i>b</i></div>',
    ),
  );
  expect(html).toStartWith(
    '<!doctype html>\n<html lang="en">\n  <head>\n    <title>t</title>\n  </head>\n  <body>\n',
  );
  expect(html).toContain(
    '    <div class="flex gap-2">\n      <span>first</span>\n      <span>second</span>\n    </div>\n',
  );
  expect(html).toContain('    <div class="flex max-sm:block"><b>a</b><i>b</i></div>\n');
});

test("code blocks keep their exact text and start on the line after the pre tag", () => {
  const code = '<span class="k">if</span> (a) {\n  b();\n}\n';
  const html = formatHtml(page(`<div><pre class="p-5"><code>${code}</code></pre></div>`));
  expect(html).toContain(`      <pre class="p-5">\n<code>${code}</code></pre>\n`);
  expect(formatHtml(html)).toBe(html);
});

test("void elements self-close and JSON scripts are indented to their depth", () => {
  const html = formatHtml(
    '<!doctype html><html><head><meta charset="utf-8"><script type="application/ld+json">{\n  "a": 1\n}</script></head><body><img src="/a.png" alt=""></body></html>',
  );
  expect(html).toContain('    <meta charset="utf-8" />\n');
  expect(html).toContain(
    '    <script type="application/ld+json">\n      {\n        "a": 1\n      }\n    </script>\n',
  );
  expect(html).toContain('  <body><img src="/a.png" alt="" /></body>\n');
});

test("a popover nested in a sentence stays inline so no space appears before punctuation", () => {
  const html = formatHtml(
    page(
      '<p>(think of a <button type="button">door</button><span popover><img class="block" src="/d.gif" alt="d" /></span>). Next.</p>',
    ),
  );
  expect(html).toContain(
    '<p>(think of a <button type="button">door</button><span popover><img class="block" src="/d.gif" alt="d" /></span>). Next.</p>',
  );
});

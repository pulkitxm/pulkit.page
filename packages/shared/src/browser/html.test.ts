import { expect, test } from "bun:test";
import { escapeAttribute, escapeHtml, escapeXml, unescapeHtml } from "./html.ts";

test("escapeHtml escapes every HTML-significant character and stringifies values", () => {
  expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
    "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
  );
  expect(escapeHtml(42)).toBe("42");
  expect(escapeHtml("plain")).toBe("plain");
});

test("escapeAttribute leaves apostrophes and escapeXml uses the XML apostrophe", () => {
  expect(escapeAttribute(`<"it's">&`)).toBe("&lt;&quot;it's&quot;&gt;&amp;");
  expect(escapeXml(`<"it's">&`)).toBe("&lt;&quot;it&apos;s&quot;&gt;&amp;");
});

test("unescapeHtml reverses escapeHtml without decoding twice", () => {
  const source = `<a title='x'>"&amp;"</a>`;
  expect(unescapeHtml(escapeHtml(source))).toBe(source);
  expect(unescapeHtml("&amp;lt;")).toBe("&lt;");
  expect(unescapeHtml("&copy;")).toBe("&copy;");
});

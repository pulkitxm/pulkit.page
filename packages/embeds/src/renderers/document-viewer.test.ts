import { expect, test } from "bun:test";
import { createPageAssets, renderEmbed } from "../index.ts";

const documents = [
  { title: "Sample document", documentUrl: "/assets/sample.pdf" },
  { title: "Second document", documentUrl: "/assets/second.pdf" },
];

test("documents embed directly with accessible titles and download fallback", () => {
  const assets = createPageAssets();
  const html = renderEmbed("document-viewer", documents[0] ?? {}, assets, false);
  expect(html).toMatch(/<iframe[^>]+src="\/assets\/sample.pdf"[^>]+title="Sample document"/);
  expect(html).toContain('loading="lazy"');
  expect(html).toContain('href="/assets/sample.pdf" download');
  expect(html).toContain("Download Sample document (PDF)");
  expect(html).not.toContain("Show Sample document");
  expect(html).not.toContain("data-document-frame");
  expect(assets.tags()).toBe("");
});

test("document tabs contain native viewers before JavaScript runs", () => {
  const assets = createPageAssets();
  const html = renderEmbed("document-tabs", { documents }, assets, false);
  expect(html.match(/<iframe /g)).toHaveLength(2);
  expect(html).toContain('src="/assets/sample.pdf"');
  expect(html).toContain('src="/assets/second.pdf"');
  expect(html).toContain('aria-selected="true"');
  expect(html).toMatch(/id="tabpanel-doc-1"[^>]+ hidden/);
  expect(html.match(/loading="lazy"/g)).toHaveLength(2);
  expect(assets.tags()).toContain("document-tabs.js");
  expect(assets.tags()).not.toContain("document-frame.js");
  expect(html).not.toContain("data-document-frame");
});

test("document titles and URLs remain escaped in frames and links", () => {
  const html = renderEmbed(
    "document-viewer",
    { title: 'Sample & "Plan"', documentUrl: "/assets/sample.pdf?a=1&b=2" },
    createPageAssets(),
    false,
  );
  expect(html).toContain('title="Sample &amp; &quot;Plan&quot;"');
  expect(html).toContain('src="/assets/sample.pdf?a=1&amp;b=2"');
  expect(html).toContain("Download Sample &amp; &quot;Plan&quot; (PDF)");
});

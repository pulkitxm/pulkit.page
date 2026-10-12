import { expect, test } from "bun:test";
import type { ListedPage, PageMetadata, PageRecord, Site } from "../types.ts";
import { renderDependencies } from "./render-dependencies.ts";
import { renderPage } from "./render-page.ts";

const metadata: PageMetadata = {
  title: "Example Studio",
  date: "2025-03-25",
  endDate: "2025-06-30",
  period: "Mar 2025 – Jun 2025",
  role: "Engineer",
  icon: "/assets/exp/example.webp",
};
const entry: ListedPage = { route: "/exp/example/", metadata };
const home: PageRecord = { route: "/", metadata: { title: "Home" }, body: ":::list exp" };
const site: Site = { url: "https://example.com", brand: "Example" };
const source = "---\ntitle: Home\n---\n\n:::list exp\n";

test("experience dates preserve exact days and render ongoing roles without an end date", async () => {
  const html = await renderPage(source, { pages: [entry] });
  expect(html).toContain('datetime="2025-03-25"');
  expect(html).toContain('title="March 25, 2025"');
  expect(html).toContain('title="June 30, 2025"');
  expect(html).toContain("Mar 2025");
  expect(html).toContain("Jun 2025");
  expect(html).toContain('class="text-xs text-muted">Engineer');
  expect(html).toContain('class="m-0 size-9 object-contain" src="/assets/exp/example.webp"');
  const { endDate: _, ...ongoingMetadata } = metadata;
  const ongoing = await renderPage(source, { pages: [{ ...entry, metadata: ongoingMetadata }] });
  expect(ongoing).toContain("present");
  expect(ongoing).not.toContain('datetime="2025-06-30"');
});

test("experience listing cache changes when dates, roles or icons change", () => {
  const before = renderDependencies(home, [entry], site);
  for (const [field, value] of Object.entries({
    endDate: "2025-07-01",
    role: "Senior Engineer",
    icon: "/assets/exp/updated.webp",
    darkIcon: "/assets/exp/updated-dark.svg",
    secondaryIcon: "/assets/exp/second.webp",
  })) {
    const updated = { ...entry, metadata: { ...metadata, [field]: value } };
    expect(renderDependencies(home, [updated], site)).not.toEqual(before);
  }
});

test("experience icons with a dark variant swap by color scheme", async () => {
  const html = await renderPage(source, {
    pages: [{ ...entry, metadata: { ...metadata, darkIcon: "/assets/exp/example-dark.svg" } }],
  });
  expect(html).toMatch(/class="[^"]*dark:hidden[^"]*" src="\/assets\/exp\/example\.webp"/);
  expect(html).toMatch(
    /class="[^"]*hidden[^"]*dark:block[^"]*" src="\/assets\/exp\/example-dark\.svg"/,
  );
});

test("experience pages link company profiles with platform icons", async () => {
  const page = `---
title: Example Studio
role: Engineer
date: 2025-03-25
period: Mar 2025 – present
icon: /assets/exp/example.webp
links:
  - https://example.com
  - https://www.linkedin.com/company/example/
  - https://x.com/example
---

Body
`;
  const html = await renderPage(page);
  expect(html).toContain(
    'href="https://example.com" target="_blank" rel="noopener noreferrer" aria-label="example.com"',
  );
  expect(html).toContain('aria-label="linkedin.com/company/example"');
  expect(html).toContain('class="size-4.5" aria-hidden="true"');
  expect(html).not.toContain('d="M0 0h24v24H0z"');
  expect((html.match(/<svg /g) ?? []).length).toBe(3);
  await expect(
    renderPage(page.replace("https://example.com", "http://example.com")),
  ).rejects.toThrow("https");
});

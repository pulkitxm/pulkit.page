import { expect, test } from "bun:test";
import { renderDependencies, renderPage } from "./render-page.mjs";

const metadata = {
  title: "Example Studio",
  date: "2025-03-25",
  endDate: "2025-06-30",
  period: "Mar 2025 – Jun 2025",
  role: "Engineer",
  icon: "/assets/exp/example.webp",
};
const entry = { route: "/exp/example/", metadata };
const home = { route: "/", metadata: { title: "Home" }, body: ":::list exp" };
const site = { url: "https://example.com", brand: "Example" };

test("experience dates preserve exact days and render ongoing roles without an end date", async () => {
  const source = "---\ntitle: Home\n---\n\n:::list exp\n";
  const html = await renderPage(source, { pages: [entry] });
  expect(html).toContain('datetime="2025-03-25"');
  expect(html).toContain('title="March 25, 2025"');
  expect(html).toContain('title="June 30, 2025"');
  expect(html).toContain("Mar 2025");
  expect(html).toContain("Jun 2025");
  expect(html).toContain('class="text-xs text-muted">Engineer');
  expect(html).toContain('src="/assets/exp/example.webp"');
  const ongoing = await renderPage(source, {
    pages: [{ ...entry, metadata: { ...metadata, endDate: undefined } }],
  });
  expect(ongoing).toContain("present");
  expect(ongoing).not.toContain('datetime="2025-06-30"');
});

test("experience listing cache changes when dates, roles or icons change", () => {
  const before = renderDependencies(home, [entry], site);
  for (const [field, value] of Object.entries({
    endDate: "2025-07-01",
    role: "Senior Engineer",
    icon: "/assets/exp/updated.webp",
    secondaryIcon: "/assets/exp/second.webp",
  })) {
    const updated = { ...entry, metadata: { ...metadata, [field]: value } };
    expect(renderDependencies(home, [updated], site)).not.toEqual(before);
  }
});

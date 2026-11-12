import { expect, test } from "bun:test";
import { renderProjectCodeWorkspace } from "./project-code-workspace.ts";

test("renders the original tree and code layout bound to a local approved source bundle", () => {
  const revision = "a".repeat(40);
  const html = renderProjectCodeWorkspace(
    { name: "components-ui--sample-console", path: "components-ui/sample-console" },
    revision,
  );
  expect(html).toContain("grid-cols-[260px_minmax(0,1fr)]");
  expect(html).toContain('aria-label="Project files"');
  expect(html).toContain(
    'data-source-url="/assets/project-source/components-ui--sample-console.json"',
  );
  expect(html).toContain(`data-source-revision="${revision}"`);
  expect(html).toContain('data-source-project="components-ui/sample-console"');
  expect(html).not.toMatch(/raw\.githubusercontent|api\.github|download|prompt\.md|<iframe/);
});

test("refuses source bindings with external paths, invalid revisions or mismatched project names", () => {
  const revision = "a".repeat(40);
  for (const project of [
    { path: "../example", name: "..--example" },
    { path: "components-ui/example", name: "other" },
    { path: "https://example.test", name: "https:----example.test" },
  ]) {
    expect(() => renderProjectCodeWorkspace(project, revision)).toThrow();
  }
  expect(() =>
    renderProjectCodeWorkspace(
      { path: "components-ui/example", name: "components-ui--example" },
      "main",
    ),
  ).toThrow();
});

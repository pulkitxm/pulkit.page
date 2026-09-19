import { expect, test } from "bun:test";
import { splitFrontmatter, textFields } from "./frontmatter.ts";

test("splits LF frontmatter and reports the consumed length", () => {
  const source = "---\ntitle: A\n---\nBody\n";
  expect(splitFrontmatter(source)).toEqual({
    yaml: "title: A",
    body: "Body\n",
    length: "---\ntitle: A\n---\n".length,
  });
});

test("CRLF and an end-of-file close are opt-in", () => {
  expect(splitFrontmatter("---\r\ntitle: A\r\n---\r\nBody")).toBeUndefined();
  expect(splitFrontmatter("---\r\ntitle: A\r\n---\r\nBody", { crlf: true })?.body).toBe("Body");
  expect(splitFrontmatter("---\ntitle: A\n---")).toBeUndefined();
  expect(splitFrontmatter("---\ntitle: A\n---", { closedByEndOfFile: true })?.yaml).toBe(
    "title: A",
  );
});

test("text fields cover page and site strings but not list fields", () => {
  expect(textFields).toContain("copyright");
  expect(textFields).not.toContain("tags");
});

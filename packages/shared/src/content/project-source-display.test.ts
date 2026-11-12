import { expect, test } from "bun:test";
import { projectSourceDisplay } from "./project-source.ts";

test("removes six outer blank lines from HTML while preserving tab indentation", () => {
  const markup = ["\t<main>", "\t\t<p>Example studio</p>", "\t</main>"].join("\n");
  expect(projectSourceDisplay(`${"\n".repeat(6)}${markup}\n\n`)).toBe(markup);
});

test("removes empty CSS boundary lines without changing declarations or internal whitespace", () => {
  const css = [".example {", "\tcolor: red;", "", "\tcontent: '  Example  ';", "}"].join("\n");
  expect(projectSourceDisplay(` \t\n\n\n\n\n\n${css}\n \t\n`)).toBe(css);
});

test("preserves intentional indentation and trailing spaces on nonempty text lines", () => {
  expect(projectSourceDisplay("\n  Example heading  \n\n\t  Example detail \n\n")).toBe(
    "  Example heading  \n\n\t  Example detail ",
  );
});

test("preserves blank lines inside template literals and exact interior CRLF endings", () => {
  const script = ["const markup = `", "", "\t<section>", "", "\t</section>", "", "`;"].join("\n");
  expect(projectSourceDisplay(`\n\n${script}\n\n`)).toBe(script);
  expect(projectSourceDisplay("\r\n \t\r\n\talpha\r\n\r\n\tbeta\r\n")).toBe(
    "\talpha\r\n\r\n\tbeta",
  );
});

test("handles empty and whitespace-only files without trimming meaningful characters", () => {
  for (const text of ["", "\n\n", " \t", "\r\n \t\n"]) {
    expect(projectSourceDisplay(text)).toBe("");
  }
  expect(projectSourceDisplay("\tvalue")).toBe("\tvalue");
  expect(projectSourceDisplay("\uFEFFvalue\n")).toBe("\uFEFFvalue");
});

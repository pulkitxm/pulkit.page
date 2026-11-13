import { createHash } from "node:crypto";

export function replaceNoticeSections(
  published: string,
  sections: readonly { previous: string; current: string }[],
): string {
  let result = published;
  for (const section of sections) {
    const previous = section.previous.replaceAll("\r\n", "\n");
    const current = section.current.replaceAll("\r\n", "\n");
    if (previous === current) {
      continue;
    }
    const index = result.indexOf(previous);
    if (!previous || index < 0 || result.indexOf(previous, index + previous.length) >= 0) {
      throw new Error("A source notice section must match exactly once before replacement");
    }
    result = result.slice(0, index) + current + result.slice(index + previous.length);
  }
  return result;
}

export function sameImplementation(
  captured: readonly { path: string; sha256: string }[],
  published: readonly { path: string; sha256: string }[],
): string {
  if (captured.length === 0 || JSON.stringify(captured) !== JSON.stringify(published)) {
    throw new Error("Current project implementation differs from the recorded source");
  }
  return createHash("sha256")
    .update(captured.map((file) => `${file.path}\0${file.sha256}\n`).join(""))
    .digest("hex");
}

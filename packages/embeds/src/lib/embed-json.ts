export interface JsonRead {
  value: unknown;
  end: number;
}

export function readJson(source: string, start: number): JsonRead {
  let depth = 0;
  let quoted = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === "\\") {
        index += 1;
      } else if (character === '"') {
        quoted = false;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return { value: JSON.parse(source.slice(start, index + 1)), end: index + 1 };
      }
    }
  }
  throw new Error(`Unterminated embed properties: ${source.slice(start, start + 80)}`);
}

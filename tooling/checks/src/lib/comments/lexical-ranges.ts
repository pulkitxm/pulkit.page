import type { CommentRange } from "./range.ts";

function quoteAt(rest: string, sql: boolean): string | undefined {
  const dollar = sql ? /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest)?.[0] : undefined;
  if (dollar) {
    return dollar;
  }
  if (!sql && (rest.startsWith('"""') || rest.startsWith("'''"))) {
    return rest.slice(0, 3);
  }
  return /^["'`]/.test(rest) ? rest[0] : undefined;
}

function skipQuoted(source: string, start: number, quote: string, sql: boolean): number {
  let index = start + quote.length;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source.startsWith(quote, index)) {
      index += quote.length;
      if (sql && quote.length === 1 && source.startsWith(quote, index)) {
        index += quote.length;
        continue;
      }
      break;
    }
    index++;
  }
  return index;
}

function skipBlock(source: string, start: number): number {
  let index = start + 2;
  let depth = 1;
  while (index < source.length && depth) {
    if (source.startsWith("/*", index)) {
      depth++;
      index += 2;
    } else if (source.startsWith("*/", index)) {
      depth--;
      index += 2;
    } else {
      index++;
    }
  }
  return index;
}

function lineEnd(source: string, start: number): number {
  const end = source.indexOf("\n", start);
  return end < 0 ? source.length : end;
}

export function lexicalRanges(source: string, sql = false, marker = "#"): CommentRange[] {
  const ranges: CommentRange[] = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const quote = quoteAt(rest, sql);
    if (quote) {
      index = skipQuoted(source, index, quote, sql);
      continue;
    }
    const block = sql && rest.startsWith("/*");
    const line = sql ? rest.startsWith("--") : rest.startsWith(marker);
    if (block || line) {
      const start = index;
      index = block ? skipBlock(source, index) : lineEnd(source, index);
      if (!(start === 0 && source.startsWith("#!"))) {
        ranges.push({ start, end: index });
      }
      continue;
    }
    index++;
  }
  return ranges;
}

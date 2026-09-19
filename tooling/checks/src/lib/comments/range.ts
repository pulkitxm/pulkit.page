export interface CommentRange {
  start: number;
  end: number;
}

export function shiftRanges(ranges: readonly CommentRange[], offset: number): CommentRange[] {
  return ranges.map((range) => ({ start: offset + range.start, end: offset + range.end }));
}

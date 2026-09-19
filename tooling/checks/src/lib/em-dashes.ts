export function emDashLines(text: string): number[] {
  return text.split("\n").flatMap((line, index) => (line.includes("\u2014") ? [index + 1] : []));
}

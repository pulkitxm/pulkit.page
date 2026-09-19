const problems = new Set<string>();

export function report(scope: string, message: string): void {
  problems.add(`${scope}: ${message}`);
}

export function expect(scope: string, condition: unknown, message: string): void {
  if (!condition) {
    report(scope, message);
  }
}

export function reportedProblems(): string[] {
  return [...problems];
}

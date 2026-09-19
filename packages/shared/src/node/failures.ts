import process from "node:process";

export function failWith(message: string): never {
  console.error(message);
  process.exit(1);
}

export function reportFailures(failures: readonly string[], success: string): void {
  if (failures.length > 0) {
    failWith(failures.join("\n"));
  }
  console.log(success);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

import { execFileSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const tailwindCli = fileURLToPath(
  new URL("dist/index.mjs", import.meta.resolve("@tailwindcss/cli/package.json")),
);

interface TailwindCompile {
  input: string;
  output: string;
  minify: boolean;
}

export function compileTailwind({ input, output, minify }: TailwindCompile): void {
  execFileSync(
    process.execPath,
    [tailwindCli, "--input", input, "--output", output, ...(minify ? ["--minify"] : [])],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

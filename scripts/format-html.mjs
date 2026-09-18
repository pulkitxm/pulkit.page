import { execFileSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(import.meta.resolve("@biomejs/biome/bin/biome"));
const config = fileURLToPath(new URL("../biome.json", import.meta.url));

export function formatHtml(html) {
  let current = html.replaceAll("\u2714", "&#10004;");
  for (let pass = 0; pass < 5; pass++) {
    const formatted = execFileSync(
      process.execPath,
      [
        cli,
        "format",
        "--write",
        "--vcs-enabled=false",
        "--stdin-file-path=generated.html",
        `--config-path=${config}`,
      ],
      {
        input: current,
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    if (formatted === current) {
      return formatted;
    }
    current = formatted;
  }
  throw new Error("Biome HTML formatting did not stabilize after five passes");
}

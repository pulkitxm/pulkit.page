import { type ChildProcess, type SpawnSyncReturns, spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const fixtureDirectory = fileURLToPath(new URL("../fixture/", import.meta.url));
const commandsDirectory = fileURLToPath(new URL("../../src/commands/", import.meta.url));
const temporaryDirectories: string[] = [];

function commandScript(name: string): string {
  return join(commandsDirectory, `${name}.ts`);
}

export function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

export function removeTemporaryDirectories(): void {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function writeFiles(root: string, files: Readonly<Record<string, string>>): void {
  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
  }
}

export function fixtureSite(prefix: string, files: Readonly<Record<string, string>>): string {
  const directory = temporaryDirectory(prefix);
  cpSync(join(fixtureDirectory, "layouts"), join(directory, "layouts"), { recursive: true });
  writeFiles(directory, files);
  return directory;
}

export function runCommand(
  name: string,
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): SpawnSyncReturns<string> {
  return spawnSync("bun", [commandScript(name)], { cwd, env, encoding: "utf8" });
}

export interface RunningServer {
  origin: string;
  output(): string;
  stop(): Promise<void>;
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  const exited = new Promise((accept) => child.once("exit", accept));
  child.kill("SIGTERM");
  await exited;
}

export async function startServer(
  name: string,
  cwd: string,
  ready: RegExp,
  env: NodeJS.ProcessEnv = { ...process.env, PORT: "0" },
): Promise<RunningServer> {
  const child = spawn("bun", [commandScript(name)], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  try {
    const origin = await new Promise<string>((accept, reject) => {
      child.stdout.on("data", (chunk) => {
        output += String(chunk);
        const match = ready.exec(output);
        if (match?.[1]) {
          accept(match[1]);
        }
      });
      child.once("error", reject);
      child.once("exit", (code) => reject(new Error(`Server exited: ${code}`)));
    });
    return { origin, output: () => output, stop: () => stopChild(child) };
  } catch (error) {
    await stopChild(child);
    throw error;
  }
}

import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const installer = new URL("../../install-media-tools.sh", import.meta.url).pathname;

function runFixture(mode: "installed" | "install" | "fail") {
  const root = mkdtempSync(join(tmpdir(), "media-bootstrap-"));
  const log = join(root, "calls.jsonl");
  const tool = `#!${process.execPath}\nprocess.stdout.write("verified synthetic tool\\n");\n`;
  const put = (name: string, text: string) => {
    writeFileSync(join(root, name), text);
    chmodSync(join(root, name), 0o755);
  };
  try {
    if (mode === "installed") {
      put("ffmpeg", tool);
      put("ffprobe", tool);
    }
    put(
      "sudo",
      `#!${process.execPath}\nimport {appendFileSync,writeFileSync,chmodSync} from "node:fs";\nconst args=process.argv.slice(2);\nappendFileSync(${JSON.stringify(log)},JSON.stringify(args)+"\\n");\nif(args.includes("apt-get")&&${JSON.stringify(mode)}==="fail")process.exit(71);\nif(args.includes("install")){for(const name of ["ffmpeg","ffprobe"]){const path=${JSON.stringify(root)}+"/"+name;writeFileSync(path,${JSON.stringify(tool)});chmodSync(path,0o755);}}\n`,
    );
    const result = spawnSync("/bin/sh", [installer], {
      env: { ...process.env, PATH: root },
      encoding: "utf8",
    });
    const calls =
      mode === "installed"
        ? []
        : readFileSync(log, "utf8")
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line) as string[]);
    return { status: result.status, calls, output: result.stdout };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("available media tools are verified without installing or changing sources", () => {
  const result = runFixture("installed");
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([]);
  expect(result.output.match(/verified synthetic tool/g)).toHaveLength(2);
});

test("missing media tools use signed Ubuntu sources with bounded installation and are verified", () => {
  const result = runFixture("install");
  expect(result.status).toBe(0);
  const update = result.calls.find((args) => args.includes("update"));
  const install = result.calls.find((args) => args.includes("install"));
  expect(update).toContain("180s");
  expect(install).toContain("300s");
  expect(install).toContain("ffmpeg");
  expect(install).toContain("Dir::Etc::sourceparts=-");
  expect(install).toContain("Acquire::Retries=2");
  expect(result.calls.flat().join(" ")).not.toMatch(
    /allow-unauthenticated|AllowInsecure|trusted=yes/,
  );
  expect(result.output.match(/verified synthetic tool/g)).toHaveLength(2);
});

test("failed package retrieval stops without pretending that media tools were installed", () => {
  const result = runFixture("fail");
  expect(result.status).toBe(71);
  expect(result.calls.some((args) => args.includes("install"))).toBe(false);
  expect(result.output).not.toContain("verified synthetic tool");
});

test("the mirror rewrite preserves Ubuntu signing keys and unrelated source records", () => {
  const pattern = /sudo sed -i -E '([^']+)'/.exec(readFileSync(installer, "utf8"))?.[1];
  if (!pattern) {
    throw new Error("The bounded Ubuntu source rewrite is missing");
  }
  const keys = "Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg";
  const source = `Types: deb\nURIs: http://azure.archive.ubuntu.com/ubuntu/\nSuites: resolute resolute-updates\n${keys}\n\nTypes: deb\nURIs: http://security.ubuntu.com/ubuntu\nSuites: resolute-security\n${keys}\n\nURIs: https://example.test/packages\n`;
  const result = spawnSync("/usr/bin/sed", ["-E", pattern], { input: source, encoding: "utf8" });
  expect(result.status).toBe(0);
  expect(result.stdout.match(/URIs: https:\/\/mirrors.edge.kernel.org\/ubuntu\//g)).toHaveLength(2);
  expect(result.stdout.match(/Signed-By:/g)).toHaveLength(2);
  expect(result.stdout).toContain(keys);
  expect(result.stdout).toContain("Suites: resolute-security");
  expect(result.stdout).toContain("URIs: https://example.test/packages");
});

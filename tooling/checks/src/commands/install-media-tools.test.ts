import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const installer = new URL("../../install-media-tools.sh", import.meta.url).pathname;

function runFixture(mode: "installed" | "install" | "fail") {
  const root = mkdtempSync(join(tmpdir(), "media-bootstrap-"));
  const log = join(root, "calls.jsonl");
  const source = join(root, "original.sources");
  const original =
    "Types: deb\nURIs: mirror+file:/etc/apt/apt-mirrors.txt\nSuites: resolute\nComponents: main universe\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n";
  writeFileSync(source, original);
  for (const command of ["mktemp", "mkdir", "chmod", "sed"]) {
    const executable = Bun.which(command);
    if (!executable) {
      throw new Error(`Missing isolated fixture command: ${command}`);
    }
    symlinkSync(executable, join(root, command));
  }
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
    const result = spawnSync("/bin/sh", [installer, source], {
      env: { ...process.env, PATH: root, TMPDIR: root },
      encoding: "utf8",
    });
    const calls =
      mode === "installed"
        ? []
        : readFileSync(log, "utf8")
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line) as string[]);
    return {
      status: result.status,
      calls,
      output: result.stdout,
      unchangedSource: readFileSync(source, "utf8") === original,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("available media tools are verified without installing or changing sources", () => {
  const result = runFixture("installed");
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([]);
  expect(result.unchangedSource).toBe(true);
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
  expect(result.unchangedSource).toBe(true);
  for (const name of [
    "Dir::Etc::sourcelist=",
    "Dir::State::lists=",
    "Dir::Cache::pkgcache=",
    "Dir::Cache::srcpkgcache=",
  ]) {
    const configurations = result.calls
      .filter((args) => args.includes("apt-get") || args.includes("apt-cache"))
      .map((args) => args.find((arg) => arg.startsWith(name)));
    expect(new Set(configurations).size).toBe(1);
    expect(configurations[0]).toContain("media-tools.");
  }
  expect(result.calls.some((args) => args.includes("apt-cache") && args.includes("policy"))).toBe(
    true,
  );
  expect(
    result.calls.some((args) => args.includes("apt-get") && args.includes("indextargets")),
  ).toBe(true);
});

test("failed package retrieval stops without pretending that media tools were installed", () => {
  const result = runFixture("fail");
  expect(result.status).toBe(71);
  expect(result.calls.some((args) => args.includes("install"))).toBe(false);
  expect(result.output).not.toContain("verified synthetic tool");
  expect(result.unchangedSource).toBe(true);
  expect(result.calls.at(-1)?.[0]).toBe("rm");
});

test("the mirror rewrite preserves Ubuntu signing keys and unrelated source records", () => {
  const pattern = /sed -E '([^']+)'/.exec(readFileSync(installer, "utf8"))?.[1];
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

test("the actual runner mirror-list URI is replaced while its deb822 signing record stays intact", () => {
  const pattern = /sed -E '([^']+)'/.exec(readFileSync(installer, "utf8"))?.[1];
  if (!pattern) {
    throw new Error("The bounded Ubuntu source rewrite is missing");
  }
  const source =
    "Types: deb\nURIs: mirror+file:/etc/apt/apt-mirrors.txt\nSuites: resolute resolute-updates resolute-backports resolute-security\nComponents: main restricted universe multiverse\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n\nURIs: mirror+file:/etc/apt/vendor-mirrors.txt\n";
  const result = spawnSync("/usr/bin/sed", ["-E", pattern], { input: source, encoding: "utf8" });
  expect(result.status).toBe(0);
  expect(result.stdout).toBe(
    source.replace(
      "mirror+file:/etc/apt/apt-mirrors.txt",
      "https://mirrors.edge.kernel.org/ubuntu/",
    ),
  );
  expect(result.stdout).not.toContain("URIs: mirror+file:/etc/apt/apt-mirrors.txt");
  expect(result.stdout).toContain("URIs: mirror+file:/etc/apt/vendor-mirrors.txt");
});

test("all media-installing workflows share the bounded verified installer", () => {
  const root = new URL("../../../../", import.meta.url);
  const ci = readFileSync(new URL(".github/workflows/ci.yml", root), "utf8");
  const guestbook = readFileSync(new URL(".github/workflows/guestbook.yml", root), "utf8");
  expect(ci.match(/^\s+run: sh tooling\/checks\/install-media-tools.sh$/gm)).toHaveLength(2);
  expect(guestbook).toContain("sh tooling/checks/install-media-tools.sh");
  expect(ci + guestbook).not.toMatch(/apt-get[^\n]*ffmpeg/);
});

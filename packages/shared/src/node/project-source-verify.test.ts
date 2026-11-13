import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { projectSourceUrl } from "../content/project-source.ts";
import { approvalSchema } from "./experiment-capture-schema.ts";
import { implementationDigest } from "./experiment-publication.ts";
import { sha256Hex } from "./hash.ts";
import { verifySourceAssets } from "./project-source-verify.ts";

function fixture(
  run: (value: {
    verify(): void;
    output: string;
    manifest: {
      revision: string;
      projects: {
        project_source_tree: string;
        sha256: string;
        bytes: number;
        files: { path: string; sha256: string }[];
      }[];
    };
    bundle: {
      project: string;
      files: { path: string; language: string; content: string; sha256: string }[];
    };
    capture: {
      project_source_tree: string;
      implementation_files: { path: string; sha256: string }[];
      publication: {
        source_revision: string;
        source_tree: string;
        project_source_tree: string;
        implementation_sha256: string;
        notices_sha256: string;
        source_notices_sha256: string;
      };
    };
    saveBundle(updateManifest?: boolean): void;
    saveManifest(): void;
    sourcePath: string;
    noticePath: string;
  }) => void,
): void {
  const output = mkdtempSync(join(tmpdir(), "source-artifact-test-"));
  const project = "hero-sections/example-studio";
  const revision = "a".repeat(40);
  const approval = approvalSchema.parse({
    version: 1,
    repository: "pulkitxm/claude-directory",
    revision,
    tree: "b".repeat(40),
    paths: [project],
    registry_sha256: "1".repeat(64),
    provenance_sha256: "2".repeat(64),
    inline_artwork_sha256: "3".repeat(64),
    license_sha256: "4".repeat(64),
  });
  const notice = "Synthetic fixture license notice\n";
  const notices = {
    href: `/assets/project-previews/${project.replaceAll("/", "--")}/source-notices.txt`,
    sha256: sha256Hex(notice),
  };
  const implementation = [
    { path: "index.html", sha256: sha256Hex("<p>Example studio</p>\n") },
    { path: "styles.css", sha256: sha256Hex("body{margin:0}\n") },
  ];
  const capture = {
    project,
    source_revision: "9".repeat(40),
    source_tree: "8".repeat(40),
    project_source_tree: "7".repeat(40),
    notices_sha256: sha256Hex("Original fixture notice\n"),
    source_notices_sha256: sha256Hex("Original fixture notice\n"),
    implementation_files: implementation,
    publication: {
      source_revision: revision,
      source_tree: approval.tree,
      project_source_tree: "c".repeat(40),
      implementation_sha256: implementationDigest(implementation),
      notices_sha256: notices.sha256,
      source_notices_sha256: notices.sha256,
      notices_normalization:
        "CRLF to LF line endings only; license and attribution text unchanged" as const,
    },
  };
  const bundle = {
    version: 1,
    revision,
    project,
    files: [
      {
        path: "index.html",
        language: "html",
        content: "<p>Example studio</p>\n",
        sha256: sha256Hex("<p>Example studio</p>\n"),
      },
      {
        path: "styles.css",
        language: "css",
        content: "body{margin:0}\n",
        sha256: sha256Hex("body{margin:0}\n"),
      },
    ],
    notices: { ...notices },
  };
  const entry = {
    project,
    project_source_tree: capture.publication.project_source_tree,
    href: projectSourceUrl(project),
    sha256: "",
    bytes: 0,
    files: bundle.files.map(({ path, sha256 }) => ({ path, sha256 })),
    notices: { ...notices },
    source_notices_sha256: capture.publication.source_notices_sha256,
  };
  const { paths: _, repository: __, ...header } = approval;
  const manifest = { ...header, projects: [entry] };
  const sourcePath = join(output, entry.href);
  const noticePath = join(output, notices.href);
  const manifestPath = join(dirname(sourcePath), "manifest.json");
  const saveManifest = () => writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  const saveBundle = (updateManifest = false) => {
    const bytes = Buffer.from(`${JSON.stringify(bundle)}\n`);
    writeFileSync(sourcePath, bytes);
    if (updateManifest) {
      entry.bytes = bytes.length;
      entry.sha256 = sha256Hex(bytes);
      saveManifest();
    }
  };
  try {
    mkdirSync(dirname(sourcePath), { recursive: true });
    mkdirSync(dirname(noticePath), { recursive: true });
    writeFileSync(noticePath, notice);
    saveBundle(true);
    run({
      verify: () => verifySourceAssets(output, approval, [capture]),
      output,
      capture,
      manifest,
      bundle,
      saveBundle,
      saveManifest,
      sourcePath,
      noticePath,
    });
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}

test("accepts current publication trees and notices while original capture identities differ", () => {
  fixture(({ verify }) => expect(verify).not.toThrow());
});

test("rejects changed source bytes even when the outer bundle hash is updated", () => {
  fixture(({ bundle, saveBundle, verify }) => {
    if (bundle.files[0]) {
      bundle.files[0].content = "Changed synthetic content";
    }
    saveBundle(true);
    expect(verify).toThrow("content or file inventory");
  });
  fixture(({ sourcePath, verify }) => {
    writeFileSync(sourcePath, "{}");
    expect(verify).toThrow("bundle bytes");
  });
});

test("rejects stale revision, captured tree and altered ordered file fingerprints", () => {
  fixture(({ manifest, saveManifest, verify }) => {
    manifest.revision = "d".repeat(40);
    saveManifest();
    expect(verify).toThrow("approved catalog");
  });
  fixture(({ manifest, saveManifest, verify }) => {
    if (manifest.projects[0]) {
      manifest.projects[0].project_source_tree = "e".repeat(40);
    }
    saveManifest();
    expect(verify).toThrow("recorded source");
  });
  fixture(({ manifest, saveManifest, verify }) => {
    manifest.projects[0]?.files.reverse();
    saveManifest();
    expect(verify).toThrow();
  });
});

test("rejects missing, extra, nested and symlink source outputs", () => {
  fixture(({ sourcePath, verify }) => {
    rmSync(sourcePath);
    expect(verify).toThrow("missing or unapproved");
  });
  fixture(({ sourcePath, verify }) => {
    writeFileSync(join(dirname(sourcePath), "retired-project.json"), "{}");
    expect(verify).toThrow("missing or unapproved");
  });
  fixture(({ sourcePath, verify }) => {
    mkdirSync(join(dirname(sourcePath), "nested"));
    expect(verify).toThrow("missing or unapproved");
  });
  fixture(({ sourcePath, noticePath, verify }) => {
    rmSync(sourcePath);
    symlinkSync(noticePath, sourcePath);
    expect(verify).toThrow("missing or unapproved");
  });
});

test("rejects missing, modified and symlinked legal notices", () => {
  fixture(({ noticePath, verify }) => {
    rmSync(noticePath);
    expect(verify).toThrow();
  });
  fixture(({ noticePath, verify }) => {
    writeFileSync(noticePath, "Changed synthetic notice");
    expect(verify).toThrow("legal notices");
  });
  fixture(({ noticePath, sourcePath, verify }) => {
    rmSync(noticePath);
    symlinkSync(sourcePath, noticePath);
    expect(verify).toThrow("regular files");
  });
});

test("rejects unapproved project names and capture paths even after updating outer hashes", () => {
  fixture(({ bundle, saveBundle, verify }) => {
    bundle.project = "templates/premium/example";
    saveBundle(true);
    expect(verify).toThrow();
  });
  fixture(({ bundle, saveBundle, verify }) => {
    if (bundle.files[0]) {
      bundle.files[0].path = ".reference/source.html";
    }
    saveBundle(true);
    expect(verify).toThrow();
  });
});

test("rejects stale current publication revision, tree, notice and implementation bindings", () => {
  for (const field of [
    "source_revision",
    "source_tree",
    "implementation_sha256",
    "notices_sha256",
    "source_notices_sha256",
  ] as const) {
    fixture(({ capture, verify }) => {
      capture.publication[field] = field.endsWith("sha256") ? "f".repeat(64) : "f".repeat(40);
      expect(verify).toThrow();
    });
  }
});

test("rejects altered implementation inventories even when bundle and outer hashes are updated", () => {
  fixture(({ bundle, manifest, saveBundle, verify }) => {
    const file = bundle.files[0];
    const entry = manifest.projects[0]?.files[0];
    if (!file || !entry) {
      throw new Error("Synthetic source fixture is incomplete");
    }
    file.content = "<p>Changed synthetic implementation</p>\n";
    file.sha256 = sha256Hex(file.content);
    entry.sha256 = file.sha256;
    saveBundle(true);
    expect(verify).toThrow("recorded source");
  });
  fixture(({ bundle, manifest, saveBundle, verify }) => {
    bundle.files.pop();
    manifest.projects[0]?.files.pop();
    saveBundle(true);
    expect(verify).toThrow("recorded source");
  });
  fixture(({ bundle, manifest, saveBundle, verify }) => {
    const file = {
      path: "worker.js",
      language: "javascript",
      content: "export const example = 1;\n",
      sha256: sha256Hex("export const example = 1;\n"),
    };
    bundle.files.push(file);
    manifest.projects[0]?.files.push({ path: file.path, sha256: file.sha256 });
    saveBundle(true);
    expect(verify).toThrow("recorded source");
  });
});

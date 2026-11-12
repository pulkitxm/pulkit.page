import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { projectSourceUrl } from "../content/project-source.ts";
import { approvalSchema } from "./experiment-capture-schema.ts";
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
  const capture = {
    project,
    project_source_tree: "c".repeat(40),
    notices_sha256: notices.sha256,
    source_notices_sha256: notices.sha256,
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
    project_source_tree: capture.project_source_tree,
    href: projectSourceUrl(project),
    sha256: "",
    bytes: 0,
    files: bundle.files.map(({ path, sha256 }) => ({ path, sha256 })),
    notices: { ...notices },
    source_notices_sha256: capture.source_notices_sha256,
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

test("accepts a complete synthetic source artifact with exact file and full notice bindings", () => {
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

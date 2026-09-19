# Repository policies

[Documentation index](index.md) · [Quality checks](quality-checks.md)

The repository rejects source-code comments, literal em dash characters, and unused JavaScript/TypeScript code. These checks run locally, in GitHub CI, and against the staged index in pre-commit. They report failures without rewriting files. The sections below describe those checks, the formatting and validation gates around them, and the conventions that no check can enforce.

## Scope

The inventory comes from `git ls-files --cached --others --exclude-standard --deduplicate`. It includes every existing tracked file, even files force-tracked inside ignored folders, and nonignored new files. Deleted working-tree paths are omitted. The pre-commit hook runs the same checks on a temporary staged snapshot, so unstaged repairs cannot hide staged violations.

Known binary media and fonts have no source-code comment syntax and are excluded from text parsing. Other files must be valid UTF-8; unexpected binary data and repository symlinks fail. There is no directory exclusion for tracked documentation or fixtures.

## No em dashes

[check-em-dashes.ts](../tooling/checks/src/commands/check-em-dashes.ts) rejects the literal Unicode U+2014 character in repository text, including strings, Markdown, JSON, HTML templates, and code examples. It reports filenames and line numbers. Use ordinary punctuation instead. Test fixtures construct the character at runtime to test the rejection without storing it literally.

## No source-code comments

[check-comments.ts](../tooling/checks/src/commands/check-comments.ts) parses syntax rather than searching every slash or hash as a comment.

- Tree-sitter handles JavaScript, TypeScript, JSX/TSX, CSS, shell, Python, Ruby, Lua, Swift, Rust, C/C++, Java, Kotlin, Go, TOML, JSON/JSONC, and other explicitly registered languages.
- YAML concrete-syntax tokens distinguish comments from quoted and block scalars.
- Remark finds Markdown frontmatter, raw HTML, and code fences. Fenced examples are checked according to their declared language, except examples in Markdown under any `apps/<app>/content/`, which preserve their original comments.
- parse5 finds HTML/SVG/XML comments, embedded scripts/styles, JSON-LD, and generated code examples. HTML entities in code examples are decoded before scanning. Actual HTML comments and embedded scripts/styles remain checked everywhere.
- Small syntax-aware lexers handle SQL comments and quoted/dollar-quoted strings, hash-comment configuration languages, and Mermaid comments.
- Python docstrings count as documentation comments. All lint directives, coverage directives, documentation comments, and license comments count as comments. Third-party plain-text license files remain ordinary text.

A shebang at byte zero is executable interpreter metadata and is accepted. Strings containing comment-like characters are not comments. Plain-text output, HTTP examples, and math fences have no code-comment interpretation, but still participate in the em-dash check.

Unknown source types and unknown fence languages cause a failure requesting an explicit parser registration. This prevents newly added languages from silently bypassing checks. The scanner uses error-tolerant syntax trees for partial tutorial snippets; it is a policy check, not a compiler or proof that example code is runnable. Code examples in content Markdown retain their original comments and formatting.

## Knip

[knip.json](../knip.json) configures each workspace separately. The engine declares its CLI modules and test setup as entries, embeds declare their `client/*.js` browser scripts, demos declare `index.js`, and checks declare their `check-*.mjs` CLIs; package `exports` and `bin` fields supply the rest. Apps have no JavaScript of their own and ignore their `@pulkit/theme` dependency, which is consumed through CSS. `includeEntryExports` also checks unnecessary public exports in entry points.

`bun run check:dead-code` runs pinned Knip with zero tolerated issues and treats configuration hints as errors. There are no unused-file/export/dependency allowlists. Keep exports that have real consumers; SEO validation now imports the shared HTML escaping helper. Export necessity follows the current dependency graph, not an earlier cleanup count.

Knip is static analysis, not a guarantee about runtime reachability or a CSS/image/Markdown garbage collector. Dynamic use must be modeled with an explicit legitimate entry point. Do not add every source file as an entry to silence unused-file findings.

## Formatting and validation gates

These are enforced too, and every one of them runs inside `bun run ci`:

| Gate                          | Tool                                                                      | Rule                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `format:check`, `lint`        | Biome with the root [biome.json](../biome.json)                           | Space indentation, 100 columns, LF, and the strict lint presets; warnings fail `lint`      |
| `check:content`               | [check-content.ts](../tooling/checks/src/commands/check-content.ts)       | The content schema plus canonical Markdown and YAML formatting for every tracked document  |
| `check:repository`            | [check-repository.ts](../tooling/checks/src/commands/check-repository.ts) | Lowercase kebab-case source paths, no symlinks, size limits, LF endings, trailing newlines |
| `check:imports`               | [check-imports.ts](../tooling/checks/src/commands/check-imports.ts)       | Every static import in `apps/`, `packages/`, and `tooling/` resolves at runtime            |
| `check:dead-code`             | Knip with [knip.json](../knip.json)                                       | No unused files, exports, or dependencies, with no tolerated issues                        |
| `check:layouts`, `check:html` | html-validate with [.htmlvalidate.json](../.htmlvalidate.json)            | Valid HTML in the layout templates and in every built page                                 |
| `check:shell`                 | `sh -n`                                                                   | The hook and its installer parse                                                           |

Documentation files follow the same content rules as pages, minus the frontmatter:
lowercase kebab-case names except `README.md`, exactly one H1, no duplicate heading
text, labeled lowercase code fences with no fence metadata, canonical Remark
formatting, one trailing newline, and no comments inside fenced examples, because
the comment scanner exempts only Markdown under `apps/<app>/content/`.
[Quality checks](quality-checks.md) covers what each gate proves and what it misses.

## Contribution conventions

These are review conventions rather than checks, so nothing fails when they are
ignored:

- No AI attribution anywhere: not in commit messages, code, branch names, pull
  request titles or descriptions, or documentation.
- Pull request descriptions are one line.
- Merge with a squash merge, then delete the branch.
- GitHub mutations (opening pull requests, merging, commenting) go through the
  owner's Pukbot CLI, a GitHub App wrapper, rather than a personal token.

## Commands

```sh
bun run check:comments
bun run check:em-dashes
bun run check:dead-code
bun run ci
```

For fixes, edit the source Markdown or code, run `bun run format`, and rerun CI. Generated HTML is build output in each app's `dist/` and is never edited or committed.

## Regression coverage

[check-comments.test.js](../tooling/checks/src/check-comments.test.js) covers quotes, regex URLs, JavaScript template interpolation, JSX, Python docstrings and multiline strings, shell parameter expansion and heredocs, YAML block scalars, JSONC, nested SQL/Swift comments, Lua block comments, embedded HTML languages, Markdown fences, generated code blocks, unsupported languages, offsets, and em dashes.

[policy-ci.test.js](../tooling/checks/src/policy-ci.test.js) verifies read-only failures for force-tracked ignored files and demonstrates that Knip fails on unused files, exports, and dependencies, then passes after those problems are removed.

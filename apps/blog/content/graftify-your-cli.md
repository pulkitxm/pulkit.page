---
title: Giving AI Agents a CLI, Out of the Box
description: How I turned every Quinjet command into an MCP tool that Claude Code, Codex, Cursor and
  other agents start on their own, with one shared Graftcode gateway that installs, starts and stops
  itself.
date: 2026-11-17
tags:
  - MCP
  - CLI
  - Rust
  - Graftcode
  - AI
  - Agents
---

[Quinjet](https://github.com/pulkitxm/quinjet) is my Git and GitHub client for the terminal. It has a keyboard-first interface, and underneath it a full command line: `quinjet status`, `quinjet pr checks 42`, `quinjet pr reviews resolve`, and about a hundred more, each of which can print one JSON document with `--json`.

Coding agents already live in the terminal, so the obvious question was: why does my agent still shell out to `git` and `gh`, guess flags, and scrape text tables, when the tool next to it already answers in clean JSON?

This post is how I made every Quinjet command an agent tool, with one rule I would not bend: **nobody starts a server in a separate terminal.** You connect your agents once, and from then on it just works, whether Quinjet is open or not.

## TL;DR

- Every command in Quinjet's [clap](https://docs.rs/clap) tree becomes an MCP tool. Names, parameters and descriptions are derived from the command definitions, so the tools cannot drift from the CLI.
- Every tool answers with the exact JSON that `quinjet <command> --json` prints.
- Agents launch `quinjet mcp` themselves over stdio. It answers the tool list instantly and forwards calls to one shared [Graftcode](https://graftcode.com) gateway.
- Quinjet downloads that gateway on first use, checks its SHA-256, starts it in the background, protects it with a per-start token, and stops it ten minutes after the last client leaves.
- `quinjet mcp install` adds Quinjet to Claude Code, Codex, Cursor, VS Code, Windsurf and Gemini CLI in one go.
- Reads are marked read-only. The 47 commands that need confirmation only preview what they would do until the agent calls them again with `yes`.

## The Problem With Agents and Shells

Give an agent a shell and a GitHub task, and you can watch it work hard for little. To find out why a check failed, it runs `gh pr checks`, reads a job id out of a URL, runs `gh run view` with that id, then searches a log of several thousand lines. To answer a review comment, it discovers there is no `gh` command for line comments or thread replies, and writes a GraphQL mutation by hand. Every step is free text the agent has to parse, and every command is another permission prompt that has to pattern-match a command line.

I wanted the agent to see a list of typed tools, call `prLogs` with the link `prChecks` gave it, and get back the failing job's steps with their own log lines. One call, structured answer.

The usual way to get there is to write an MCP server by hand. I did not want a second list of tools to maintain forever, and I did not want users to run anything themselves.

## Tools From the Command Tree

Quinjet's commands are defined once, with clap's derive API. clap can hand back the whole tree at runtime, so the tool list is a walk over it:

```rust
fn collect_leaves(command: &clap::Command, parent: &[String], leaves: &mut Vec<Vec<String>>) {
    for child in command.get_subcommands().filter(|child| child.get_name() != "help") {
        let mut path = parent.to_vec();
        path.push(child.get_name().to_owned());
        if child.get_subcommands().any(|nested| nested.get_name() != "help") {
            collect_leaves(child, &path, leaves);
        } else {
            leaves.push(path);
        }
    }
}
```

Each leaf becomes a method. The command path turns into a camel-case name (`pr checks` is `prChecks`, `pr reviews resolve` is `prReviewsResolve`). Every argument becomes a parameter: positionals and options become strings, switches become booleans, and the help text, possible values and defaults become the parameter description. The command's own `about` text becomes the tool description.

Two lists keep it honest. A short allowlist says which commands only read. A host-only list removes what makes no sense for an agent: the terminal interface itself, opening a browser, switching the account a repository commits as, shell completions. Everything else is exposed, and a new command shows up as a new tool the next time Quinjet is built.

The input schema an agent sees for `prChecks` looks like this:

```json
{
  "type": "object",
  "properties": {
    "number": { "type": "string", "description": "Pull request number. Required" },
    "refresh": {
      "type": "boolean",
      "description": "Ask GitHub again instead of answering from the cache. true or false. Optional, false by default"
    },
    "repository": {
      "type": "string",
      "description": "Path of the Git repository to use. Optional; defaults to the folder the agent started in"
    }
  },
  "required": ["number"]
}
```

## Hosting It on Graftcode

[Graftcode](https://graftcode.com) hosts plain methods on a gateway called `gg` and makes them callable as MCP tools, as typed packages for npm, PyPI, NuGet and others, and from a browser console called Vision. You hand it a module, it does the protocol work.

So Quinjet generates a small Node module from the same tree. Each method shells out to Quinjet and returns its JSON:

```js
class Quinjet {
  /**
   * List a pull request's checks
   */
  static async prChecks(number, repo, refresh, repoPath, accessToken) {
    return invoke("pr checks", { number, repo, refresh }, repoPath, accessToken);
  }
}
```

`invoke` builds the argument list (`quinjet pr checks 42 --json`), runs it with `execFile` in the right repository, and rejects with the command's error text when it exits non-zero. Graftcode turns the JSDoc into the tool description and the method into an MCP tool.

`gg` itself starts with a single command:

```sh
gg --runtime nodejs --modules index.js --types Quinjet --port 7381 --httpPort 7382
```

That gives MCP at `/mcp`, Vision at `/GV` and a WebSocket endpoint for the typed clients. It also gives two problems for a zero-setup design: `gg` listens on every network interface with no authentication of its own, and it has no stdio mode, which is how local agents prefer to start MCP servers.

## A Tiny Stdio Server in Front

Agents never talk to `gg` directly. They start `quinjet mcp`, a small stdio server inside the Quinjet binary:

```text
 Claude Code, Codex, Cursor,          Quinjet terminal
 VS Code, Windsurf, Gemini CLI        (opens the gateway on launch)
          │ starts                               │
          ▼                                      ▼
   quinjet mcp  ──── MCP over HTTP ────►  shared Graftcode gateway (gg)
   (stdio, one per agent session)         one per machine
                                                 │
                                                 ▼
                                  quinjet <command> --json
                                  in the agent's repository
```

`quinjet mcp` answers `initialize`, `ping` and `tools/list` straight from the command tree, so the agent sees its tools before anything else has started. On the first `tools/call` it makes sure the shared gateway is running and forwards the call over HTTP, adding two hidden arguments: the repository root of the folder the agent started in, and the gateway's access token. The generated module refuses any call without that token, so a neighbour on the same network can load the Vision page but cannot run a command.

Each call runs on its own thread, so an agent can read a diff while a slow `pr logs` is still downloading.

## A Gateway Nobody Has to Run

The shared gateway is where "out of the box" is won or lost. Quinjet manages it end to end:

1. **Find or fetch `gg`.** Quinjet looks at `--gateway`, then `QUINJET_GRAFTCODE_GATEWAY`, then `PATH`, then its own cache. If there is none, it reads Graftcode's latest GitHub release, picks the archive for this platform, checks it against the SHA-256 digest GitHub publishes for the asset, and unpacks it into the cache. No installer menu, no `sudo`, nothing on `PATH`.
2. **Start it once.** A start lock (a file created with `create_new`) makes sure three agents opening at the same moment still get one gateway. Quinjet starts a detached `quinjet graft daemon` in its own process group, which picks a free port pair, writes the module, generates a fresh 48-character token, starts `gg`, waits for its status endpoint, and records the port and token in a `state.json` only your account can read.
3. **Stay alive while used.** Every client, an agent session or an open Quinjet window, holds a lease file it touches every 30 seconds. Every tool call touches an activity stamp.
4. **Leave when idle.** Ten minutes after the last lease goes stale, the daemon stops `gg`. The next call starts it again in about two seconds.
5. **Upgrade itself.** The state records Quinjet's version and a digest of the generated module. A newer Quinjet notices the old gateway, asks it to stop, and starts its own.

Opening the Quinjet terminal app starts the same gateway, and the status bar shows `Graftcode ●` while it is up.

## Connecting Every Agent at Once

The last piece of setup is telling agents the server exists. Every agent keeps that in a different place, so Quinjet writes it for you:

```sh
quinjet mcp install
```

```text
claude-code  connected          via claude mcp add
codex        connected          ~/.codex/config.toml
cursor       already connected  ~/.cursor/mcp.json
```

For Claude Code it runs `claude mcp add --scope user quinjet -- quinjet mcp`. Codex gets a TOML section:

```toml
[mcp_servers.quinjet]
command = "quinjet"
args = ["mcp"]
```

Cursor, Windsurf and Gemini CLI get an `mcpServers` entry in their JSON settings, and VS Code gets a `servers` entry with `"type": "stdio"`. Other entries in those files are kept, running it twice changes nothing, and a file that is not plain JSON is left alone with the entry printed for you to add. The same action lives in Quinjet's command palette as **Connect AI Agents to Quinjet**.

That is the entire user-facing setup. Open your agent in any repository and ask it why the build is red.

## Letting Agents Change Things Safely

The first version only exposed the 23 reading commands. That was safe, but an agent that can diagnose a failing check and not stage the fix is only half useful. Today all 94 tools are exposed, with three layers of safety.

**Confirmation becomes a preview.** On the command line, risky Quinjet commands already take `--yes`, and without it they only say what they would do. That maps perfectly onto agents. A first call previews, a second call acts:

```json
{ "name": "discard", "arguments": { "paths": "notes.txt" } }
```

```json
{ "message": "Would discard 1 change(s): notes.txt. Pass --yes to discard them." }
```

```json
{ "name": "discard", "arguments": { "paths": "notes.txt", "yes": true } }
```

**Annotations tell the agent what is what.** Reads carry `readOnlyHint`. The 47 tools that take `yes`, such as `discard`, `branchDelete`, `prMerge` and `stackSync`, carry `destructiveHint`. An agent like Claude Code can run reads without asking and stop to ask you before anything destructive.

**A read-only switch.** `quinjet mcp --read-only`, or `quinjet mcp install --read-only`, offers only the reading tools. A write tool name then gets "Quinjet has no tool called `commit`".

None of this grants new access. Every command runs with your existing Git and `gh` credentials, exactly as if you had typed it.

## Things That Bit Me

Most of the time went into details no documentation mentioned.

**Missing arguments shift the rest.** `gg` binds MCP arguments by name only when all of them are present. Leave one out and the others bind by position, so `limit` quietly lands in `skip`. The fix is to always send every parameter, with `""` for unused ones, which is why `quinjet mcp` fills the full argument list before forwarding.

**Use `static async` methods.** A plain function that returns a rejected promise never answers; the call just hangs. An `async` method that throws after an `await` comes back as a proper tool error. Every generated method is `static async`.

**JavaScript reserved words.** `quinjet branch rename <OLD> <NEW>` produced a method parameter called `new`, and `stack rebase --continue` one called `continue`. Both are reserved words, so the whole write-enabled module failed to load. The fix was to rename the Rust argument ids (`new_name`, `old_name`, `resume`) while keeping the flags users type, plus a test that fails if any tool parameter is ever a reserved word again.

**No Node or npm, with one Linux catch.** I expected to need Node on the machine. It turns out `gg` ships its own Node runtime as a shared library and extracts it next to the module, so with Node and npm removed from `PATH` the gateway still starts and serves every tool. On Linux, though, that bundled `libnode` links against `libatomic`, which the minimal Ubuntu, Debian and Fedora images leave out. The gateway then exits with "Cannot find Node.js installed on this machine", which sends you looking in exactly the wrong place, since installing Node does not help. Quinjet now runs `ldd` on the bundled library when the gateway dies at startup and answers with the missing library and the one package to install. Alpine and other musl systems cannot run `gg` at all, so Quinjet says so before downloading 120 MB.

**Two agents, two downloads.** On a fresh machine the agent's warm-up and its first tool call both noticed `gg` was missing and both downloaded it, and the second unpack could pull the binary out from under the first. Installs now take their own lock, and whoever waits finds the finished copy instead of fetching another.

**Agents strip the environment.** Quinjet also has a few Claude-powered commands, like `quinjet ai investigate 42`. Some MCP clients start servers with a minimal environment, so `ANTHROPIC_API_KEY` from your shell never arrives. `quinjet ai key` saves the key to a file only your account can read, and the commands fall back to it.

**Hints never reached the agent.** Quinjet's errors carry a hint for humans, like "pass `--gateway` with the path of a `gg` you already have". The MCP bridge only forwarded the message, so the agent never saw the useful half. Tool errors now include the hint line too.

## Why Not Just Use gh?

Agents can already run `git` and `gh`, and Quinjet uses `gh`'s sign-in underneath, so this was never about access. It is about how much work the agent does per answer.

| Task                    | `git` and `gh` in a shell                                                                             | Quinjet tools                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Why did a check fail?   | `gh pr checks`, pull the job id out of the URL, `gh run view --job <id> --log`, search the whole log  | `prChecks`, then `prLogs` with the check's link: the job's steps, each with its own lines      |
| What did reviewers say? | `gh pr view --comments` leaves out inline line comments; those need `gh api`                          | `prConversation`: the timeline and inline comments as one thread                               |
| Answer review threads   | No command adds a line comment, replies to a thread or resolves one; the agent writes GraphQL by hand | `prReviewsShow`, `prReviewsComment`, `prReviewsReply`, `prReviewsSubmit`, `prReviewsResolve`   |
| Is it ready to merge?   | `gh pr view --json` with field names the agent has to know, plus `gh pr checks`                       | `prView`: review decision, merge state, auto-merge, merge queue and permissions from one query |
| Review a stack          | The gh-stack extension, one pull request at a time                                                    | `stackDiff` and `stackFiles` across any range of the stack in one patch                        |
| Commit and push         | `git add`, `git commit`, `git push`, each a shell command to approve                                  | `stage`, `commit`, `push` with typed arguments                                                 |

Beyond the table, the agent gets a fixed JSON shape per tool instead of text to parse, schemas instead of `--help` and guessed flags, local Git and GitHub in one catalog, and permissions that follow the tool's real risk instead of a command-line pattern.

`gh` is still the right tool for what Quinjet does not do: creating and listing pull requests, issues, releases, re-running workflows and arbitrary API calls.

## Results

- The tool list grew from 27 read-only tools to 94, without a single hand-written tool definition.
- The first call after a cold start takes about two seconds while the gateway comes up. Later calls take tens of milliseconds.
- One gateway serves every agent session and every repository on the machine. It costs a few hundred megabytes of memory while running, which is why it shuts itself down when nobody needs it.
- Setup is one command, or one palette entry, per machine.
- I ran the whole flow through MCP from a clean start, with no Node installed: macOS on Apple silicon, and containers of Ubuntu 24.04 with curl, Debian 12 with only wget, Fedora 41, and Ubuntu as a non-root user. Each downloaded `gg` once and served every tool. Bare images without a downloader or without `libatomic`, and Alpine, each get an error that names the fix instead of a stack trace.

A typical session in a scratch repository, driven only through MCP, looks like this:

```text
> stage {"paths": "widgets.rs"}                          1 change staged
> commit {"message": "feat(widgets): add the fetcher"}   Commit created
> discard {"paths": "notes.txt"}                         Would discard 1 change(s): notes.txt. Pass --yes to discard them.
> discard {"paths": "notes.txt", "yes": true}            1 change discarded
> branchCreate {"name": "feat/widget-cache"}             Created and switched to feat/widget-cache
> log {"limit": "1"}                                     [{"author": "Ada Example", "subject": "feat(widgets): add the fetcher", ...}]
```

## What I Would Tell You to Copy

If you maintain a CLI and want agents to use it well, you probably do not need to write an MCP server by hand:

1. Give every command a `--json` output with a stable shape. That is your tool response.
2. Generate the tool list from the command definitions you already have, so it never drifts.
3. Keep confirmation semantics: preview without `yes`, act with it, and mark those tools as destructive.
4. Do the lifecycle work for the user. Download, verify, start, share, and stop the server yourself, and write the agent configs yourself.

Quinjet is open source at [github.com/pulkitxm/quinjet](https://github.com/pulkitxm/quinjet), and the Graftcode gateway is at [graftcode.com](https://graftcode.com).

---
title: Graftify Your CLI
description: A short idea for anyone who maintains a command line tool. Turn every command into a
  tool AI agents can call, with zero setup, by hosting it on a Graftcode gateway that installs,
  starts and stops itself.
date: 2026-11-17
tags:
  - MCP
  - CLI
  - Graftcode
  - Agents
---

Watch an agent try to find out why a CI check failed. It runs `gh pr checks`, copies a job id out of a URL, pulls down a few thousand lines of log and searches them for the word "error". It gets there in the end, but most of its effort goes into work a better tool could have done in one call.

That gap is what this post is about. Agents live in the terminal, and the terminal is full of tools that already know how to answer well. A good CLI describes itself completely. Every command has a name, typed arguments and help text, and many can print JSON. That is exactly what an agent tool is: a schema and a structured answer. We just never hand it over.

Handing it over should not mean writing an MCP server by hand and keeping a second copy of your command list in sync forever. With [Quinjet](https://github.com/pulkitxm/quinjet), my Git client, I let the commands generate the tools instead, and let a [Graftcode](https://graftcode.com) gateway serve them. Each tool runs the command it came from and returns the same JSON. When I add a command, agents get a new tool on the next build, and nothing drifts.

What decides whether anyone actually uses it is setup, and my rule there was strict: nobody starts a server. People will not open a second terminal so their agent can work. So the agent launches Quinjet itself. Quinjet fetches and verifies the gateway the first time it is needed, keeps one running quietly in the background for every agent on the machine, and shuts it down when nobody needs it anymore. A single command writes the config for every agent you have installed. After that it simply works, in any repository, whether Quinjet is open or not.

Letting agents change things turned out to be easier than I feared, because good CLIs solved it long ago. A command that would ask "are you sure?" now tells the agent what it would do, and only acts when the agent asks again with an explicit yes. Those tools are marked as destructive, so the agent checks with you first, and if that is still too much trust, one flag makes everything read-only.

Quinjet now offers agents 94 tools, from status and commits to review threads and check logs, and it runs on macOS and Linux without Node or anything else installed first. Compared with `gh` in a shell, the difference is not access but effort: one call per answer instead of a chain of commands and text to parse.

The whole change lives in [one pull request](https://github.com/pulkitxm/quinjet/pull/161) if you want to see how the pieces fit. Your CLI is probably closer to this than you think. If it already prints JSON, most of the work is done. Graftify it.

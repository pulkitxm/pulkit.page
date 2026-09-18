#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ "${CI:-}" = "true" ] || [ ! -e .git ]; then
  exit 0
fi
existing=$(git config --get core.hooksPath || true)
if [ -n "$existing" ] && [ "$existing" != '.githooks' ]; then
  printf '%s\n' "Existing core.hooksPath is $existing; integrate .githooks/pre-commit there or set core.hooksPath to .githooks." >&2
  exit 1
fi
git config --local core.hooksPath .githooks
printf '%s\n' 'Installed pre-commit checks.'

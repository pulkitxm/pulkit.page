#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
exec bun scripts/generate.mjs "$@"

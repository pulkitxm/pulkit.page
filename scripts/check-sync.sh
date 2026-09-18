#!/bin/sh
set -eu
exec "$(dirname "$0")/generate.sh" --check

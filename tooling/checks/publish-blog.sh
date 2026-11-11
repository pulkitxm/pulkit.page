#!/bin/sh
set -eu
if [ "${GITHUB_EVENT_NAME:-}" != workflow_dispatch ] || [ "${GITHUB_REF:-}" != refs/heads/main ] || [ "${BLOG_PUBLISH_APPROVED:-}" != true ]; then
  printf '%s\n' 'Blog publishing requires an approved manual dispatch on main with publish=true.' >&2
  exit 1
fi
if [ -z "${GH_TOKEN:-}" ] && ! gh auth status --hostname github.com >/dev/null 2>&1; then
  printf '%s\n' 'An existing authenticated GitHub session or approved BLOG_PUBLISH_TOKEN is required. Use the local gh session or a target-only token with Contents read/write.' >&2
  exit 1
fi
case "${SOURCE_REVISION:-}" in
  ''|*[!0-9a-f]*) printf '%s\n' 'A verified source revision is required.' >&2; exit 1 ;;
esac
if [ "${#SOURCE_REVISION}" -ne 40 ]; then
  printf '%s\n' 'The verified source revision must be a full commit SHA.' >&2
  exit 1
fi
build=${1:-apps/blog/dist}
publisher=${PUKBOT_BIN:-pukbot}
for command in git gh python3 "$publisher"; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf '%s\n' "Missing publishing command: $command" >&2
    exit 1
  fi
done
for file in index.html 404.html CNAME feed.xml sitemap.xml my-first-talk/index.html; do
  if [ ! -f "$build/$file" ]; then
    printf '%s\n' "Missing verified blog artifact: $file" >&2
    exit 1
  fi
done
if [ "$(cat "$build/CNAME")" != pulkit.blog ] || [ -n "$(find "$build" -name .git -o -name .github -o -type l)" ]; then
  printf '%s\n' 'Invalid blog artifact domain, Git metadata, workflow files or symlinks.' >&2
  exit 1
fi
gh api repos/pulkitxm/pulkit.blog --jq '.permissions.push == true' | grep -qx true || {
  printf '%s\n' 'BLOG_PUBLISH_TOKEN cannot write pulkitxm/pulkit.blog. Check its repository selection and Contents read/write permission.' >&2
  exit 1
}
publish=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/blog-publish.XXXXXX")
trap 'rm -rf "$publish"' EXIT
trap 'exit 1' HUP INT TERM
cp -R "$build"/. "$publish"/
touch "$publish/.nojekyll"
python3 - "$publish" "$SOURCE_REVISION" <<'PYCODE'
import hashlib
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
receipt = {
    "source_repository": "pulkitxm/pulkit.page",
    "source_revision": sys.argv[2],
    "index_sha256": hashlib.sha256((root / "index.html").read_bytes()).hexdigest(),
    "article_sha256": hashlib.sha256((root / "my-first-talk/index.html").read_bytes()).hexdigest(),
}
(root / "publication.json").write_text(json.dumps(receipt, sort_keys=True) + "\n")
PYCODE
cd "$publish"
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES
git init -q -b gh-pages
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git config 'credential.https://github.com.helper' '!gh auth git-credential'
git remote add origin https://github.com/pulkitxm/pulkit.blog.git
git fetch -q --depth 1 origin gh-pages
git reset -q --soft FETCH_HEAD
git add -A
if git diff --cached --quiet; then
  printf '%s\n' 'pulkit.blog is already up to date'
  exit 0
fi
expected=$(git rev-parse HEAD)
current=$(git ls-remote origin refs/heads/gh-pages | cut -f1)
if [ "$current" != "$expected" ]; then
  printf '%s\n' 'The blog publishing branch changed. Review the latest target and retry.' >&2
  exit 1
fi
"$publisher" commit create --repo pulkitxm/pulkit.blog --branch gh-pages --message "Publish pulkit.blog from pulkitxm/pulkit.page@$SOURCE_REVISION" --dry-run --json >/dev/null
"$publisher" commit create --repo pulkitxm/pulkit.blog --branch gh-pages --message "Publish pulkit.blog from pulkitxm/pulkit.page@$SOURCE_REVISION" --json
printf '%s\n' 'Published the verified blog artifact through Pukbot.'

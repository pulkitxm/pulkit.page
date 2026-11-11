#!/bin/sh
set -eu
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  ffmpeg -version
  ffprobe -version
  exit 0
fi
media_source=${1:-/etc/apt/sources.list.d/ubuntu.sources}
media_temp=$(mktemp -d "${TMPDIR:-/tmp}/media-tools.XXXXXX")
trap 'sudo rm -rf "$media_temp"' EXIT
trap 'exit 1' HUP INT TERM
mkdir -p "$media_temp/lists/partial" "$media_temp/cache/archives/partial"
chmod 755 "$media_temp"
sed -E 's#(mirror\+file:/etc/apt/apt-mirrors\.txt|https?://(azure\.archive|archive|security)\.ubuntu\.com/ubuntu/?)#https://mirrors.edge.kernel.org/ubuntu/#g' "$media_source" > "$media_temp/ubuntu.sources"
chmod 444 "$media_temp/ubuntu.sources"
media_apt() {
  media_program=$1
  media_timeout=$2
  shift 2
  sudo timeout "$media_timeout" "$media_program" \
    -o Dir::Etc::sourcelist="$media_temp/ubuntu.sources" \
    -o Dir::Etc::sourceparts=- \
    -o Dir::State::lists="$media_temp/lists" \
    -o Dir::Cache::pkgcache="$media_temp/cache/pkgcache.bin" \
    -o Dir::Cache::srcpkgcache="$media_temp/cache/srcpkgcache.bin" \
    -o Dir::Cache::archives="$media_temp/cache/archives" \
    -o Acquire::Retries=2 \
    -o Acquire::http::Timeout=15 \
    -o Acquire::https::Timeout=15 "$@"
}
media_apt apt-config 30s shell MEDIA_APT_NATIVE APT::Architecture MEDIA_APT_VARIANTS APT::Architecture-Variants MEDIA_APT_LISTS Dir::State::lists MEDIA_APT_CACHE Dir::Cache::pkgcache MEDIA_APT_SOURCE Dir::Etc::sourcelist
media_apt apt-get 180s update
media_apt apt-get 30s indextargets --format "\$(FILENAME) \$(ARCHITECTURE)"
sudo find "$media_temp/lists" -maxdepth 1 -type f -printf '%f\n'
media_apt apt-cache 30s policy ffmpeg
media_apt apt-get 300s install --no-install-recommends -y ffmpeg
ffmpeg -version
ffprobe -version

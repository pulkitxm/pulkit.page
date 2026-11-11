#!/bin/sh
set -eu
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  ffmpeg -version
  ffprobe -version
  exit 0
fi
sudo sed -i -E 's#(mirror\+file:/etc/apt/apt-mirrors\.txt|https?://(azure\.archive|archive|security)\.ubuntu\.com/ubuntu/?)#https://mirrors.edge.kernel.org/ubuntu/#g' /etc/apt/sources.list.d/ubuntu.sources
media_apt() {
  media_timeout=$1
  shift
  sudo timeout "$media_timeout" apt-get \
    -o Dir::Etc::sourcelist=/etc/apt/sources.list.d/ubuntu.sources \
    -o Dir::Etc::sourceparts=- \
    -o Acquire::Retries=2 \
    -o Acquire::http::Timeout=15 \
    -o Acquire::https::Timeout=15 "$@"
}
media_apt 180s update
media_apt 300s install --no-install-recommends -y ffmpeg
ffmpeg -version
ffprobe -version

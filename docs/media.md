# Media budgets and optimization

[Documentation index](index.md) · [Authoring guide](authoring-guide.md)

Keep committed media ready to serve. The media validator inspects file contents,
not just extensions. It reports failures without rewriting files. The optimizer
works on explicitly supplied files and validates its output before replacing an
existing asset. It leaves compliant files byte-for-byte unchanged.

Run `bun run check:media` to inspect every Git-listed image and video, including
force-tracked files in ignored directories. The read-only gate runs directly in
GitHub Actions before repair and again afterward, outside Turbo caching. A violation
prints the affected path, policy, and optimization command. Local pre-commit checks
allow raw media uploads so CI can repair them; `bun run check:media` is available
locally when an explicit validation is wanted.

## Formats and limits

| Media                                         | Format                | Resolution                           | File budget | Other limits                                |
| --------------------------------------------- | --------------------- | ------------------------------------ | ----------- | ------------------------------------------- |
| Photos, screenshots, diagrams                 | WebP or AVIF          | Longest edge 2048 px                 | 512 KiB     | Static, orientation baked into pixels       |
| Vectors                                       | SVG                   | Scalable                             | 64 KiB      | Valid SVG                                   |
| Short image animations                        | Animated WebP         | Longest edge 1280 px                 | 1 MiB       | 600 frames and 30 seconds maximum           |
| Recordings and demos                          | MP4, H.264, AAC audio | 1920 × 1080 px in either orientation | 20 MiB      | 60 fps, 120 seconds, 4 Mbps average maximum |
| Gallery hover previews, named `*-preview.mp4` | MP4, H.264, no audio  | Longest edge 480 px                  | 512 KiB     | 24 fps, 6 seconds, 1 Mbps average maximum   |

All videos require `yuv420p` pixels and fast-start playback metadata before the
media data. Recordings may have one AAC audio stream. Subtitles, attachments,
extra tracks, and rotation metadata must be removed or baked into the video.
Videos beyond the duration or byte budget need an editorial cut or an external
video host. The optimizer never truncates a full recording to pass the check.

Three exact paths have format exceptions: `packages/theme/assets/apple-touch-icon.png`
is limited to 180 px and 32 KiB, `packages/theme/assets/favicon-32.png` to 32 px and
8 KiB, and the build-only social-card input `packages/theme/og/portrait.jpg` to
512 px and 64 KiB. These exceptions do not permit arbitrary PNG or JPEG uploads.
Generated social cards and responsive variants are build output, not committed
assets.

## Optimize a specific asset

CI repairs violations automatically on branches in this repository. It runs the
read-only media check, optimizes only failing assets, updates matching references,
and stages only those paths. Source verification must pass before Pukbot commits
the repairs. The parallel source, test, and site jobs then check out that exact
commit. The aggregate CI result is attached to the verified SHA, without a second
workflow run. Fork pull requests receive the same
validation but cannot publish automatic repairs. Unsupported or unfixable assets
still fail and report the affected file.

The automated command is `bun run media:fix --stage`. It preserves existing
compliant assets, prefers the current format when possible, and tries AVIF if a
still cannot fit the WebP budget. Format changes update content references before
removing the old file. Inline SVG boolean attributes are normalized to valid XML
without changing the paths. Concurrent branch changes stop publication so an older
run cannot overwrite newer work.

Install dependencies with `bun install`. Videos also need FFmpeg and ffprobe:
`brew install ffmpeg` on macOS, or `sudo apt-get install ffmpeg` on Ubuntu.
GitHub Actions installs FFmpeg before verification.

```sh
bun run media:optimize apps/page/assets/content/events/example/photo.jpg
bun run media:optimize --format avif apps/page/assets/content/events/example/photo.jpg
bun run media:optimize apps/page/assets/content/events/example/video.mp4
```

WebP is the default. Existing AVIF files stay AVIF. A format change creates a
sibling file and retains the source. Update every content reference, review the
result, and remove the original before committing. The optimizer refuses to
overwrite a sibling that already exists. Multiple explicit paths are accepted.
There is no automatic repository-wide recompression.

Images keep their aspect ratio and are never enlarged. PNG diagrams first try
lossless WebP so text and fine lines survive exactly when the file budget permits.
Other WebP encodes try quality 85, then 80. AVIF tries quality 65, then 60, with
4:4:4 chroma to retain colored text and edges. These quality scales are different
and are not directly comparable. Encoding stops with an error if the budget
cannot be met at the quality floor. Before failing, it also tries longest-edge
caps at 87.5% and 75% of the maximum, always encoding directly from the source.
For stills these caps are 1792 px and 1536 px, enough for twice the article's
704 px display width. EXIF orientation is applied before removing
metadata. Animated WebP preserves animation timing, loop count, and transparency.

The animation encoder can merge identical frames. GIF delays of 10 ms or less
are normalized to 100 ms, matching browser GIF playback, so the encoded frame
count and nominal duration can change while the displayed timing stays the same.

Try `--format avif` for a detailed photo that exceeds the WebP budget. Update its
references to the new `.avif` path and remove the original after review.

Video optimization first tries a lossless remux to repair container metadata.
If that cannot satisfy the policy, FFmpeg uses H.264 CRF 21 and the slow preset,
copies existing AAC audio, converts other audio to AAC at 128 kbps, and scales only when necessary. Previews are
muted and capped at six seconds. Failed conversions leave the source intact.

The site already generates responsive image copies and browser `srcset`/`sizes`
hints, including AVIF candidates for priority images. AVIF sources also take part
in this pipeline. Smaller screens download smaller copies, while the full image
remains available for zoom. Existing compliant WebP sources are kept to avoid
repeated lossy conversion. Animated WebP retains the existing image-popup behavior;
larger or longer animations should use MP4 video, which compresses motion better.

## Quality review

Compare small text, faces, gradients, transparent edges, and motion against the
source before committing. A passing check establishes technical budgets, not a
perceptual quality score. Keep original masters outside the repository. The
local optimizer does not commit or upload files; CI publishes automatic repairs
through `pukbot commit create` after verification.

The settings follow [Sharp's encoding documentation](https://sharp.pixelplumbing.com/api-output/),
[web.dev's video guidance](https://web.dev/learn/performance/video-performance),
and [FFmpeg's fast-start documentation](https://ffmpeg.org/ffmpeg-formats.html).

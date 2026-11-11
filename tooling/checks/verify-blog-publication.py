import argparse
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


parser = argparse.ArgumentParser()
parser.add_argument("revision")
parser.add_argument("--origin", default="https://pulkit.blog")
parser.add_argument("--attempts", type=int, default=12)
parser.add_argument("--interval", type=float, default=10)
args = parser.parse_args()
if not re.fullmatch("[0-9a-f]{40}", args.revision):
    parser.error("A full verified source revision is required")
origin = urllib.parse.urlparse(args.origin)
if args.origin != "https://pulkit.blog" and not (
    origin.scheme == "http" and origin.hostname in {"127.0.0.1", "localhost"}
):
    parser.error("Only the production blog or a loopback test server is allowed")
if args.attempts < 1 or args.interval < 0:
    parser.error("Invalid retry settings")
client = urllib.request.build_opener(NoRedirect())
withdrawn = [
    f"/assets/content/public/blogs/my-first-talk/{name}.webp"
    for name in ["02", "03", "04", "05", "video-thumbnail"]
] + [
    f"/assets/embeds/{name}.js"
    for name in ["claude-directory", "claude-directory-38enmh67", "claude-directory-b6hh6dnw"]
]


def fetch(path, method="GET"):
    request = urllib.request.Request(
        args.origin + path,
        method=method,
        headers={"Cache-Control": "no-cache", "Accept-Encoding": "identity"},
    )
    try:
        with client.open(request, timeout=20) as response:
            return response.status, response.read() if method == "GET" else b""
    except urllib.error.HTTPError as error:
        return error.code, b""


def verify():
    status, body = fetch("/publication.json")
    if status != 200:
        raise ValueError(f"Publication receipt returned HTTP {status}")
    receipt = json.loads(body)
    if not isinstance(receipt, dict) or receipt.get("source_repository") != "pulkitxm/pulkit.page" or receipt.get("source_revision") != args.revision:
        raise ValueError("The deployed receipt does not match the verified source revision")
    for path, key in [("/", "index_sha256"), ("/my-first-talk/", "article_sha256")]:
        status, body = fetch(path)
        if status != 200 or hashlib.sha256(body).hexdigest() != receipt.get(key):
            raise ValueError(f"Deployed content does not match the receipt: {path}, HTTP {status}")
        if path == "/my-first-talk/" and b"collection of interface experiments" not in body:
            raise ValueError("The deployed article does not contain the expected project description")
    for path in withdrawn:
        status, _ = fetch(path, "HEAD")
        if status not in {404, 410}:
            raise ValueError(f"Unpublished content remains reachable or unverified: {path}, HTTP {status}")


failure = ""
for attempt in range(args.attempts):
    try:
        verify()
        print(f"Verified deployed blog revision {args.revision}, matching content and unpublished URL responses")
        break
    except (ValueError, urllib.error.URLError, TimeoutError) as error:
        failure = str(error)
        if attempt + 1 < args.attempts:
            time.sleep(args.interval)
else:
    raise SystemExit(f"Manual blog publication is not verified: {failure}. Publish the checked artifact through the approved Pukbot publisher, then retry.")

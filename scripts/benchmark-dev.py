import argparse
import json
import os
import platform
import re
import shutil
import signal
import socket
import statistics
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path


def milliseconds(start):
    return round((time.perf_counter() - start) * 1000, 2)


def request(url):
    start = time.perf_counter()
    with urllib.request.urlopen(url, timeout=60) as response:
        body = response.read().decode()
    return milliseconds(start), body


def launch(root, port):
    start = time.perf_counter()
    process = subprocess.Popen(
        ["bun", "run", "dev"], cwd=root,
        env={**os.environ, "PORT": str(port)},
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, start_new_session=True,
    )
    ready = threading.Event()
    output = []

    def consume():
        for line in process.stdout:
            output.append(line)
            if "Development server:" in line:
                ready.set()

    threading.Thread(target=consume, daemon=True).start()
    if not ready.wait(90):
        stop(process)
        raise RuntimeError("Server did not start: " + "".join(output))
    return process, milliseconds(start)


def stop(process):
    os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()


def edit(root, url, path, replacement, marker):
    start = time.perf_counter()
    path.write_text(replacement)
    deadline = time.perf_counter() + 60
    while time.perf_counter() < deadline:
        try:
            _, body = request(url)
            if marker in body:
                return milliseconds(start)
        except (urllib.error.URLError, ConnectionError):
            pass
        time.sleep(0.01)
    raise RuntimeError(f"Edit was not served: {path.relative_to(root)}")


def benchmark(source, repetitions):
    rows = []
    with tempfile.TemporaryDirectory(prefix="page-benchmark-") as temporary:
        root = Path(temporary) / "site"
        shutil.copytree(source, root, ignore=shutil.ignore_patterns(
            ".git", "node_modules", ".cache", "dist", "extras", ".DS_Store"
        ))
        dependencies = root / "node_modules"
        dependencies.mkdir()
        for package in (source / "node_modules").iterdir():
            if package.name not in {".vite", ".vite-temp"}:
                (dependencies / package.name).symlink_to(package.resolve())
        articles = list((root / "content/blogs").rglob("*.md"))
        article = max(articles, key=lambda path: path.read_text().count("```"))
        route = "/" + str(article.relative_to(root / "content").with_suffix("")) + "/"
        for iteration in range(repetitions):
            shutil.rmtree(root / ".cache", ignore_errors=True)
            shutil.rmtree(root / "dist", ignore_errors=True)
            shutil.rmtree(dependencies / ".vite", ignore_errors=True)
            shutil.rmtree(dependencies / ".vite-temp", ignore_errors=True)
            with socket.socket() as sock:
                sock.bind(("127.0.0.1", 0))
                port = sock.getsockname()[1]
            url = f"http://127.0.0.1:{port}"
            process, startup = launch(root, port)
            row = {"cold_ready_ms": startup}
            originals = {}
            try:
                row["first_home_ms"], _ = request(url + "/")
                row["first_article_ms"], _ = request(url + route)
                row["repeat_article_ms"], _ = request(url + route)
                stop(process)
                process, row["warm_ready_ms"] = launch(root, port)
                row["warm_home_ms"], _ = request(url + "/")
                originals[article] = article.read_text()
                marker = f"benchmark body {iteration}"
                row["body_edit_ms"] = edit(root, url + route, article,
                    originals[article] + f"\n{marker}\n", marker)
                marker = f"Benchmark title {iteration}"
                changed = re.sub(r"(?m)^title:.*$", f"title: {marker}", article.read_text())
                row["metadata_edit_ms"] = edit(root, url + "/blogs/", article, changed, marker)
                layout = root / "layouts/partials/footer.html"
                originals[layout] = layout.read_text()
                marker = f"benchmark layout {iteration}"
                row["layout_edit_ms"] = edit(root, url + "/", layout,
                    originals[layout] + f"\n<p>{marker}</p>\n", marker)
            finally:
                stop(process)
                for path, text in originals.items():
                    path.write_text(text)
            start = time.perf_counter()
            result = subprocess.run(["bun", "run", "build"], cwd=root,
                capture_output=True, text=True, timeout=120)
            if result.returncode:
                raise RuntimeError(result.stdout + result.stderr)
            row["production_build_ms"] = milliseconds(start)
            rows.append(row)
            print(json.dumps({"iteration": iteration + 1, **row}), flush=True)
        return {
            "article": route,
            "article_fences": article.read_text().count("```") // 2,
            "runs": rows,
            "median_ms": {key: round(statistics.median(row[key] for row in rows), 2)
                for key in rows[0]},
            "range_ms": {key: [min(row[key] for row in rows), max(row[key] for row in rows)]
                for key in rows[0]},
        }


parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("--runs", type=int, default=3)
parser.add_argument("--output", type=Path, required=True)
arguments = parser.parse_args()
if arguments.runs < 1:
    parser.error("--runs must be positive")
result = {
    "platform": platform.platform(),
    "bun": subprocess.check_output(["bun", "--version"], text=True).strip(),
    **benchmark(arguments.source.resolve(), arguments.runs),
}
arguments.output.write_text(json.dumps(result, indent=2) + "\n")

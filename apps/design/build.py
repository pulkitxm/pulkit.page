from pathlib import Path
import shutil
import re

root = Path(__file__).resolve().parent
source = root / "source"
output = root / "dist"
output.mkdir(exist_ok=True)
layout = (source / "layout.html").read_text()
styles = (source / "styles.html").read_text()
libraries = (source / "libraries.html").read_text()
motion = (source / "motion.html").read_text()
pages = {
    "index": ("Pulkit / Design that moves", "home"),
    "work": ("Selected work / Pulkit", "work"),
    "about": ("About / Pulkit", "about"),
    "contact": ("Let's talk / Pulkit", "contact"),
    "kaksha": ("Kaksha / Pulkit", "case"),
    "edith": ("Edith / Pulkit", "case"),
    "pulkit-page": ("A personal corner of the web / Pulkit", "case"),
}
for slug, (title, kind) in pages.items():
    content = (source / "pages" / f"{slug}.html").read_text()
    for project in ("kaksha", "edith", "pulkit-page"):
        artwork = (source / f"{project}-art.html").read_text().strip()
        content = re.sub(r"{{\s*ART_" + project.upper().replace("-", "_") + r"\s*}}", lambda match: artwork, content)
    html = layout
    for key, value in {"TITLE": title, "KIND": kind, "SLUG": slug, "STYLES": styles, "LIBRARIES": libraries, "MOTION": motion, "CONTENT": content}.items():
        html = re.sub(r"{{\s*" + key + r"\s*}}", lambda match: value, html)
    if re.search(r"{{\s*[A-Z_]+\s*}}", html):
        raise ValueError(f"Unresolved template in {slug}")
    (output / f"{slug}.html").write_text(html)
shutil.copytree(source / "assets", output / "assets", dirs_exist_ok=True)
shutil.copy2(root / "THIRD-PARTY-LICENSES.txt", output / "THIRD-PARTY-LICENSES.txt")
print(f"Built {len(pages)} static HTML pages in {output}")

import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

root = Path(sys.argv[1])
data = json.loads((root / "summary.json").read_text())
artifacts = data["artifacts"]
ids = [row["id"] for row in artifacts]
labels = ["Utilities", "Pruned utilities", "Short aliases", "Current composition", "Direct inline", "Direct external"]
colors = ["#8a8d96", "#49719c", "#548478", "#b47c40", "#287b61", "#7360a0"]
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.spines.top": False, "axes.spines.right": False, "axes.titleweight": "bold"})

def save(fig, name):
    fig.savefig(root / name, dpi=155, bbox_inches="tight", facecolor="white")
    plt.close(fig)

def bars(axis, stats, title, unit):
    for i, value in enumerate(stats):
        if value is None:
            continue
        axis.barh(i, value["median"], color=colors[i], height=0.65)
        axis.errorbar(value["median"], i, xerr=[[value["median"] - value["p25"]], [value["p75"] - value["median"]]], fmt="none", ecolor="#222", capsize=3)
    axis.set_yticks(range(len(labels)), labels)
    axis.invert_yaxis()
    axis.set_title(title, loc="left", pad=12)
    axis.set_xlabel(unit)
    axis.grid(axis="x", alpha=0.15)
    axis.set_axisbelow(True)

fig, axes = plt.subplots(1, 2, figsize=(12, 4.8), layout="constrained")
for i, row in enumerate(artifacts):
    axes[0].barh(i, row["coldHtmlCssGzip"] / 1024, color=colors[i])
    axes[1].barh(i, row["cssRules"], color=colors[i])
for axis in axes:
    axis.set_yticks(range(len(labels)), labels)
    axis.invert_yaxis()
    axis.grid(axis="x", alpha=0.15)
    axis.set_axisbelow(True)
axes[0].set_title("Cold HTML + CSS payload", loc="left")
axes[0].set_xlabel("KiB, gzip; external CSS included")
axes[1].set_title("Stylesheet rule count", loc="left")
axes[1].set_xlabel("Style rules, including nested rules")
save(fig, "payload.png")

fig, axes = plt.subplots(1, 2, figsize=(12, 4.8), layout="constrained")
bars(axes[0], [row["pipeline"] for row in data["builds"]], "Home CSS + script pipeline", "ms, median and interquartile range")
bars(axes[1], [row["process"] for row in data["builds"]], "Fresh process including analysis", "ms, median and interquartile range")
save(fig, "build.png")

for metric, name, title in [("lcpMs", "lcp.png", "Cold-visit largest contentful paint"), ("styleFlushMs", "style.png", "Style-change stress: mean cost per forced flush"), ("themePaintMs", "interaction.png", "Theme-update presentation proxy")]:
    environments = data["metadata"]["environment"]
    fig, axes = plt.subplots(2, 3, figsize=(16, 10), layout="constrained")
    for axis, environment in zip(axes.flat, environments):
        key = environment["engine"] + ":" + environment["profile"]["id"]
        cache = "cold" if metric == "lcpMs" else "warm"
        stats = [next(row for row in data["groups"] if row["profile"] == key and row["cache"] == cache and row["variant"] == variant)["metrics"][metric] for variant in ids]
        bars(axis, stats, key, "ms, median and interquartile range")
    for axis in list(axes.flat)[len(environments):]:
        axis.set_visible(False)
    fig.suptitle(title, fontsize=16, weight="bold")
    save(fig, name)

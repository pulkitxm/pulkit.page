import argparse
from pathlib import Path
from io import BytesIO

from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

font_directory = Path(__file__).resolve().parent.parent / "assets" / "fonts"
core_codepoints = set(range(0x20, 0x7F)) | set(range(0x2000, 0x2070)) | {
    0xA0, 0xA9, 0xB7, 0xD7, 0xE0, 0xE9, 0xF7, 0x2212
}
parser = argparse.ArgumentParser()
parser.add_argument("--check", action="store_true")
arguments = parser.parse_args()

for weight in ["regular", "bold"]:
    original_path = font_directory / f"comic-relief-{weight}-latin.woff2"
    output_path = font_directory / f"comic-relief-{weight}-core.woff2"
    original = TTFont(original_path, recalcTimestamp=False)
    font = TTFont(original_path, recalcTimestamp=False)
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=core_codepoints)
    subsetter.subset(font)
    font.flavor = "woff2"
    output = BytesIO()
    font.save(output)
    if arguments.check:
        assert output_path.read_bytes() == output.getvalue(), "Font subset is not reproducible"
    else:
        output_path.write_bytes(output.getvalue())
    generated = TTFont(output_path)
    original_map = original.getBestCmap()
    generated_map = generated.getBestCmap()
    assert set(generated_map) == set(original_map) & core_codepoints
    original_glyphs = original.getGlyphSet()
    generated_glyphs = generated.getGlyphSet()
    for codepoint, name in generated_map.items():
        original_name = original_map[codepoint]
        assert generated["hmtx"][name] == original["hmtx"][original_name]
        original_pen = DecomposingRecordingPen(original_glyphs)
        generated_pen = DecomposingRecordingPen(generated_glyphs)
        original_glyphs[original_name].draw(original_pen)
        generated_glyphs[name].draw(generated_pen)
        assert original_pen.value == generated_pen.value
    assert generated["head"].unitsPerEm == original["head"].unitsPerEm
    for field in ["ascent", "descent", "lineGap"]:
        assert getattr(generated["hhea"], field) == getattr(original["hhea"], field)
    assert sorted((n.nameID, n.platformID, n.platEncID, n.langID, n.toUnicode()) for n in generated["name"].names) == sorted((n.nameID, n.platformID, n.platEncID, n.langID, n.toUnicode()) for n in original["name"].names)
    print(f"{weight}: {len(output.getvalue())} bytes, {len(generated_map)} glyphs verified")

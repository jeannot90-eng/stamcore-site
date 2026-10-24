"""OG-afbeeldingen (1200x630) in de huisstijl, met Pillow.

  python seo/scripts/og.py                  -> img/og-default.jpg + een afbeelding per stad in seo/cities/
  python seo/scripts/og.py tilburg eindhoven -> alleen deze steden

Per stad: img/og/{niche}-{slug}.jpg met "Glazenwasser in {Stad} — Maps-scan".
build.mjs roept dit script zelf aan als de afbeelding van een stad ontbreekt.
Lettertype: Segoe UI (Windows), net als de eerdere og-default.jpg.
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
W, H = 1200, 630
FONTS = Path("C:/Windows/Fonts")
BG = (2, 6, 23)            # #020617
WHITE = (255, 255, 255)
ELECTRIC = (56, 189, 248)  # electric-400
EMERALD = (52, 211, 153)   # emerald-400
MUTED = (203, 213, 225)    # slate-300
DIM = (148, 163, 184)      # slate-400


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def base():
    img = Image.new("RGB", (W, H), BG)
    glow = Image.new("RGB", (W, H), BG)
    g = ImageDraw.Draw(glow)
    g.ellipse((700, -350, 1500, 350), fill=(14, 60, 90))
    g.ellipse((850, 300, 1450, 800), fill=(8, 50, 45))
    img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(160)), 0.9)
    d = ImageDraw.Draw(img)
    # Logo: afgerond vierkant met verloop elektrisch -> smaragd
    logo = Image.new("RGB", (64, 64))
    ld = ImageDraw.Draw(logo)
    for i in range(64):
        t = i / 63
        ld.line([(i, 0), (i, 63)], fill=tuple(int(ELECTRIC[k] + (EMERALD[k] - ELECTRIC[k]) * t) for k in range(3)))
    mask = Image.new("L", (64, 64), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 63, 63), radius=14, fill=255)
    img.paste(logo, (80, 70), mask)
    d.text((112, 102), "SC", font=font("segoeuib.ttf", 26), fill=BG, anchor="mm")
    d.text((166, 82), "Stam Core", font=font("segoeuib.ttf", 26), fill=WHITE)
    d.text((168, 118), "WEBSITES & LOKALE SEO", font=font("segoeui.ttf", 14), fill=DIM)
    d.line([(80, 560), (1120, 560)], fill=(30, 41, 59), width=2)
    d.text((80, 580), "stam-core.nl", font=font("segoeuib.ttf", 20), fill=WHITE)
    return img, d


def fit(d, text, name, start, max_w):
    size = start
    while size > 40 and d.textlength(text, font=font(name, size)) > max_w:
        size -= 2
    return font(name, size)


def render(line1, line2, sub, out):
    img, d = base()
    f1 = fit(d, line1, "segoeuib.ttf", 76, 1040)
    f2 = fit(d, line2, "segoeuib.ttf", 76, 1040)
    top = 225
    d.text((80, top), line1, font=f1, fill=WHITE)
    d.text((80, top + f1.size + 12), line2, font=f2, fill=ELECTRIC)
    y = top + f1.size + 12 + f2.size + 48
    for i, s in enumerate(sub):
        d.text((82, y + i * 34), s, font=font("segoeui.ttf", 24), fill=MUTED)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"  og: {out.relative_to(ROOT).as_posix()}")


def main(slugs):
    if not slugs:
        render("Websites en lokale SEO", "voor servicebedrijven.",
               ["Gevonden worden in de plaatsen waar je werkt:", "website, pagina's per plaats, Bedrijfsprofiel en reviews."],
               ROOT / "img" / "og-default.jpg")
    for f in sorted((ROOT / "seo" / "cities").glob("*.json")):
        c = json.loads(f.read_text(encoding="utf-8"))
        if slugs and c["slug"] not in slugs:
            continue
        niche = json.loads((ROOT / "seo" / "niches" / f"{c['niche']}.json").read_text(encoding="utf-8"))
        word = niche["enkelvoud"].capitalize()
        render(f"{word} in {c['stad']}", "— Maps-scan",
               [f"Zo staan de {niche['meervoud']} bovenaan in Google Maps ervoor,", "en waar de ruimte zit voor jouw bedrijf."],
               ROOT / "img" / "og" / f"{c['niche']}-{c['slug']}.jpg")
    # Kennisartikelen: regels uit de frontmatter "og: [regel1, regel2, sub1, sub2]" -> img/og/kennis-{slug}.jpg
    for f in sorted((ROOT / "seo" / "articles").glob("*.md")):
        slug = f.stem
        if f.name.startswith("_") or (slugs and slug not in slugs):
            continue
        m = re.search(r"^og:\s*(\[.*\])\s*$", f.read_text(encoding="utf-8"), re.M)
        if not m:
            continue
        r1, r2, *sub = json.loads(m.group(1))
        render(r1, r2, sub, ROOT / "img" / "og" / f"kennis-{slug}.jpg")


if __name__ == "__main__":
    main(sys.argv[1:])

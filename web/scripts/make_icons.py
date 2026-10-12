"""Uygulama ikonlarını üretir (PWA / iOS ana ekran). Kullanım: python3 scripts/make_icons.py"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)


def pentagon(cx, cy, r, rot=-math.pi / 2):
    return [(cx + math.cos(rot + i * 2 * math.pi / 5) * r, cy + math.sin(rot + i * 2 * math.pi / 5) * r) for i in range(5)]


def make(size, safe=1.0, rounded=True):
    S = size * 4  # süper örnekleme
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bg = Image.new("RGBA", (S, S))
    d = ImageDraw.Draw(bg)
    for y in range(S):  # dikey gradyan
        t = y / S
        c = (int(10 + 8 * t), int(36 - 14 * t), int(26 - 10 * t), 255)
        d.line([(0, y), (S, y)], fill=c)
    # ışık parlaması
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([S * 0.1, -S * 0.35, S * 0.9, S * 0.45], fill=(198, 255, 61, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.08))
    bg = Image.alpha_composite(bg, glow)
    # şerit çim
    d = ImageDraw.Draw(bg)
    for i in range(6):
        if i % 2:
            d.rectangle([0, S * 0.62 + i * S * 0.07, S, S * 0.62 + (i + 1) * S * 0.07], fill=(255, 255, 255, 10))

    mask = Image.new("L", (S, S), 0)
    if rounded:
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S, S], radius=S * 0.22, fill=255)
    else:
        ImageDraw.Draw(mask).rectangle([0, 0, S, S], fill=255)
    img.paste(bg, (0, 0), mask)

    d = ImageDraw.Draw(img)
    cx, cy = S / 2, S * 0.5
    r = S * 0.3 * safe
    # gölge
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([cx - r * 0.9, cy + r * 0.95, cx + r * 0.9, cy + r * 1.2], fill=(0, 0, 0, 140))
    sh = sh.filter(ImageFilter.GaussianBlur(S * 0.02))
    img = Image.alpha_composite(img, sh)
    d = ImageDraw.Draw(img)
    # top
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(244, 248, 245, 255), outline=(198, 255, 61, 255), width=int(S * 0.018))
    dark = (17, 26, 21, 255)
    d.polygon(pentagon(cx, cy, r * 0.36), fill=dark)
    for i in range(5):
        a = -math.pi / 2 + i * 2 * math.pi / 5
        px, py = cx + math.cos(a) * r * 0.86, cy + math.sin(a) * r * 0.86
        d.polygon(pentagon(px, py, r * 0.26, a + math.pi / 2), fill=dark)
        mx, my = cx + math.cos(a) * r * 0.36, cy + math.sin(a) * r * 0.36
        d.line([(mx, my), (cx + math.cos(a) * r * 0.62, cy + math.sin(a) * r * 0.62)], fill=dark, width=int(S * 0.012))
    # kenar dışını temizle (beşgenler taşmasın)
    ball_mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(ball_mask).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    outside = Image.new("L", (S, S), 255)
    outside.paste(0, (0, 0), ball_mask)
    bg_only = Image.alpha_composite(Image.new("RGBA", (S, S)), img.copy())
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    base.paste(bg, (0, 0), mask)
    base = Image.alpha_composite(base, sh)
    img = Image.composite(base, img, outside)
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(198, 255, 61, 255), width=int(S * 0.02))
    return img.resize((size, size), Image.LANCZOS)


make(192).save(OUT / "icon-192.png")
make(512).save(OUT / "icon-512.png")
make(512, safe=0.78, rounded=False).save(OUT / "maskable-512.png")
make(180, rounded=False).save(OUT / "apple-touch-icon.png")
print("ikonlar:", sorted(p.name for p in OUT.iterdir()))

"""Sprite atlası üretici — "Football Championship Megapack" sayfalarından oyuna giren sprite'ları
tek bir dokuya (texture atlas) paketler.

Girdi : paketin ZIP dosyası ya da PNG sayfalarının bulunduğu klasör
Çıktı : src/assets/sprites/atlas.webp   (oyunun kullandığı, kayıpsız WebP)
        src/assets/sprites/atlas.png    (WebP desteklemeyen eski tarayıcılar için)
        src/assets/sprites/atlas.json   (çerçeve koordinatları: ad → x, y, w, h)

Kullanım (web/ klasöründe):
  npm run atlas -- assets-src/Football_Championship_Megapack.zip
  python3 scripts/atlas/build_atlas.py assets-src/

Adımlar: sayfaları dilimle (slice.py) → manifest.json'daki sprite'ları seç → alfa sınırına kırp →
gerekirse küçült (LANCZOS) → raf (shelf) yöntemiyle paketle (4 px şeffaf boşluk) → kaydet.
"""
import io
import json
import os
import sys
import tempfile
import zipfile

from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(__file__))
from slice import find_sprites, sheet_id  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(WEB, "src", "assets", "sprites")
PAD = 4
ATLAS_W = 1024


def load_sheets(src):
    """ZIP ya da klasörden {sayfa_no: dosya_yolu} döner (ZIP geçici klasöre açılır)."""
    if src.lower().endswith(".zip"):
        tmp = tempfile.mkdtemp(prefix="atlas-")
        with zipfile.ZipFile(src) as z:
            for info in z.infolist():
                name = os.path.basename(info.filename)
                if not name.lower().endswith(".png") or ".." in name:
                    continue
                with open(os.path.join(tmp, name), "wb") as fh:
                    fh.write(z.read(info))
        src = tmp
    sheets = {}
    for f in os.listdir(src):
        sid = sheet_id(f)
        if sid and f.lower().endswith(".png"):
            sheets[sid] = os.path.join(src, f)
    return sheets


def fit(img, max_side):
    w, h = img.size
    s = min(1.0, max_side / max(w, h))
    if s >= 1:
        return img
    return img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)


def mirror_tile(t):
    """Kenarları eşleşmeyen dokuyu aynalayarak dikişsiz (seamless) 2x2 döşemeye çevirir."""
    w, h = t.size
    m = Image.new("RGBA", (w * 2, h * 2))
    m.paste(t, (0, 0))
    m.paste(ImageOps.mirror(t), (w, 0))
    m.paste(ImageOps.flip(t), (0, h))
    m.paste(ImageOps.flip(ImageOps.mirror(t)), (w, h))
    return m


def pack(images, width=ATLAS_W):
    """Raf paketleme: yüksekliğe göre sıralı, soldan sağa satırlar."""
    order = sorted(images.items(), key=lambda kv: (-kv[1].height, -kv[1].width, kv[0]))
    x = y = PAD
    shelf = 0
    frames = {}
    for name, im in order:
        w, h = im.size
        if x + w + PAD > width:
            x = PAD
            y += shelf + PAD
            shelf = 0
        frames[name] = {"x": x, "y": y, "w": w, "h": h}
        x += w + PAD
        shelf = max(shelf, h)
    height = y + shelf + PAD
    height = (height + 3) // 4 * 4
    atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for name, im in images.items():
        f = frames[name]
        atlas.paste(im, (f["x"], f["y"]))
    return atlas, frames


def main(src):
    with open(os.path.join(HERE, "manifest.json"), encoding="utf-8") as fh:
        manifest = json.load(fh)
    sheets = load_sheets(src)
    cache = {}

    def sprite(sid, row, col):
        if sid not in cache:
            cache[sid] = find_sprites(sheets[sid])
        im, boxes = cache[sid]
        for b in boxes:
            if b["row"] == row and b["col"] == col:
                return im.crop((b["x"], b["y"], b["x"] + b["w"], b["y"] + b["h"]))
        raise KeyError(f"sayfa {sid} satır {row} sütun {col} bulunamadı")

    images = {}
    groups = {}
    for gname, group in manifest["groups"].items():
        for name, (sid, row, col) in group["sprites"].items():
            img = sprite(sid, row, col)
            img = img.crop(img.getbbox())
            images[name] = fit(img, group["max"])
            groups[name] = gname
    for name, t in manifest.get("tiles", {}).items():
        sid, row, col = t["src"]
        img = sprite(sid, row, col)
        i = t.get("inset", 0)
        img = img.crop((i, i, img.width - i, img.height - i))
        if t.get("mirror"):
            img = mirror_tile(img)
        img = img.resize((t["size"], t["size"]), Image.LANCZOS)
        images[name] = img
        groups[name] = "tiles"

    atlas, frames = pack(images)
    os.makedirs(OUT_DIR, exist_ok=True)
    webp = os.path.join(OUT_DIR, "atlas.webp")
    png = os.path.join(OUT_DIR, "atlas.png")
    # 256 renge indirgeme: piksel sanatında gözle fark edilmez, boyutu ~5 kat küçültür
    # (kayıpsız WebP 1 MB → paletli kayıpsız WebP ~180 KB)
    paletted = atlas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    paletted.convert("RGBA").save(webp, "WEBP", lossless=True, method=6)
    paletted.save(png, optimize=True)  # WebP desteklemeyen tarayıcılar için yedek
    for name in frames:
        frames[name]["group"] = groups[name]
    meta = {
        "image": {"w": atlas.width, "h": atlas.height},
        "frames": dict(sorted(frames.items())),
        "source": "Football Championship Megapack - Top-Down Pixel Art Sports Collection",
    }
    with open(os.path.join(OUT_DIR, "atlas.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1)
    print(f"{len(frames)} sprite → {atlas.width}x{atlas.height}")
    print(f"atlas.webp {os.path.getsize(webp) // 1024} KB · atlas.png {os.path.getsize(png) // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])

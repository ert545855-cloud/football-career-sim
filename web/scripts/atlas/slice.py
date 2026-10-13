"""Sprite dilimleyici: önizleme sayfalarındaki (sprite sheet) sprite'ları alfa kanalından bulur.

Paket ızgara (grid) değil, serbest yerleşimli 20 sayfa olduğu için sprite'lar
bağlantılı bileşen analiziyle (connected components) çıkarılır:
  1) Üstteki başlık bandı atlanır
  2) Alfa > eşik maskesi küçük bir genişletmeyle (dilation) birleştirilir
     (bayrak direği + kumaş gibi kopuk parçalar tek sprite olsun)
  3) Kutular satır satır okunma sırasına dizilir → (satır, sütun) adresi

Kullanım:
  python scripts/atlas/slice.py <sayfa_klasörü> <çıktı_klasörü>   # numaralı hata ayıklama görselleri
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ALPHA_MIN = 24          # bu değerin altındaki pikseller boş sayılır
HEADER_FRAC = 0.115     # sayfanın üst kısmındaki başlık bandı
MIN_AREA = 260          # gürültü / kırıntı eşiği (piksel)
DILATE = 3              # parça birleştirme yarıçapı


def sheet_id(filename):
    """'14. Trophy And Awards.png' → 14"""
    m = re.match(r"(\d+)\.", os.path.basename(filename))
    return int(m.group(1)) if m else None


def find_sprites(path, dilate=DILATE, header=HEADER_FRAC):
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im)[:, :, 3]
    mask = a > ALPHA_MIN
    top = int(im.height * header)
    mask[:top, :] = False
    grown = ndimage.binary_dilation(mask, iterations=dilate) if dilate else mask
    labels, n = ndimage.label(grown)
    boxes = []
    for sl in ndimage.find_objects(labels):
        if sl is None:
            continue
        ys, xs = sl
        sub = mask[ys, xs]
        area = int(sub.sum())
        if area < MIN_AREA:
            continue
        # gerçek (genişletilmemiş) piksellere göre sıkı kutu
        rows = np.where(sub.any(axis=1))[0]
        cols = np.where(sub.any(axis=0))[0]
        y0, y1 = ys.start + rows[0], ys.start + rows[-1] + 1
        x0, x1 = xs.start + cols[0], xs.start + cols[-1] + 1
        # başlık bandından kalan ince şerit sprite değildir
        if (x1 - x0) > im.width * 0.4 and (y1 - y0) < 70:
            continue
        boxes.append({"x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0), "area": area})
    return im, order_rows(boxes)


def order_rows(boxes):
    """Kutuları satırlara gruplar (dikey merkez yakınlığı), her satırı soldan sağa dizer."""
    boxes = sorted(boxes, key=lambda b: b["y"] + b["h"] / 2)
    rows = []
    for b in boxes:
        cy = b["y"] + b["h"] / 2
        for r in rows:
            if abs(r["cy"] - cy) < max(18, 0.45 * min(r["h"], b["h"])):
                r["items"].append(b)
                r["cy"] = sum(i["y"] + i["h"] / 2 for i in r["items"]) / len(r["items"])
                r["h"] = max(r["h"], b["h"])
                break
        else:
            rows.append({"cy": cy, "h": b["h"], "items": [b]})
    rows.sort(key=lambda r: r["cy"])
    out = []
    for ri, r in enumerate(rows):
        for ci, b in enumerate(sorted(r["items"], key=lambda i: i["x"])):
            out.append({**b, "row": ri, "col": ci})
    return out


def debug_overlay(im, boxes, out_path):
    bg = Image.new("RGBA", im.size, (40, 44, 52, 255))
    bg.alpha_composite(im)
    d = ImageDraw.Draw(bg)
    for b in boxes:
        d.rectangle([b["x"], b["y"], b["x"] + b["w"], b["y"] + b["h"]], outline=(255, 0, 180, 255), width=2)
        label = f"{b['row']},{b['col']}"
        d.rectangle([b["x"], b["y"] - 12, b["x"] + 7 * len(label) + 4, b["y"]], fill=(255, 0, 180, 255))
        d.text((b["x"] + 2, b["y"] - 12), label, fill=(255, 255, 255, 255))
    bg.convert("RGB").save(out_path)


if __name__ == "__main__":
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    index = {}
    for f in sorted(os.listdir(src), key=lambda s: sheet_id(s) or 0):
        if not f.lower().endswith(".png"):
            continue
        im, boxes = find_sprites(os.path.join(src, f))
        sid = sheet_id(f)
        index[sid] = boxes
        debug_overlay(im, boxes, os.path.join(out, f"debug-{sid:02d}.png"))
        print(f"{sid:2d} {f:45s} {len(boxes)} sprite")
    with open(os.path.join(out, "boxes.json"), "w") as fh:
        json.dump(index, fh)

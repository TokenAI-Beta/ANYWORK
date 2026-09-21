# -*- coding: utf-8 -*-
# 生成 DSH 团队工作台桌面图标（256 多尺寸 .ico + .png），给快捷方式/安装应用用
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.environ["LOCALAPPDATA"], "desk-anywork", "desk-app")
os.makedirs(OUT, exist_ok=True)


def make(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=(28, 30, 33, 255))
    m = int(size * 0.11)
    d.rounded_rectangle([m, m, size - 1 - m, size - 1 - m], radius=int(size * 0.16), outline=(79, 124, 247, 255), width=max(2, size // 36))
    f = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", int(size * 0.33))
    bb = d.textbbox((0, 0), "DSH", font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((size - tw) / 2 - bb[0], (size - th) / 2 - bb[1]), "DSH", font=f, fill=(255, 255, 255, 255))
    return img


sizes = [16, 32, 48, 64, 128, 256]
imgs = [make(s) for s in sizes]
ico = os.path.join(OUT, "icon.ico")
png = os.path.join(OUT, "icon.png")
imgs[-1].save(ico, format="ICO", sizes=[(s, s) for s in sizes], append_images=imgs[:-1])
imgs[-1].save(png)
print("icon ok:", ico, os.path.getsize(ico), "bytes")
print("png:", png, os.path.getsize(png), "bytes")

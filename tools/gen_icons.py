# -*- coding: utf-8 -*-
"""
生成各平台图标 / 启动图（纯 Pillow 绘制，不依赖外部素材）。

    python tools/gen_icons.py

产物：
    icons/icon.png                 1024 基础图
    icons/icon-192.png / icon-512.png / apple-touch-icon.png
    icons/icon-maskable-512.png    Android 自适应（留安全边距）
    icons/favicon.ico              Web 站点图标
    icons/splash.png               启动画面（居中 logo）
    build/icon.ico                 Electron / Windows 桌面端图标
    android/app/src/main/res/...   若 Capacitor Android 工程存在，写入 mipmap 与 splash
"""
import os
import struct
import zlib

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG1 = (63, 111, 150)     # --accent
BG2 = (46, 86, 117)      # --accent-deep
WHITE = (255, 255, 255)
ACCENT = (63, 111, 150)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size):
    """竖向渐变背景（带轻微径向提亮）"""
    w = h = size
    img = Image.new("RGB", (w, h), BG1)
    d = ImageDraw.Draw(img)
    for y in range(h):
        d.line([(0, y), (w, y)], fill=lerp(BG1, BG2, y / max(1, h - 1)))
    glow = Image.new("L", (w, h), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([int(w * 0.1), int(-h * 0.35), int(w * 0.9), int(h * 0.55)], fill=90)
    glow = glow.filter(ImageFilter.GaussianBlur(int(size * 0.06)))
    white = Image.new("RGB", (w, h), (255, 255, 255))
    return Image.composite(white, img, glow)


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def _font(size):
    """取一个支持西里尔字母的系统字体"""
    for fp in ("C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf",
               "C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/segoeui.ttf"):
        if os.path.exists(fp):
            try:
                from PIL import ImageFont
                return ImageFont.truetype(fp, size)
            except Exception:
                pass
    from PIL import ImageFont
    return ImageFont.load_default()


def draw_book(d, cx, cy, s, letters=True):
    """原创设计：翻开的书 + 左页「Р」右页「Я」（русский язык 首字母）+ 金色书签"""
    w, h = s, s * 0.78
    top = cy - h * 0.44
    bottom = cy + h * 0.44
    spine_x = cx
    half = w / 2
    # 左页
    d.polygon([
        (cx - half, top + h * 0.07),
        (cx - half * 0.14, top + h * 0.02),
        (spine_x, cy - h * 0.06),
        (spine_x, bottom - h * 0.02),
        (cx - half * 0.14, bottom),
        (cx - half, bottom - h * 0.06),
    ], fill=WHITE)
    # 右页
    d.polygon([
        (cx + half, top + h * 0.07),
        (cx + half * 0.14, top + h * 0.02),
        (spine_x, cy - h * 0.06),
        (spine_x, bottom - h * 0.02),
        (cx + half * 0.14, bottom),
        (cx + half, bottom - h * 0.06),
    ], fill=(247, 250, 252))
    # 书脊
    lw = max(2, int(s * 0.038))
    d.line([(spine_x, top + h * 0.05), (spine_x, bottom - h * 0.03)],
           fill=lerp(ACCENT, WHITE, 0.55), width=lw)
    # 金色书签（右侧斜挂）
    gold = (232, 163, 61)
    bx0, bx1 = cx + half * 0.44, cx + half * 0.66
    d.polygon([(bx0, top + h * 0.10), (bx1, top + h * 0.10),
               (bx1, bottom + h * 0.10), (bx0 + (bx1 - bx0) / 2, bottom - h * 0.04),
               (bx0, bottom + h * 0.10)], fill=gold)
    if letters:
        f = _font(int(h * 0.46))
        ink = BG2
        for ch, sign in (("Р", -1), ("Я", 1)):
            try:
                bb = d.textbbox((0, 0), ch, font=f)
                tw, th = bb[2] - bb[0], bb[3] - bb[1]
                d.text((cx + sign * half * 0.55 - tw / 2, cy - th * 0.62), ch, font=f, fill=ink)
            except Exception:
                pass


def make_icon(size, maskable=False, radius_ratio=0.22):
    base = gradient(size)
    d = ImageDraw.Draw(base)
    scale = 0.55 if maskable else 0.72
    draw_book(d, size / 2, size / 2, size * scale)
    # 底部三个小圆点：象征间隔复习
    r = max(2, size * 0.013)
    y = size * (0.88 if maskable else 0.83)
    for i, alpha in enumerate([170, 215, 255]):
        x = size / 2 + (i - 1) * size * 0.072
        d.ellipse([x - r, y - r, x + r, y + r], fill=lerp(BG1, WHITE, alpha / 255))
    if not maskable:
        m = rounded_mask(size, int(size * radius_ratio))
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(base, (0, 0), m)
        return out
    return base.convert("RGBA")


def make_splash(w=1280, h=1280, bg=(245, 246, 248)):
    img = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(img)
    logo = make_icon(int(min(w, h) * 0.42))
    img.paste(logo, ((w - logo.width) // 2, int(h * 0.26)), logo)
    # 文字区留白（启动屏由 Android/iOS 自适应）
    return img


def ensure(p):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def write_png(img, path):
    ensure(path)
    img.save(path, "PNG", optimize=True)
    print("  ✓", os.path.relpath(path, ROOT))


def write_ico(img, path, sizes=(16, 24, 32, 48, 64, 128, 256)):
    ensure(path)
    img.save(path, "ICO", sizes=[(s, s) for s in sizes])
    print("  ✓", os.path.relpath(path, ROOT))


def write_android():
    res = os.path.join(ROOT, "android", "app", "src", "main", "res")
    if not os.path.isdir(res):
        print("  · 未检测到 android 工程，跳过 Android 图标（先执行 npx cap add android）")
        return
    print("  → 写入 Android 资源")
    mip = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for k, v in mip.items():
        d = os.path.join(res, "mipmap-" + k)
        os.makedirs(d, exist_ok=True)
        make_icon(v, radius_ratio=0.5).resize((v, v), Image.LANCZOS).save(os.path.join(d, "ic_launcher.png"))
        make_icon(v, radius_ratio=0.5).resize((v, v), Image.LANCZOS).save(
            os.path.join(d, "ic_launcher_round.png"))
        make_icon(int(v * 0.7), maskable=True).resize((v, v), Image.LANCZOS).save(
            os.path.join(d, "ic_launcher_foreground.png")) if False else None
    # 单色前景（自适应图标）
    fg_dir = os.path.join(res, "drawable")
    os.makedirs(fg_dir, exist_ok=True)
    fg = Image.new("RGBA", (432, 432), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fg)
    draw_book(fd, 216, 216, 432 * 0.62)
    fg.save(os.path.join(fg_dir, "ic_launcher_foreground.png"))
    # 删除 anydpi-v26 自适应 xml，改用经典 mipmap（保证旧棉）
    anydpi = os.path.join(res, "mipmap-anydpi-v26")
    if os.path.isdir(anydpi):
        for f in os.listdir(anydpi):
            if f.startswith("ic_launcher"):
                os.remove(os.path.join(anydpi, f))
    # 启动图：覆盖通用与横竖屏各密度
    def write_splash(directory, w, h):
        os.makedirs(directory, exist_ok=True)
        sp = Image.new("RGB", (max(480, w), max(800, h)), (245, 246, 248))
        logo = make_icon(int(min(sp.size) * 0.42))
        sp.paste(logo, ((sp.width - logo.width) // 2, int(sp.height * 0.28)), logo)
        sp.save(os.path.join(directory, "splash.png"))

    for k, v in {"mdpi": 480, "hdpi": 800, "xhdpi": 1280, "xxhdpi": 1600, "xxxhdpi": 1920}.items():
        write_splash(os.path.join(res, "drawable-" + k), v, int(v * 1.6))
        port = os.path.join(res, "drawable-port-" + k)
        if os.path.isdir(port) or True:
            write_splash(port, int(v * 0.75), v)
        land = os.path.join(res, "drawable-land-" + k)
        if os.path.isdir(land):
            write_splash(land, v, int(v * 0.75))
    write_splash(os.path.join(res, "drawable"), 800, 1280)
    print("  ✓ Android 图标与启动图已写入")


def main():
    print("生成图标…")
    base = make_icon(1024)
    write_png(base, os.path.join(ROOT, "icons", "icon.png"))
    write_png(base.resize((512, 512), Image.LANCZOS), os.path.join(ROOT, "icons", "icon-512.png"))
    write_png(base.resize((192, 192), Image.LANCZOS), os.path.join(ROOT, "icons", "icon-192.png"))
    write_png(base.resize((180, 180), Image.LANCZOS), os.path.join(ROOT, "icons", "apple-touch-icon.png"))
    write_png(make_icon(512, maskable=True), os.path.join(ROOT, "icons", "icon-maskable-512.png"))
    write_png(make_splash(), os.path.join(ROOT, "icons", "splash.png"))
    write_ico(base, os.path.join(ROOT, "icons", "favicon.ico"))
    write_ico(base, os.path.join(ROOT, "build", "icon.ico"))
    write_png(base.resize((256, 256), Image.LANCZOS), os.path.join(ROOT, "build", "icon.png"))
    write_android()


if __name__ == "__main__":
    main()

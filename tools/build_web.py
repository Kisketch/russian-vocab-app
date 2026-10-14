# -*- coding: utf-8 -*-
"""
构建 web 运行时目录 dist/（供 Electron 桌面端与 Capacitor 安卓端共用）。

    python tools/build_web.py

包含：index.html / styles.css / manifest.webmanifest / sw.js / js / assets / icons
排除：src、tools、node_modules、electron、build、android 等源码与工程文件
"""
import os
import re
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

COPY_TOP = ["index.html", "styles.css", "manifest.webmanifest", "sw.js"]
COPY_DIRS = ["js", "assets", "icons"]
SKIP_JS = {"smoke.js"}


def clean():
    """增量构建：只创建目录，不整体删除（避免触发批量删除保护）。
    文件级覆盖写入；如需彻底重建请手动删除 dist/ 后再运行。"""
    os.makedirs(DIST, exist_ok=True)


def copy_tree(src, dst):
    for root, _dirs, files in os.walk(src):
        rel = os.path.relpath(root, src)
        target = os.path.normpath(os.path.join(dst, rel))
        os.makedirs(target, exist_ok=True)
        for f in files:
            shutil.copy2(os.path.join(root, f), os.path.join(target, f))


def main():
    clean()
    for f in COPY_TOP:
        shutil.copy2(os.path.join(ROOT, f), os.path.join(DIST, f))
        print("  ✓", f)
    for d in COPY_DIRS:
        copy_tree(os.path.join(ROOT, d), os.path.join(DIST, d))
        print("  ✓", d + "/")

    # 内嵌语法数据：桌面端 file:// 下 Chromium 禁止 fetch 本地文件，
    # 构建期把 assets/grammar.json 转成 js/grammar_data.js 全局变量（grammar.js 优先读取）
    gpath = os.path.join(ROOT, "assets", "grammar.json")
    if os.path.exists(gpath):
        with open(gpath, encoding="utf-8") as fh:
            gdata = fh.read().strip()
        with open(os.path.join(DIST, "js", "grammar_data.js"), "w", encoding="utf-8", newline="\n") as fh:
            fh.write("/* 构建期自动生成：assets/grammar.json 的内嵌副本（桌面端 file:// 无法 fetch） */\n")
            fh.write("window.RV_GRAMMAR_DATA = " + gdata + ";\n")
        print("  ✓ js/grammar_data.js（内嵌语法数据 %.0f KB）" % (len(gdata.encode('utf-8')) / 1024))

    # 冒烟测试脚本不进入发布包
    smoke = os.path.join(DIST, "js", "smoke.js")
    if os.path.exists(smoke):
        os.remove(smoke)

    total = 0
    for root, _d, files in os.walk(DIST):
        for f in files:
            total += os.path.getsize(os.path.join(root, f))
    print("dist/ 构建完成，共 %.1f MB" % (total / 1024 / 1024))


if __name__ == "__main__":
    main()

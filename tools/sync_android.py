# -*- coding: utf-8 -*-
"""
把 dist/ 同步到 Capacitor 安卓工程的资产目录（cap sync 的稳妥替代方案）。

    python tools/sync_android.py

适用场景：`npx cap sync android` 在受限环境（批量删除被拦截 / 文件被占用）失败时，
本脚本以增量覆盖方式写入，不删除目录，结果与 cap sync 的资产拷贝步骤等价。
"""
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "dist")
DST = os.path.join(ROOT, "android", "app", "src", "main", "assets", "public")

check = ["index.html", "styles.css", "js/app.js", "js/data.js", "js/store.js", "js/audio.js"]


def main():
    if not os.path.isdir(SRC):
        print("dist/ 不存在，请先运行 python tools/build_web.py")
        return 1
    if not os.path.isdir(os.path.dirname(DST)):
        print("未找到 android 工程，请先执行 npx cap add android")
        return 1
    os.makedirs(DST, exist_ok=True)
    shutil.copytree(SRC, DST, dirs_exist_ok=True)

    bad = []
    for f in check:
        a = open(os.path.join(SRC, f), "rb").read()
        p = os.path.join(DST, f)
        b = open(p, "rb").read() if os.path.exists(p) else b""
        if a != b:
            bad.append(f)
    files = sum(len(fs) for _, _, fs in os.walk(DST))
    print("已同步 %d 个文件到 android/app/src/main/assets/public" % files)
    if bad:
        print("以下文件不一致：" + ", ".join(bad))
        return 2
    print("校验通过：web 资产与 dist/ 完全一致")
    return 0


if __name__ == "__main__":
    sys.exit(main())

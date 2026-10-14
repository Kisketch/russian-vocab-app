# -*- coding: utf-8 -*-
"""
把 src/units.tsv 与 src/vocab.tsv 编译成 js/data.js（挂到 window.RV_DATA）。

用法：
    python tools/build_data.py

列格式（竖线分隔）：
    units.tsv : id|no|ru_title|zh_title|desc
    vocab.tsv : unit_id|ru|pos|zh|ex_ru|ex_zh|scene|ru_stress(可选，带重音符的词形，如 университе́т)
"""
import json
import re
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
OUT = os.path.join(ROOT, "js", "data.js")


def read_tsv(path):
    rows = []
    encoding = "utf-8-sig"  # 兼容带 BOM 的源文件
    with open(path, encoding=encoding) as f:
        for raw in f:
            line = raw.rstrip("\n").rstrip("\r")
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            rows.append([c.strip() for c in line.split("|")])
    return rows


def main():
    units = []
    for row in read_tsv(os.path.join(SRC, "units.tsv")):
        uid, no, ru_title, zh_title, desc = row[:5]
        units.append({
            "id": uid,
            "no": int(no),
            "ru": ru_title,
            "zh": zh_title,
            "desc": desc,
        })

    words = []
    seq = 0
    img_dir = os.path.join(ROOT, "assets", "img")
    for row in read_tsv(os.path.join(SRC, "vocab.tsv")):
        uid, ru, pos, zh, ex_ru, ex_zh, scene = (row + [""] * 7)[:7]
        ru_stress = (row[7] if len(row) > 7 else "").strip() or ru
        seq += 1
        wid = "w%03d" % seq
        clean = re.sub(r"[^а-яА-ЯёЁ\- ]", "", ru)
        # 定制配图：assets/img/<id>.jpg 存在时启用（由工具生成/处理）
        has_img = os.path.exists(os.path.join(img_dir, wid + ".jpg"))
        words.append({
            "id": wid,
            "unit": uid,
            "ru": ru,
            "ru_stress": ru_stress,          # 带重音符的词形（未标注时与 ru 相同）
            "pos": pos,
            "zh": zh,
            "ex_ru": ex_ru,
            "ex_zh": ex_zh,
            "scene": scene or "generic",
            "img": 1 if has_img else 0,      # 1=使用 assets/img/<id>.jpg 定制配图
            # 派生字段：首字母用于拼写题首提示，字母数用于填空长度
            "initial": clean[:1].upper() or ru[:1].upper(),
            "slots": len(re.sub(r"[^а-яА-ЯёЁ]", "", clean)),
        })

    by_unit = {}
    for w in words:
        by_unit.setdefault(w["unit"], []).append(w["id"])
    for u in units:
        u["wordIds"] = by_unit.get(u["id"], [])

    payload = {
        "meta": {
            "book": "走遍俄罗斯（外研社引进《Дорога в Россию》）第 1 册",
            "unitCount": len(units),
            "wordCount": len(words),
            "note": "单元主题依教材课序编排，词条为该课核心词汇；例句为教学用原创短句。",
        },
        "units": units,
        "words": words,
    }

    body = json.dumps(payload, ensure_ascii=False, indent=1)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* 自动生成，请勿手改；修改请编辑 src/*.tsv 后运行 tools/build_data.py */\n")
        f.write("window.RV_DATA = ")
        f.write(body)
        f.write(";\n")

    print("units=%d words=%d -> %s" % (len(units), len(words), OUT))


if __name__ == "__main__":
    main()

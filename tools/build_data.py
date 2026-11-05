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


def read_knowledge(path):
    """knowledge.tsv 支持「标题行以 | 结尾，正文写在下一行」的多行写法。

    旧版按行读取，正文行被当成新记录丢弃，导致知识总结全部为空。
    这里做向前合并：只有 3 列且第 4 列为空时，把后续非记录行并入正文。
    """
    rows = []
    pending = None
    with open(path, encoding="utf-8-sig") as f:
        for raw in f:
            line = raw.rstrip("\n").rstrip("\r").strip()
            if not line or line.startswith("#"):
                continue
            cells = [c.strip() for c in line.split("|")]
            is_record = len(cells) >= 3 and re.match(r"^u\d+$", cells[0])
            if is_record:
                if pending is not None:
                    rows.append(pending)
                pending = cells
            elif pending is not None:
                # 续行：接到上一行的最后一列
                pending[-1] = (pending[-1] + "\n" + line).strip()
    if pending is not None:
        rows.append(pending)
    return rows


def main():
    units = []
    for row in read_tsv(os.path.join(SRC, "units.tsv")):
        uid, no, ru_title, zh_title, desc = row[:5]
        book = int(row[5]) if len(row) > 5 and row[5].strip().isdigit() else 1
        units.append({
            "id": uid,
            "no": int(no),
            "book": book,
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

    # 课文知识总结（src/knowledge.tsv：unit|分类|标题|内容，正文可换行）
    knowledge = []
    cat_map = {"发音": "pron", "语法": "gram", "词汇": "vocab", "文化": "culture", "易错": "pitfall"}
    for row in read_knowledge(os.path.join(SRC, "knowledge.tsv")):
        if len(row) >= 3:
            u, cat, title = row[0], row[1], row[2]
            content = "|".join(row[3:]).strip()
            knowledge.append({"unit": u, "cat": cat_map.get(cat, cat), "catZh": cat, "title": title, "content": content})

    # 字母表（src/alphabet.tsv：大写|小写|名称|音标|类型|例词|例词释义|发音提示）
    alphabet = []
    for row in read_tsv(os.path.join(SRC, "alphabet.tsv")):
        row = (row + [""] * 8)[:8]
        alphabet.append({
            "upper": row[0], "lower": row[1], "name": row[2], "ipa": row[3],
            "type": row[4], "example": row[5], "exampleZh": row[6], "note": row[7]
        })

    # 情景短语（src/phrases.tsv：分类|俄语|中文|提示）
    phrases = []
    for row in read_tsv(os.path.join(SRC, "phrases.tsv")):
        row = (row + [""] * 4)[:4]
        if row[1]:
            phrases.append({"cat": row[0], "ru": row[1], "zh": row[2], "note": row[3]})

    # 内置小词典（src/dict.tsv：ru|pos|zh），供词典查询
    dict_entries = []
    for row in read_tsv(os.path.join(SRC, "dict.tsv")):
        if len(row) >= 3:
            dict_entries.append({"ru": row[0], "pos": row[1], "zh": row[2]})

    payload = {
        "knowledge": knowledge,
        "dict": dict_entries,
        "alphabet": alphabet,
        "phrases": phrases,
        "meta": {
            "book": "走遍俄罗斯（外研社引进《Дорога в Россию》）第 1–4 册主题扩展",
            "unitCount": len(units),
            "wordCount": len(words),
            "alphabetCount": len(alphabet),
            "phraseCount": len(phrases),
            "knowledgeCount": len(knowledge),
            "note": "第 1 册为教材课序核心词；第 2–4 册为原创主题扩展词，例句为教学模板句，不代表教材原文词表。",
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

    print("units=%d words=%d dict=%d -> %s" % (len(units), len(words), len(dict_entries), OUT))


if __name__ == "__main__":
    main()

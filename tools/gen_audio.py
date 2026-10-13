# -*- coding: utf-8 -*-
"""
为词条 + 例句生成俄语真人发音（Microsoft Edge 在线神经语音，标准语速略慢）。

用法：
    python tools/gen_audio.py                 # 全量（已存在的文件会跳过）
    python tools/gen_audio.py --force         # 全部重生成
    python tools/gen_audio.py --voice ru-RU-DmitryNeural --word-rate "-5%" --sent-rate "-10%"

产物：
    assets/audio/words/<id>.mp3    单词朗读
    assets/audio/sent/<id>.mp3     例句朗读
    assets/audio/manifest.json     音频清单（名称、时长估算、字节数）
"""
import argparse
import asyncio
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "js", "data.js")
OUT_W = os.path.join(ROOT, "assets", "audio", "words")
OUT_S = os.path.join(ROOT, "assets", "audio", "sent")


def load_data():
    with open(DATA, encoding="utf-8") as f:
        src = f.read()
    body = src.split("window.RV_DATA =", 1)[1].rstrip().rstrip(";")
    return json.loads(body)


async def synth(sem, text, voice, rate, path, tag, stats, retries=4):
    import edge_tts
    out = {"ok": False}
    for attempt in range(retries):
        try:
            async with sem:
                comm = edge_tts.Communicate(text, voice, rate=rate, volume="+0%", pitch="+0Hz",
                                            connect_timeout=20, receive_timeout=90)
                await asyncio.wait_for(comm.save(path), timeout=120)
            if os.path.getsize(path) > 800:
                out["ok"] = True
                break
            raise RuntimeError("file too small")
        except Exception as e:  # 网络抖动 -> 指数退避重试
            if attempt == retries - 1:
                out["err"] = "%s" % e
            else:
                await asyncio.sleep(1.2 * (attempt + 1))
    if out["ok"]:
        stats["done"] += 1
        if stats["done"] % 25 == 0:
            print("  ...%d/%d (%s)" % (stats["done"], stats["total"], tag), flush=True)
    else:
        stats["fail"].append({"id": tag, "err": out.get("err", "unknown")})
        print("  ✗ %s: %s" % (tag, out.get("err")), flush=True)
    return out


async def main_async(args):
    data = load_data()
    words = data["words"]
    tasks, manifest = [], []
    sem = asyncio.Semaphore(args.concurrency)
    stats = {"done": 0, "total": 0, "fail": []}

    jobs = []
    for w in words:
        jobs.append((w["id"], w["ru"], os.path.join(OUT_W, w["id"] + ".mp3"), args.word_rate, "word"))
        jobs.append((w["id"], w["ex_ru"], os.path.join(OUT_S, w["id"] + ".mp3"), args.sent_rate, "sent"))
    jobs = [(i, t, p, r, k) for (i, t, p, r, k) in jobs
            if args.force or not (os.path.exists(p) and os.path.getsize(p) > 800)]
    stats["total"] = len(jobs)
    print("待生成 %d 个音频（共 %d 词条）" % (len(jobs), len(words)), flush=True)

    os.makedirs(OUT_W, exist_ok=True)
    os.makedirs(OUT_S, exist_ok=True)

    coros = []
    for wid, text, path, rate, kind in jobs:
        coros.append(synth(sem, text, args.voice, rate, path, wid + ":" + kind, stats))
    results = await asyncio.gather(*coros)

    # 清单
    for w in words:
        pw = os.path.join(OUT_W, w["id"] + ".mp3")
        ps = os.path.join(OUT_S, w["id"] + ".mp3")
        manifest.append({
            "id": w["id"],
            "word": os.path.exists(pw) and os.path.getsize(pw) or 0,
            "sent": os.path.exists(ps) and os.path.getsize(ps) or 0
        })
    with open(os.path.join(ROOT, "assets", "audio", "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"voice": args.voice, "wordRate": args.word_rate, "sentRate": args.sent_rate,
                   "count": len(words), "items": manifest}, f, ensure_ascii=False)

    total_bytes = sum((m["word"] + m["sent"]) for m in manifest)
    print("完成 %d/%d，失败 %d，总大小 %.1f MB" % (stats["done"], stats["total"], len(stats["fail"]),
                                            total_bytes / 1024 / 1024))
    if stats["fail"]:
        with open(os.path.join(ROOT, "tools", "audio_failed.json"), "w", encoding="utf-8") as f:
            json.dump(stats["fail"], f, ensure_ascii=False, indent=1)
        print("失败清单已写入 tools/audio_failed.json，重跑本脚本会自动续传")
    return 0 if not stats["fail"] else 2


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="ru-RU-SvetlanaNeural")
    ap.add_argument("--word-rate", default="-5%", help="单词语速，负值为放慢")
    ap.add_argument("--sent-rate", default="-10%", help="例句语速")
    ap.add_argument("--concurrency", type=int, default=6)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    sys.exit(asyncio.run(main_async(args)))

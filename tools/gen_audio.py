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

HIGH_QUALITY_FORMAT = "audio-24khz-96kbitrate-mono-mp3"


def ensure_high_quality_format():
    """把 edge-tts 的输出从 48kbps 提升到 96kbps（音质更干净，体积约 2 倍）。

    实测 Edge 免费端点仅接受 mp3 家族（16khz/32k、24khz/48k、24khz/96k），
    48khz 与 PCM/Opus 均返回 NoAudioReceived，故取可用的最高档 24khz/96k。
    同时修正 edge-tts 的字节-时间换算常数（48k → 96k），保证 word boundary 正确。
    注意：必须用 find_spec 定位文件（不要先 import），否则本进程会缓存旧代码。
    """
    import importlib.util
    import re as _re
    spec = importlib.util.find_spec("edge_tts")
    if not spec or not spec.origin:
        return False
    p = os.path.join(os.path.dirname(spec.origin), "communicate.py")
    with open(p, encoding="utf-8") as f:
        s = f.read()
    if HIGH_QUALITY_FORMAT in s:
        return True
    s2, n = _re.subn(r'"outputFormat":"[^"]+"', '"outputFormat":"%s"' % HIGH_QUALITY_FORMAT, s)
    s2 = s2.replace("// 48_000", "// 96_000")
    if n and s2 != s:
        with open(p, "w", encoding="utf-8") as f:
            f.write(s2)
        return True
    return False


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
    hq = ensure_high_quality_format()
    print("音质模式：%s" % ("48kHz / 96kbps（已启用高质量补丁）" if hq else "24kHz / 48kbps（补丁未生效，使用默认）"), flush=True)
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

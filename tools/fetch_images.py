# -*- coding: utf-8 -*-
"""
为每个单词抓取一张定制配图（Bing 图片搜索 → 原图优先，失败回退 Bing 缩略图）。

    python tools/fetch_images.py                # 全量（已存在的跳过）
    python tools/fetch_images.py --force        # 全部重抓
    python tools/fetch_images.py w023 w168      # 只抓指定词
    python tools/fetch_images.py --probe w023   # 只列候选不下载

数据：tools/img_prompts.tsv（id → 英文检索词）
产物：assets/img/<id>.jpg（最长边 900px）与 assets/img/manifest.json（含来源链接）
"""
import io
import json
import os
import re
import sys
import threading
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "assets", "img")
PROMPTS = os.path.join(ROOT, "tools", "img_prompts.tsv")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
MAX_SIDE = 900
MIN_W = 420          # 原图最小宽度
MIN_W_THUMB = 300    # 缩略图最小宽度
MIN_BYTES = 12000    # 小于 12KB 视为图标/占位图

EXTS = (".jpg", ".jpeg", ".png", ".webp")


def load_prompts():
    out = {}
    with io.open(PROMPTS, encoding="utf-8-sig") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip() or "\t" not in line:
                continue
            wid, q = line.split("\t", 1)
            out[wid] = q.strip()
    return out


def fetch(url, timeout=12, referer=None):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "image/avif,image/webp,image/*,*/*;q=0.8" if referer is None else "text/html",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        **({"Referer": referer} if referer else {}),
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), r.headers.get("Content-Type", "")


# 带水印的图库站点（Alamy/Getty/Shutterstock 等），直接跳过
STOCK_HOSTS = ("alamy.com", "gettyimages.com", "istockphoto.com", "dreamstime.com",
               "shutterstock.com", "123rf.com", "depositphotos.com", "stock.adobe.com",
               "vectorstock.com", "agefotostock.com", "pond5.com", "canstockphoto.com",
               "featurepics.com", "photolibrary.in", "megapixl.com")


def bing_candidates(query, count=35, retries=3):
    """返回候选列表 [(murl, turl, title, page_url)]；带大图 + 知识共享许可过滤（去水印图库）"""
    q = urllib.parse.quote(query)
    url = ("https://cn.bing.com/images/async?q=%s&first=1&count=%d&mmasync=1"
           "&qft=+filterui:imagesize-large+filterui:license-L2_L3_L4_L5_L6_L7" % (q, count))
    html = None
    for attempt in range(retries):
        try:
            html = fetch(url, referer="https://cn.bing.com/images/search?q=%s" % q)[0].decode("utf-8", "ignore")
            break
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))
    out = []
    for m in re.finditer(r'class="iusc"[^>]*\sm="(\{.*?\})"', html, re.S):
        raw = m.group(1)
        raw = (raw.replace("&quot;", '"').replace("&amp;", "&")
                  .replace("&#39;", "'").replace("&lt;", "<").replace("&gt;", ">"))
        try:
            d = json.loads(raw)
        except Exception:
            continue
        murl = d.get("murl") or ""
        turl = d.get("turl") or ""
        if not murl and not turl:
            continue
        if any(h in murl.lower() for h in STOCK_HOSTS):
            continue
        out.append((murl, turl, d.get("t") or "", d.get("purl") or ""))
    return out


def save_jpeg(data, out_path):
    from PIL import Image
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tf:
        tf.write(data)
        tmp = tf.name
    try:
        im = Image.open(tmp)
        im.load()
        im = im.convert("RGB")
        w, h = im.size
        scale = min(1.0, MAX_SIDE / float(max(w, h)))
        if scale < 1.0:
            im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        im.save(out_path, "JPEG", quality=84, optimize=True, progressive=True)
        return im.size
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def _try_url(u, out_path, minw):
    """下载并转换为 JPEG，成功返回 (w,h)"""
    try:
        data, ctype = fetch(u, timeout=10)
    except Exception:
        return None
    if len(data) < MIN_BYTES:
        return None
    if "image" not in ctype and not u.lower().split("?")[0].endswith(EXTS):
        return None
    try:
        size = save_jpeg(data, out_path)
    except Exception:
        return None
    if size[0] < minw:
        try:
            os.unlink(out_path)
        except OSError:
            pass
        return None
    return size


def grab_one(query, out_path):
    """按 原图→缩略图 顺序尝试，返回 (size, bytes, kind, src, title, page) 或 None"""
    cands = bing_candidates(query)
    for murl, turl, title, page in cands[:6]:
        for kind, u in (("original", murl), ("thumb", turl)):
            if not u:
                continue
            size = _try_url(u, out_path, MIN_W if kind == "original" else MIN_W_THUMB)
            if size:
                return size, os.path.getsize(out_path), kind, u, title, page
    return None


def main():
    argv = sys.argv[1:]
    force = "--force" in argv
    probe = "--probe" in argv
    ids = [a for a in argv if not a.startswith("--")]
    prompts = load_prompts()
    os.makedirs(IMG_DIR, exist_ok=True)
    manifest_path = os.path.join(IMG_DIR, "manifest.json")
    manifest = {}
    if os.path.exists(manifest_path):
        try:
            manifest = json.load(io.open(manifest_path, encoding="utf-8"))
        except Exception:
            manifest = {}

    todo = [w for w in sorted(prompts)
            if (not ids or w in ids) and (force or not os.path.exists(os.path.join(IMG_DIR, w + ".jpg")))]
    print("待抓取 %d 个（共 %d 词）" % (len(todo), len(prompts)), flush=True)

    ok = fail = 0
    lock = threading.Lock()
    from concurrent.futures import ThreadPoolExecutor

    def work(wid):
        q = prompts[wid]
        out = os.path.join(IMG_DIR, wid + ".jpg")
        try:
            r = grab_one(q, out)
        except Exception:
            r = None
        if r:
            size, nbytes, kind, src, title, page = r
            with lock:
                manifest[wid] = {"w": size[0], "h": size[1], "bytes": nbytes,
                                 "kind": kind, "src": src, "title": title[:80],
                                 "page": page[:160], "query": q}
                print("✓ %-6s %4dx%-4d %5.0fKB %-8s %s" % (wid, size[0], size[1], nbytes / 1024.0, kind, title[:24]), flush=True)
            return True
        with lock:
            print("✗ %-6s 「%s」无可用图片" % (wid, q[:28]), flush=True)
        return False

    with ThreadPoolExecutor(max_workers=6) as ex:
        for res in ex.map(work, todo):
            if res:
                ok += 1
            else:
                fail += 1

    with io.open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1, sort_keys=True)
    total = sum(v.get("bytes", 0) for v in manifest.values())
    print("完成：成功 %d，失败 %d；清单共 %d 张，合计 %.1f MB" % (ok, fail, len(manifest), total / 1048576.0))
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env bash
# Windows 便携版打包：把 electron-builder 的 win-unpacked 压成 zip（免安装，解压即用）
# 用法：bash tools/pack_win.sh [输出目录，默认 release3]
set -e
cd "$(dirname "$0")/.."
OUT="${1:-release3}"
SRC="$OUT/win-unpacked"
NAME="RuVocab-Portable-1.4.0"

if [ ! -f "$SRC/RuVocab.exe" ]; then
  echo "未找到 $SRC/RuVocab.exe，请先运行: npx electron-builder --win --x64"
  exit 1
fi

# 删除损坏的旧便携 exe（若存在）
rm -f "$OUT/RuVocab-Portable-"*.exe 2>/dev/null || true

Z7="node_modules/7zip-bin/win/x64/7za.exe"
"$Z7" a -tzip "$OUT/$NAME.zip" "./$SRC/*" -mx=7 > /dev/null
echo "✓ $OUT/$NAME.zip  $(du -h "$OUT/$NAME.zip" | cut -f1)"

#!/usr/bin/env bash
# ============================================================
# 一键发布到 GitHub（创建仓库 → 推送源码与产物 → 建 Release 附件）
#
# 用法（二选一）：
#   1) 已登录 gh CLI：   bash tools/publish_github.sh
#   2) 提供一次性令牌：  GH_TOKEN=ghp_xxx bash tools/publish_github.sh
#      （令牌需 repo 权限；用完可在 GitHub 设置里撤销）
#
# 可选环境变量：
#   REPO=ruvocab             仓库名（默认 ruvocab）
#   OWNER=你的用户名          默认取 GH_TOKEN/gh 对应的账号
#   PRIVATE=1                创建为私有仓库（默认私有）
# ============================================================
set -e
cd "$(dirname "$0")/.."

REPO="${REPO:-ruvocab}"
VERSION="1.2.0"
PRIVATE="${PRIVATE:-1}"

if ! command -v git >/dev/null; then echo "需要 git"; exit 1; fi
if [ ! -d .git ]; then
  echo "当前目录还没有 git 仓库，请先执行： git init && git add -A && git commit -m 'init'"
  exit 1
fi

# ---------- 1. 取得身份与令牌 ----------
if [ -n "$GH_TOKEN" ]; then
  OWNER="${OWNER:-$(curl -s -H "Authorization: token $GH_TOKEN" https://api.github.com/user | sed -n 's/.*"login": *"\([^"]*\)".*/\1/p' | head -1)}"
  echo "→ 使用 GH_TOKEN，账号：$OWNER"
  REMOTE="https://x-access-token:${GH_TOKEN}@github.com/${OWNER}/${REPO}.git"
  API_AUTH=(-H "Authorization: token $GH_TOKEN")
elif command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  OWNER="${OWNER:-$(gh api user -q .login)}"
  echo "→ 使用 gh CLI，账号：$OWNER"
  REMOTE="https://github.com/${OWNER}/${REPO}.git"
  API_AUTH=()
else
  cat <<'EOF'
未检测到可用的 GitHub 凭证。任选一种：
  A) 安装并登录 gh：  winget install GitHub.cli && gh auth login
  B) 生成一次性令牌（Settings → Developer settings → Personal access tokens，
     勾选 repo 权限），然后：  GH_TOKEN=ghp_xxx bash tools/publish_github.sh
EOF
  exit 1
fi

# ---------- 2. 创建仓库（已存在则跳过） ----------
if [ -n "$GH_TOKEN" ]; then
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://api.github.com/user/repos \
    "${API_AUTH[@]}" -d "{\"name\":\"$REPO\",\"private\":$([ "$PRIVATE" = 1 ] && echo true || echo false),\"description\":\"走遍俄罗斯 · 俄语词汇卡 — 离线俄语背单词应用（Web/PWA · Windows · Android）\"}")
  echo "→ 创建仓库 HTTP $CODE$([ "$CODE" = 422 ] && echo '（已存在，继续）' || true)"
else
  gh repo create "$REPO" --private=$([ "$PRIVATE" = 1 ] && echo true || echo false) \
    --description "走遍俄罗斯 · 俄语词汇卡 — 离线俄语背单词应用（Web/PWA · Windows · Android）" \
    --source=. --remote=origin --push || echo "→ 仓库可能已存在，转为普通推送"
fi

# ---------- 3. 推送 ----------
git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE"
git branch -M main 2>/dev/null || true
echo "→ 推送源码与产物（约 25MB，视网络 1–5 分钟）…"
git push -u origin main --force-with-lease 2>/dev/null || git push -u origin main

echo "✓ 完成：https://github.com/${OWNER}/${REPO}"

# ---------- 4. 可选：把安装包挂到 Release ----------
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  echo "→ 创建 Release 并上传安装包…"
  gh release create "v$VERSION" \
    "release4/走遍俄罗斯词汇卡-${VERSION}-release.apk" \
    "release4/走遍俄罗斯词汇卡-${VERSION}-debug.apk" \
    "release5/RuVocab-${VERSION}-x64.exe" \
    "release5/RuVocab-Portable-${VERSION}.zip" \
    --title "v$VERSION 三端发布" \
    --notes "Web/PWA + Windows 安装包 + Android APK（含 346 条真人发音，全离线可用）" || echo "（Release 创建失败，可稍后在网页上手动上传）"
else
  cat <<EOF
提示：Widows 安装包与便携版体积较大（95MB / 128MB），建议挂到 Release 而不是提交进仓库：
     浏览器打开 https://github.com/${OWNER}/${REPO}/releases/new
     把 release5/ 下的 exe 与 zip 拖进去即可发布。
EOF
fi

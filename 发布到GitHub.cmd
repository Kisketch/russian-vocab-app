@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title 走遍俄罗斯词汇卡 · 发布到 GitHub

echo ============================================================
echo   走遍俄罗斯词汇卡 · 一键发布到 GitHub
echo ============================================================
echo.
where git >nul 2>nul
if errorlevel 1 (
  echo [x] 未找到 git。请先安装 Git for Windows：https://git-scm.com/download/win
  pause & exit /b 1
)

echo 步骤 1/3  在浏览器里创建空仓库（约 30 秒）
echo   · 仓库名：ruvocab
echo   · 类型：Private / Public 随你
echo   · 重要：不要勾选 Add a README / .gitignore / license（否则推送会冲突）
echo.
start "" "https://github.com/new?name=ruvocab&description=%E8%B5%B0%E9%81%8D%E4%BF%84%E7%BD%97%E6%96%AF%C2%B7%E4%BF%84%E8%AF%AD%E8%AF%8D%E6%B1%87%E5%8D%A1%20%E2%80%94%20%E7%A6%BB%E7%BA%BF%E4%BF%84%E8%AF%AD%E8%83%8C%E5%8D%95%E8%AF%8D%E5%BA%94%E7%94%A8"
echo 创建完成后，回到本窗口按任意键继续...
pause >nul

set "OWNER="
set /p OWNER=请输入你的 GitHub 用户名（直接回车用 Kisketch）:
if "%OWNER%"=="" set OWNER=Kisketch
set "REPO="
set /p REPO=仓库名（直接回车用 ruvocab）:
if "%REPO%"=="" set REPO=ruvocab

git remote remove origin >nul 2>nul
git remote add origin https://github.com/%OWNER%/%REPO%.git

echo.
echo 步骤 2/3  正在推送源码与产物（约 25MB；首次会弹出浏览器让你登录 GitHub）
echo ------------------------------------------------------------
git push -u origin main --progress
if errorlevel 1 (
  echo ------------------------------------------------------------
  echo [x] 推送失败。请检查：用户名/仓库名是否正确、浏览器登录是否完成。
  echo     也可改用 GitHub Desktop：File -^> Add local repository -^> 选本文件夹 -^> Publish repository
  pause & exit /b 1
)
echo ------------------------------------------------------------
echo [√] 上传完成：https://github.com/%OWNER%/%REPO%
echo.

echo 步骤 3/3  安装包挂到 Release（Windows 安装包 91MB、便携版 122MB 不适合放进仓库）
start "" "https://github.com/%OWNER%/%REPO%/releases/new?tag=v1.2.0&title=v1.2.0%20%E4%B8%89%E7%AB%AF%E5%8F%91%E5%B8%83"
echo   在打开的页面里，把 release5 目录下的两个文件拖进附件区：
echo       RuVocab-1.2.0-x64.exe
echo       RuVocab-Portable-1.2.0.zip
echo   然后点 Publish release 即可（APK 已在仓库里，无需重复上传）。
echo.
pause

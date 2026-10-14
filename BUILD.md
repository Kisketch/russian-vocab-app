# 打包构建指南（Windows 桌面端 / Android 移动端）

本仓库一份代码、三个出口：

| 出口 | 形态 | 适合 |
| --- | --- | --- |
| Web / PWA | `dist/` 静态站（含 Service Worker、可安装） | 任何设备、免安装、自动更新 |
| Windows 桌面端 | Electron → NSIS 安装包 / 绿色便携版 `.exe` | Windows 10/11 x64 |
| Android 移动端 | Capacitor → APK / AAB（Android Studio 出包） | Android 6.0+ |

---

## 0. 环境准备（一次性）

- Node.js ≥ 18（本项目在 22 上开发验证）
- Python 3.10+（仅构建素材时需要：音频、图标、dist）
- 桌面端打包：无需额外安装（electron-builder 自动下载 NSIS）
- 安卓出包：Android Studio（自带 JDK 17 与 SDK）；只想“能用”，可直接用 PWA，见第 3 节

```bash
npm install          # 安装 electron / electron-builder / capacitor
```

> 国内网络加速（推荐）：Electron 二进制默认从 GitHub 下载，较慢时可切换镜像：
>
> ```bash
> export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
> export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
> ```

## 1. 构建 Web 运行时（两个端都依赖）

```bash
python tools/gen_audio.py     # 生成全部真人发音（首次需联网，之后增量）
python tools/gen_icons.py     # 生成图标 / 启动图（PWA、Windows、Android 共用）
python tools/build_web.py     # 产出 dist/（应用壳 + 词库 + 音频 + 图标）
```

## 2. Windows 桌面端

```bash
npm run dist:win
bash tools/pack_win.sh     # 追加生成绿色便携版 zip
```

产物（默认输出到 `release3/`，electron-builder 输出目录可用 `-c.directories.output=xxx` 覆盖）：

- `RuVocab-1.1.0-x64.exe` —— NSIS 安装包（可选安装目录、桌面快捷方式、中文卸载项）
- `RuVocab-Portable-1.1.0.zip` —— 免安装绿色版，解压后双击 `RuVocab.exe` 即用
- `win-unpacked/RuVocab.exe` —— 解包目录（已用 rcedit 写入应用图标与版本信息）

> `package.json` 中 `signAndEditExecutable: false`：跳过 winCodeSign 环节（其压缩包含 macOS 符号链接，非管理员环境解压会失败）；应用图标与版本信息随后由 `rcedit-x64.exe` 写入，窗口图标在 `electron/main.js` 中指定，不受影响。

日常开发调试：

```bash
npm start        # 构建 dist 并启动应用
npm run dev      # 带开发者菜单（需 cross-env，或手动 set RUVOCAB_DEV=1）
```

说明：窗口为独立桌面应用（WebView 渲染），数据保存在系统用户目录的应用数据中，与浏览器 localStorage 互不影响。

### Windows 打包常见问题

| 现象 | 处理 |
| --- | --- |
| Electron 下载卡住 | 设 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`（必要），再 `node node_modules/electron/install.js` |
| winCodeSign 解压报“无法创建符号链接” | 保持 `signAndEditExecutable: false`（已配置） |
| `remove app.asar: being used by another process` | 关闭正在运行的 RuVocab/electron 进程，或换输出目录 `-c.directories.output=release2` |
| portable 目标产物只有几十 KB | electron-builder 25 在 asarUnpack 下的已知问题；便携版请改用 `tools/pack_win.sh` 打 zip |

## 3. Android 移动端

### 方式 A：PWA 直接安装（无需 Android Studio）

1. 把 `dist/` 部署到任意静态托管（或本地 `python -m http.server` 后局域网访问）
2. 手机 Chrome / Edge 打开 → 菜单「安装应用 / 添加到主屏幕」
3. 首次进入后到「设置 → 离线语音 → 缓存全部语音」，即可完全离线使用

### 方式 B：打包 APK（Capacitor）—— 本机已验证可出包

**已产出（release4/）**：
- `走遍俄罗斯词汇卡-1.2-release.apk`（8.7MB，正式签名版，推荐安装）
- `走遍俄罗斯词汇卡-1.2-debug.apk`（9.5MB，调试签名版，同样可直接安装）

工程已就绪：包名 `cn.yuyan.ruvocab`、版本 1.2（versionCode 3）、minSdk 22（Android 5.1+）、targetSdk 34、图标与启动图、363 个 web 资产（含 346 条音频）已打进 APK。

#### 1. 安装构建环境（一次性，约 500MB）

```bash
# JDK 17（本机装到 C:\Users\Lgnatius\AndroidBuild\jdk-17.0.20.1+1）
curl -L -o jdk17.zip "https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip"

# Android 命令行工具
curl -L -o cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
# 解压后放到 <sdk>/cmdline-tools/latest/，然后：
yes | <sdk>/cmdline-tools/latest/bin/sdkmanager.bat --licenses
<sdk>/cmdline-tools/latest/bin/sdkmanager.bat "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

#### 2. 让 Gradle 走国内镜像（关键，否则下载很慢）

`~/.gradle/init.gradle`（已配置）加入阿里云仓库；并把 `android/gradle/wrapper/gradle-wrapper.properties` 的
`distributionUrl` 改为 `https://mirrors.cloud.tencent.com/gradle/gradle-8.2.1-all.zip`。

#### 3. 指定 SDK 路径

`android/local.properties`（已生成，勿提交）：

```
sdk.dir=C\:\\Users\\Lgnatius\\AndroidBuild\\android-sdk
```

#### 4. 编译

```bash
cd android
export JAVA_HOME="C:/Users/Lgnatius/AndroidBuild/jdk-17.0.20.1+1"
export ANDROID_HOME="C:/Users/Lgnatius/AndroidBuild/android-sdk"
./gradlew assembleDebug      # → app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease    # → app/build/outputs/apk/release/app-release-unsigned.apk
```

> ⚠️ **`JAVA_HOME` 必须指向完整 JDK，不能是 JRE。** 若系统 `java` 指向 JRE
> （如 `Eclipse Adoptium\jre-21.0.12.101-hotspot`），构建会在
> `:capacitor-android:compileDebugJavaWithJavac` 失败并报
> `jlink executable ...\bin\jlink.exe does not exist` —— JRE 不含 `jlink`/`javac`。
> 验证方法：`ls "$JAVA_HOME/bin/jlink.exe"`。**注意**：`assembleRelease` 仍可能"看似成功"，
> 因为 Gradle 容忍该任务失败而 assets 打包照常完成，结果得到的是**旧版本号的 APK**，
> 务必用 `aapt2 dump badging` 确认 versionCode/versionName 符合预期。

#### 5. 签名 Release 版（密钥已归档在项目根目录 `ruvocab-release.jks`）

```bash
# 生成密钥（已生成过，换新密钥时才需要）
keytool -genkeypair -v -keystore ruvocab-release.jks -alias ruvocab -keyalg RSA -keysize 2048 \
  -validity 10000 -storepass ruvocab2026 -keypass ruvocab2026 -dname "CN=RuVocab, C=CN"

# 对齐 + 签名
zipalign -p -f 4 app-release-unsigned.apk aligned.apk
apksigner sign --ks ../ruvocab-release.jks --ks-key-alias ruvocab \
  --ks-pass pass:ruvocab2026 --key-pass pass:ruvocab2026 --out 走遍俄罗斯词汇卡-1.2-release.apk aligned.apk
apksigner verify --print-certs 走遍俄罗斯词汇卡-1.2-release.apk
```

> 密钥库密码 `ruvocab2026`（store 与 key 相同），别名 `ruvocab`，归档于项目根目录。若要正式上架，请更换为自己的密钥与密码，并改 `android/app/build.gradle` 的 `signingConfigs` 让 Gradle 自动签名。

#### 6. 安装到手机

把 APK 传到手机（数据线 / 微信文件传输 / 网盘），点击安装；系统提示"允许安装未知来源应用"时放行即可。两个 APK **不要同时安装**（签名不同会冲突），装一个就行——推荐 release 版。

#### 7. 以后更新 App

改 web 代码 → `python tools/build_web.py` → `python tools/sync_android.py` → 上面的第 4、5 步重编重签（同一密钥签名才能覆盖安装）。

## 4. 音频说明

- `python tools/gen_audio.py` 使用微软 Edge 神经语音生成（**自动应用 96kbps 高码率补丁**，实测 48kHz/PCM/Opus 端点不支持）：
  - 单词：`ru-RU-SvetlanaNeural`，语速 -5%（标准、略慢）
  - 例句：`ru-RU-SvetlanaNeural`，语速 -10%（更从容，适合跟读）
- 产物 `assets/audio/words/<id>.mp3` 与 `assets/audio/sent/<id>.mp3`（24kHz/96kbps 单声道），全量约 10 MB
- 脚本支持断点续传：中断后重新运行会自动补齐缺失文件；`--force` 全部重生成
- 换男声：`python tools/gen_audio.py --voice ru-RU-DmitryNeural --force`
- 运行时优先播放本地 MP3；文件缺失时自动回退到系统 TTS（Web Speech API）
- 安卓端已在 `MainActivity` 关闭 WebView 的"媒体需用户手势"限制，自动朗读不会被静默拦截

/* 走遍俄罗斯词汇卡 · Windows 桌面端（Electron 主进程） */
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !!process.env.RUVOCAB_DEV;
let win = null;

/* 兼容两种运行形态：源码目录（../dist）与打包后的 asar（dist 同级） */
function resolveAppFile() {
  const candidates = [
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(__dirname, 'dist', 'index.html')
  ];
  return candidates.find(p => fs.existsSync(p)) || candidates[0];
}
function resolveIcon() {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(__dirname, 'build', 'icon.ico'),
    path.join(__dirname, '..', 'build', 'icon.png')
  ];
  return candidates.find(p => fs.existsSync(p));
}

function createWindow() {
  const icon = resolveIcon();
  win = new BrowserWindow({
    width: 1200,
    height: 840,
    minWidth: 760,
    minHeight: 560,
    show: false,
    backgroundColor: '#f5f6f8',
    title: '走遍俄罗斯 · 词汇卡片',
    ...(icon ? { icon } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  win.loadFile(resolveAppFile());

  win.once('ready-to-show', () => win.show());

  // 外部链接用系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => { win = null; });
}

function switchMenu() {
  if (isDev) return;
  Menu.setApplicationMenu(null);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('cn.yuyan.ruvocab');
    switchMenu();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}

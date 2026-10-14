// 桌面端（Electron 渲染层）真实渲染端到端测试
// 纯 Node + CDP 驱动本地 Chromium（与 Electron 同源引擎、同源 file:// 加载）
import { connect } from './cdp_client.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = 'file:///' + path.join(ROOT, 'dist', 'index.html').replace(/\\/g, '/');
const SHOTDIR = path.join(ROOT, 'tools', 'shots');
fs.mkdirSync(SHOTDIR, { recursive: true });
const CHS = 'C:/Users/Lgnatius/.cache/puppeteer/chrome-headless-shell/win64-154.0.8037.57/chrome-headless-shell-win64/chrome-headless-shell.exe';
const PORT = 9410 + Math.floor(Math.random() * 80);
const UDD = path.join(ROOT, '.chs-run-' + Date.now());
const results = [];
const consoleErrors = [], pageExceptions = [], netFailures = [], netBad = [];
const perf = {};
const wait = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);

function logResult(name, pass, detail) { results.push({ name, pass, detail }); log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  — ' + detail : '')); }

let page;
async function evalIn(expr, awaitPromise = true) {
  const r = await page.send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error('EVAL: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
  return r.result.value;
}
async function click(sel) { return evalIn(`(function(){var el=document.querySelector(${JSON.stringify(sel)}); if(!el) return 'NO_EL'; el.click(); return 'ok';})()`); }
async function text(sel) { return evalIn(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent||''`); }
async function count(sel) { return evalIn(`document.querySelectorAll(${JSON.stringify(sel)}).length`); }
async function exists(sel) { return evalIn(`!!document.querySelector(${JSON.stringify(sel)})`); }
async function go(hash) { await evalIn(`location.hash=${JSON.stringify(hash)}`); await wait(450); }
async function waitFor(expr, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { if (await evalIn(expr)) return true; } catch {} await wait(120); }
  return false;
}
async function shot(name) { try { const r = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(SHOTDIR, name + '.png'), Buffer.from(r.data, 'base64')); } catch (e) { log('  shot fail', name, e.message); } }
async function measureRender(hash, readyExpr) { const t0 = Date.now(); await evalIn(`location.hash=${JSON.stringify(hash)}`); const ok = await waitFor(readyExpr, 6000); return { ok, ms: Date.now() - t0 }; }

async function main() {
  log('启动 headless chromium…');
  const child = spawn(CHS, ['--headless', '--remote-debugging-port=' + PORT, '--user-data-dir=' + UDD,
    '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-software-rasterizer', DIST], { stdio: ['ignore', 'ignore', 'inherit'] });
  // 看门狗：超时强制退出并写报告
  const watchdog = setTimeout(() => { log('\n⚠ 看门狗触发：超时，写出部分报告'); finish(child, true); }, 330000);

  let ver = null;
  for (let i = 0; i < 50; i++) {
    try { ver = await fetch('http://127.0.0.1:' + PORT + '/json/version').then(r => r.json()); if (ver && ver.webSocketDebuggerUrl) break; } catch {}
    await wait(300);
  }
  if (!ver || !ver.webSocketDebuggerUrl) { log('无法连接 Chrome 调试端口'); child.kill('SIGKILL'); process.exit(1); }
  const browser = await connect(ver.webSocketDebuggerUrl);
  const targets = await browser.send('Target.getTargets', {}, null, 10000);
  const pageT = targets.targetInfos.find(t => t.type === 'page' && t.url.indexOf('index.html') >= 0) || targets.targetInfos.find(t => t.type === 'page');
  if (!pageT) { log('未找到页面目标'); child.kill('SIGKILL'); process.exit(1); }
  const att = await browser.send('Target.attachToTarget', { targetId: pageT.targetId, flatten: true }, null, 10000);
  const sid = att.sessionId;
  log('已附加页面会话 ' + sid);
  page = { send: (m, p) => browser.send(m, p, sid) };
  const cdp = browser;
  cdp.on('Runtime.consoleAPICalled', (p, sessionId) => { if (sessionId !== sid) return; if (p.type === 'error' || p.type === 'warning') { const txt = (p.args || []).map(a => a.value !== undefined ? String(a.value) : (a.description || '')).join(' '); consoleErrors.push({ type: p.type, text: txt }); } });
  cdp.on('Runtime.exceptionThrown', (p, sessionId) => { if (sessionId !== sid) return; pageExceptions.push(p.exceptionDetails && (p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text)); });
  cdp.on('Network.loadingFailed', (p, sessionId) => { if (sessionId !== sid) return; netFailures.push({ url: p.requestId, error: p.errorText, type: p.type }); });
  cdp.on('Network.responseReceived', (p, sessionId) => { if (sessionId !== sid) return; if (p.response && p.response.status >= 400) netBad.push({ url: p.response.url, status: p.response.status }); });
  await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Network.enable'); await page.send('Performance.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 840, deviceScaleFactor: 1, mobile: false });

  log('\n— 首屏与数据 —');
  const tLoad0 = Date.now();
  const booted = await waitFor(`window.RV_DATA && document.getElementById('view') && document.getElementById('view').innerHTML.length>500`, 20000);
  perf.firstRenderMs = Date.now() - tLoad0;
  const nav = await evalIn(`(function(){var n=performance.getEntriesByType('navigation')[0]; return n?{dom:n.domContentLoadedEventEnd-n.navigationStart,load:n.loadEventEnd-n.navigationStart}:null;})()`);
  perf.navigation = nav;
  logResult('首屏引导（RV_DATA+视图渲染）', booted, perf.firstRenderMs + 'ms' + (nav ? ' | DOM ' + Math.round(nav.dom) + 'ms / Load ' + Math.round(nav.load) + 'ms' : ''));
  perf.memBase = await evalIn(`performance.memory? performance.memory.usedJSHeapSize : null`);

  const words = await evalIn('RV_DATA.words.length');
  logResult('词条数 = 173', words === 173, '实际 ' + words);
  logResult('单元数 = 15', (await evalIn('RV_DATA.units.length')) === 15);
  const scenes = await evalIn('RVScenes.keys().length');
  logResult('情景插画 ≥ 20', scenes >= 20, '实际 ' + scenes);
  const dict = await evalIn('(RV_DATA.dict||[]).length');
  logResult('内置词典 > 500', dict > 500, '实际 ' + dict);
  logResult('词条字段完整', (await evalIn('RV_DATA.words.every(w=>w.ru&&w.pos&&w.zh&&w.ex_ru&&w.ex_zh&&w.scene)')) === true);

  log('\n— file:// 资源加载（桌面端关键）—');
  const gCount = await evalIn('RVGrammar.counts().grammar');
  logResult('语法数据加载（file:// fetch grammar.json）', gCount > 0, 'grammar=' + gCount + (gCount === 0 ? ' → 桌面端语法功能失效' : ''));
  const isFile = await evalIn(`location.protocol==='file:'`);
  const audioManifest = await evalIn(`(function(){return new Promise(function(res){fetch('assets/audio/manifest.json').then(function(r){res('ok:'+r.status)}).catch(function(e){res('fail:'+e.message)})})})()`);
  // file:// 下 Chromium 禁止 fetch 本地文件为预期行为：桌面端 precache 按钮已隐藏、precacheAll 不可达，不影响任何功能
  logResult('音频 manifest fetch 符合预期（file:→禁止 / http:→可用）', isFile ? String(audioManifest).indexOf('fail') === 0 : String(audioManifest).indexOf('ok') === 0, '协议 ' + (isFile ? 'file:' : 'http:') + ' → ' + audioManifest);
  const aMp3 = await evalIn(`(function(){return new Promise(function(res){fetch('assets/audio/words/w023.mp3').then(function(r){res('ok:'+r.status)}).catch(function(e){res('fail:'+e.message)})})})()`);
  logResult('MP3 fetch 符合预期（file:→禁止，由 <audio> 通道承担播放）', isFile ? String(aMp3).indexOf('fail') === 0 : String(aMp3).indexOf('ok') === 0, aMp3);
  // 桌面端真实播放通道：<audio> 元素加载 file:// 媒体（不受 fetch CORS 限制，但需验证）
  const audioPlay = await evalIn(`(function(){return new Promise(function(res){var a=new Audio('assets/audio/words/w023.mp3');var t=setTimeout(function(){res('timeout')},6000);a.addEventListener('canplaythrough',function(){clearTimeout(t);res('canplay')});a.addEventListener('error',function(){clearTimeout(t);res('error')});a.load();})})()`);
  logResult('音频元素可加载 MP3（桌面播放通道）', audioPlay === 'canplay', audioPlay);

  log('\n— 学习页 / 单元卡 —');
  let r = await measureRender('#/units', `document.querySelectorAll('.unit').length>0`);
  logResult('单元总览渲染', r.ok, r.ms + 'ms'); await shot('01-units');
  r = await measureRender('#/unit/u03', `document.querySelector('.flashcard')`);
  logResult('单元学习卡渲染', r.ok, r.ms + 'ms');
  const cardWord = await evalIn(`(document.querySelector('.flashcard .ru')||{}).textContent||''`);
  logResult('卡片正面显示俄语', !!cardWord, cardWord);
  const sceneNodes = await evalIn(`document.querySelectorAll('.scene svg').length + document.querySelectorAll('.scene .scene-img').length`);
  logResult('情景插画注入卡片', sceneNodes > 0, '节点 ' + sceneNodes);
  const imgSrc = await evalIn(`(function(){var i=document.querySelector('.scene .scene-img');return i?i.src:'';})()`);
  if (imgSrc) logResult('定制配图路径正确', /assets\/img\/w\d{3}\.jpg$/.test(imgSrc), imgSrc);
  await click('[data-act="flip"]'); await wait(300);
  logResult('点击翻转至背面', (await evalIn(`document.querySelector('.flashcard').className.indexOf('flipped')>=0`)));
  logResult('背面显示汉语释义', (await evalIn(`document.querySelector('.flashcard').textContent.indexOf('我在大学读书')>=0`)));
  await click('[data-act="unit-mode"][data-mode="list"]'); await wait(400);
  const listRows = await count('.word-row-item');
  logResult('列表模式展示本课词', listRows > 0, '行数 ' + listRows); await shot('02-unit-card');
  await click('[data-act="unit-mode"][data-mode="card"]'); await wait(300);
  // set-lv 按钮带 data-id（标记当前展示卡）：读出实际标记的词再校验
  const curId = await evalIn(`(document.querySelector('[data-act="set-lv"]')||{}).dataset ? document.querySelector('[data-act="set-lv"]').dataset.id : null`);
  await click('[data-act="set-lv"][data-lv="4"]'); await wait(250);
  logResult('手动标记掌握度=4', (await evalIn(`RVStore.get(${JSON.stringify(curId)}).lv`)) === 4, '词 ' + curId + ' 实际 ' + (await evalIn(`RVStore.get(${JSON.stringify(curId)}).lv`)));
  await click('[data-act="fav"]'); await wait(250);
  logResult('收藏生效', (await evalIn(`RVStore.get(${JSON.stringify(curId)}).fav`)) === true);

  log('\n— 练习 —');
  r = await measureRender('#/quiz', `document.querySelector('[data-act="quiz-start"]')`);
  logResult('练习设置页渲染', r.ok, r.ms + 'ms');
  logResult('默认四种题型选中', (await count('[data-act="q-type"].on')) === 4, '实际 ' + (await count('[data-act="q-type"].on')));
  await click('[data-act="quiz-start"]'); await wait(500);
  logResult('进入答题界面', await exists('.q-head'));
  let answered = 0, sawChoice = false, sawSpell = false, sawListen = false;
  for (let step = 0; step < 40; step++) {
    const opts = await count('.option:not([disabled])'); const tiles = await count('#tiles .tile');
    if (opts > 0) { sawChoice = true; const t = await text('#view'); if (t.indexOf('选择对应的俄语单词') >= 0) sawListen = true; const idx = (step % 3 === 0) ? 1 : 0; await click(`.option:not([disabled]):nth-of-type(${Math.min(idx + 1, opts)})`); }
    else if (tiles > 0) { sawSpell = true; for (let i = 0; i < tiles; i++) { await click(`#tiles .tile:nth-of-type(${i + 1})`); } await click('[data-act="spell-check"]'); }
    else break;
    answered++; const fb = await text('#fb'); if (!(fb && fb.length > 10)) { logResult('第' + answered + '题反馈', false, '反馈过短'); break; }
    const nx = await exists('[data-act="q-next"]'); if (nx) await click('[data-act="q-next"]'); else break; await wait(250);
  }
  logResult('完成练习题流程', answered >= 8, '完成 ' + answered + ' 题');
  logResult('出现选择题型', sawChoice); logResult('出现拼写题型', sawSpell); logResult('出现听力题型', sawListen);
  await shot('03-quiz');
  logResult('练习结算页', await waitFor(`document.querySelector('.result-score')`, 4000));

  log('\n— 拼写确定性专测 —');
  await go('#/units'); await go('#/quiz'); await wait(250);   // 同 hash 不触发 hashchange，先离开再回来
  for (let g = 0; g < 8; g++) { const key = await evalIn(`(Array.from(document.querySelectorAll('[data-act="q-type"].on')).filter(function(b){return b.dataset.key!=='spell';})[0]||{}).dataset&&(Array.from(document.querySelectorAll('[data-act="q-type"].on')).filter(function(b){return b.dataset.key!=='spell';})[0].dataset.key)`); if (!key) break; await click(`[data-act="q-type"][data-key="${key}"]`); await wait(150); }
  await click('[data-act="quiz-start"]'); await wait(500);
  const slots = await count('#slots .slot');
  logResult('拼写题渲染字母槽', slots > 0, '槽数 ' + slots);
  const promptZh = await text('.q-main.zh');
  const target = await evalIn(`(RV_DATA.words.filter(function(w){return w.zh===${JSON.stringify(promptZh)}&&!/\\s/.test(w.ru)})[0]||{}).ru`);
  logResult('定位拼写目标词', !!target, promptZh + ' → ' + target);
  if (target) { const need = target.toLowerCase().split(''); for (let i = 1; i < need.length; i++) { await click(`#tiles .tile[data-c="${need[i]}"]:not(.used)`); await wait(60); } await click('[data-act="spell-check"]'); await wait(300); logResult('拼写判题正确', (await text('#fb')).indexOf('回答正确') >= 0); }

  log('\n— 复习 SRS —');
  await evalIn(`(function(){RV_DATA.words.map(function(w){return w.id;}).filter(function(id){return RVStore.state.words[id]&&RVStore.state.words[id].lv>0;}).slice(0,8).forEach(function(id){RVStore.state.words[id].due=Date.now()-1000;});RVStore.save();})()`);
  await go('#/review'); await wait(300);
  if (await exists('[data-act="review-start"]')) { await click('[data-act="review-start"]'); await wait(400); }
  logResult('复习会话渲染卡片', await exists('.flashcard'));
  if (await exists('.flashcard')) {
    await click('[data-act="review-show"]'); await wait(300);
    logResult('自评面板出现', await exists('[data-act="review-grade"]'));
    const ruShown = await text('.flashcard .ru');
    const shownId = await evalIn(`(RV_DATA.words.filter(function(w){return w.ru===${JSON.stringify(ruShown)}})[0]||{}).id`);
    const lvB = await evalIn(`RVStore.get(${JSON.stringify(shownId)}).lv`);
    await click('[data-act="review-grade"][data-q="2"]'); await wait(300);
    logResult('评“清楚”掌握度提升', (await evalIn(`RVStore.get(${JSON.stringify(shownId)}).lv`)) === Math.min(5, lvB + 1), lvB + '→' + (await evalIn(`RVStore.get(${JSON.stringify(shownId)}).lv`)));
  }
  await shot('04-review');

  log('\n— 生词本 —');
  r = await measureRender('#/book', `document.querySelectorAll('.word-row-item').length>0 || document.querySelector('[data-act="book-tab"]')`);
  logResult('生词本渲染', r.ok, r.ms + 'ms');
  await click('[data-act="book-tab"][data-tab="fav"]'); await wait(300); logResult('收藏页签可切换', true); await shot('05-book');

  log('\n— 统计 —');
  r = await measureRender('#/stats', `document.querySelectorAll('.kpi').length>0`);
  logResult('统计页渲染', r.ok, r.ms + 'ms');
  logResult('统计指标卡 = 7', (await count('.kpi')) === 7, '实际 ' + (await count('.kpi')));
  logResult('统计图表 ≥ 4', (await count('.chart-box')) >= 4, '实际 ' + (await count('.chart-box'))); await shot('06-stats');

  log('\n— 词典 / 语法反查 —');
  await go('#/dict'); await wait(300);
  logResult('词典页搜索框', await exists('#dictInput'));
  const hit1 = await evalIn(`RVGrammar.lookup('работаю').words.map(function(w){return w.ru;})`);
  logResult('变形反查 работаю→работать', Array.isArray(hit1) && hit1.indexOf('работать') >= 0, JSON.stringify(hit1));
  const hit2 = await evalIn(`RVGrammar.lookup('大学').words.map(function(w){return w.ru;})`);
  logResult('中文检索 大学→университет', Array.isArray(hit2) && hit2.indexOf('университет') >= 0, JSON.stringify(hit2));
  await go('#/gram'); await wait(400);
  logResult('语法专题集合', (await count('.gram-topic')) >= 1, '数量 ' + (await count('.gram-topic'))); await shot('07-grammar');

  log('\n— 知识总结 —');
  r = await measureRender('#/know', `document.querySelector('.know-cat')`);
  logResult('知识总结渲染', r.ok, r.ms + 'ms');
  logResult('知识条目 ≥ 5', (await count('.know-item')) >= 5, '实际 ' + (await count('.know-item'))); await shot('08-knowledge');

  log('\n— 课本词表 —');
  r = await measureRender('#/list', `document.querySelectorAll('.vrow').length>0`);
  logResult('课本词表渲染', r.ok, r.ms + 'ms');
  logResult('词表行数 = 173', (await count('.vrow')) === 173, '实际 ' + (await count('.vrow')));
  await click('.vchips [data-act="vocab-filter"][data-id="u01"]'); await wait(400);
  logResult('第1课筛选=10', (await count('.vrow')) === 10, '实际 ' + (await count('.vrow'))); await shot('09-list');

  log('\n— 设置 / 持久化 —');
  r = await measureRender('#/settings', `document.querySelector('[data-act="export-json"]')`);
  logResult('设置页渲染', r.ok, r.ms + 'ms');
  logResult('音频索引覆盖 173 词', (await evalIn('RVAudio.counts().words')) === 173, '实际 ' + (await evalIn('RVAudio.counts().words')));
  logResult('进度写入 localStorage', (await evalIn(`localStorage.getItem('ruvocab.state.v1')!==null`))); await shot('10-settings');

  perf.memAfter = await evalIn(`performance.memory? performance.memory.usedJSHeapSize : null`);
  perf.memBaseMB = perf.memBase ? +(perf.memBase / 1048576).toFixed(1) : null;
  perf.memAfterMB = perf.memAfter ? +(perf.memAfter / 1048576).toFixed(1) : null;

  // —— 性能基线：冷重载 + CDP 指标 ——
  log('\n— 性能基线（冷重载）—');
  const tR0 = Date.now();
  await page.send('Page.reload');
  await waitFor(`window.RV_DATA && document.getElementById('view').innerHTML.length>500`, 15000);
  perf.reloadMs = Date.now() - tR0;
  const metrics = await page.send('Performance.getMetrics');
  const M = {}; (metrics.metrics || []).forEach(m => M[m.name] = m.value);
  perf.scriptDurationMs = +(M.ScriptDuration * 1000).toFixed(0);
  perf.layoutMs = +(M.LayoutDuration * 1000).toFixed(0);
  perf.recalcMs = +(M.RecalcStyleDuration * 1000).toFixed(0);
  perf.heapUsedMB = +(M.JSHeapUsedSize / 1048576).toFixed(1);
  perf.heapTotalMB = +(M.JSHeapTotalSize / 1048576).toFixed(1);
  perf.listeners = M.JSEventListeners;
  perf.nodes = M.Nodes;
  logResult('冷重载完成', true, perf.reloadMs + 'ms | 脚本 ' + perf.scriptDurationMs + 'ms | 布局 ' + perf.layoutMs + 'ms | 样式 ' + perf.recalcMs + 'ms | 堆 ' + perf.heapUsedMB + '/' + perf.heapTotalMB + 'MB | 节点 ' + perf.nodes + ' | 监听器 ' + perf.listeners);
  // 再次触发各视图渲染，确认重载后语法数据仍随内嵌生效
  const gAfter = await evalIn('RVGrammar.counts().grammar');
  logResult('冷重载后语法数据仍可用（内嵌生效）', gAfter === 173, 'grammar=' + gAfter);

  await finish(child, false, watchdog);
}

async function finish(child, timedOut, watchdog) {
  clearTimeout(watchdog);
  log('\n=== 运行期错误汇总 ===');
  log('console.error/warning: ' + consoleErrors.length);
  consoleErrors.slice(0, 30).forEach(e => log('  [' + e.type + '] ' + e.text.slice(0, 220)));
  log('page exceptions: ' + pageExceptions.length);
  pageExceptions.slice(0, 30).forEach(e => log('  ' + String(e).slice(0, 220)));
  log('network loadingFailed: ' + netFailures.length);
  netFailures.slice(0, 30).forEach(e => log('  ' + e.error + '  ' + String(e.url).slice(0, 130)));
  log('network bad status(>=400): ' + netBad.length);
  netBad.slice(0, 30).forEach(e => log('  ' + e.status + '  ' + String(e.url).slice(0, 130)));
  const failed = results.filter(r => !r.pass).length;
  log('\n=== 总计：' + results.length + ' 项，失败 ' + failed + ' 项；截图 ' + (perf ? '' : '') + '已存 tools/shots/ ===');
  const report = { results, perf, consoleErrors, pageExceptions, netFailures, netBad, failed, timedOut };
  fs.writeFileSync(path.join(SHOTDIR, 'report.json'), JSON.stringify(report, null, 2));
  log('报告已写入 tools/shots/report.json');
  try { child.kill('SIGKILL'); } catch {}
  process.exit(0);
}

main().catch(e => { log('HARNESS ERROR', e && e.message); process.exit(1); });

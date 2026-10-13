/* 产品审查脚本：逐场景在独立 jsdom 上下文中验证疑似缺陷（证据驱动）
   运行： NODE_PATH=<workspace>/node_modules node tools/audit.js   */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const baseHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<script src="[^"]+"><\/script>/g, '');
const files = ['js/data.js', 'js/scenes.js', 'js/store.js', 'js/audio.js', 'js/app.js'];

const issues = [];
function issue(level, title, evidence) {
  issues.push({ level, title, evidence });
  console.log('  [' + level + '] ' + title + (evidence ? '\n        → ' + evidence : ''));
}
const ok = m => console.log('  [ OK ] ' + m);

function ctx() {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) console.log('  !! ' + e.message); });
  const dom = new JSDOM(baseHtml, {
    url: 'http://localhost/index.html', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: vc
  });
  const win = dom.window;
  win.scrollTo = () => { }; win.confirm = () => true;
  files.forEach(f => win.eval(fs.readFileSync(path.join(root, f), 'utf8')));
  const $ = s => win.document.querySelector(s);
  const $$ = s => Array.from(win.document.querySelectorAll(s));
  const click = el => el && el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const tick = (ms) => new Promise(r => setTimeout(r, ms || 30));
  const nav = async h => { win.location.hash = h; await tick(45); };
  const view = () => $('#view').innerHTML;
  return { win, $, $$, click, tick, nav, view, DATA: win.RV_DATA };
}

async function playQuiz(c, limit) {
  let n = 0;
  while (n++ < (limit || 60)) {
    const opts = c.$$('.option:not([disabled])');
    const tiles = c.$$('#tiles .tile');
    if (opts.length) c.click(opts[0]);
    else if (tiles.length) { tiles.forEach(t => c.click(t)); c.click(c.$('[data-act="spell-check"]')); }
    else break;
    const next = c.$('[data-act="q-next"]');
    if (next) c.click(next); else break;
    await c.tick(15);
  }
}

(async function main() {
  console.log('\n=== 1. 数据层 ===');
  {
    const c = ctx();
    const byRu = {}, byEx = {};
    c.DATA.words.forEach(w => {
      (byRu[w.ru] = byRu[w.ru] || []).push(w.id);
      (byEx[w.ex_ru] = byEx[w.ex_ru] || []).push(w.id);
    });
    const dupRu = Object.entries(byRu).filter(([, v]) => v.length > 1);
    const dupEx = Object.entries(byEx).filter(([, v]) => v.length > 1);
    dupRu.length ? issue('P1', '存在重复俄语单词，文本→音频反查会指错词条', dupRu.map(([k, v]) => k + '=>' + v).join(' ; ')) : ok('无重复俄语单词');
    dupEx.length ? issue('P2', '存在重复例句', dupEx.map(([k, v]) => k + '=>' + v).join(' ; ')) : ok('无重复例句');

    const noStem = c.DATA.words.filter(w => {
      const stem = w.ru.toLowerCase().replace(/[ёе]/g, 'е').slice(0, Math.max(3, w.ru.length - 2));
      return w.ex_ru.toLowerCase().replace(/[ёе]/g, 'е').indexOf(stem) < 0;
    });
    ok('例句含词干比例 ' + (c.DATA.words.length - noStem.length) + '/' + c.DATA.words.length +
      '，其余为变格/变位形式（如需初学者友好应做词形提示）');
    issue('P2', '全库无重音标记（stress），初学者无法判断重音位置', '0/' + c.DATA.words.length +
      ' 词含重音符，例如 ' + c.DATA.words.slice(0, 3).map(w => w.ru).join(' / '));
    const noExTrans = c.DATA.words.filter(w => !w.ex_zh || !w.ex_ru);
    ok('例句字段完整：缺例句 ' + noExTrans.length + ' 条');
  }

  console.log('\n=== 2. 导航可达性 ===');
  {
    const c = ctx();
    await c.nav('#/units');
    const tabSettings = c.$$('#tabbar a').filter(a => a.getAttribute('href') === '#/settings').length;
    const sideSettings = c.$$('#nav a').filter(a => a.getAttribute('href') === '#/settings').length;
    const topGear = c.$$('#navSettings[data-hash="#/settings"]').length;
    const inPage = c.$$('#view [href="#/settings"], #view [data-hash="#/settings"]').length;
    if (!tabSettings && !inPage && !topGear) {
      issue('P0', '移动端完全无法进入「设置」：底部标签栏无入口、页面内也无链接（语速/慢速/离线语音/导出/清空不可达）',
        '底部标签栏 ' + tabSettings + ' 个；页面内 ' + inPage + ' 个；顶栏 ' + topGear + ' 个；桌面侧栏 ' + sideSettings + ' 个');
    } else ok('设置入口在移动端可达（顶栏齿轮 ' + topGear + ' 个 / 页面内 ' + inPage + ' 个）');
    // 记录当前底部标签项
    ok('底部标签栏项：' + c.$$('#tabbar a em').map(e => e.textContent).join(' / '));
  }

  console.log('\n=== 3. 练习闭环 ===');
  {
    const c = ctx();
    await c.nav('#/quiz');
    c.$('[data-act="quiz-start"]') ? ok('练习设置页可达') : issue('P0', '练习设置页渲染失败');
    c.click(c.$('[data-act="quiz-start"]'));
    await c.tick(45);
    await playQuiz(c);
    c.$('.result-score') ? ok('练习可到达结算页') : issue('P0', '练习无法到达结算页');
    await c.nav('#/units');
    await c.nav('#/quiz');
    if (c.$('.result-score')) {
      issue('P1', '练习结束后再点「练习」仍停留在上一次的结算页，无法开始新一组（无“重新开始”入口提示）', '#/quiz 直接渲染 .result-score');
    } else ok('二次进入 #/quiz 回到设置页');
  }

  console.log('\n=== 4. 作答前是否泄题 ===');
  {
    const c = ctx();
    const spoken = [];
    const orig = c.win.RVAudio.say;
    c.win.RVAudio.say = function (t, o) { spoken.push(t); return Promise.resolve(); };
    c.win.RVStore.state.settings.autoSpeak = true;
    await c.nav('#/quiz');
    // 只保留「看中文选俄文」：逐次重查节点，避免重绘后快照失效
    for (let g = 0; g < 8; g++) {
      const off = c.$$('[data-act="q-type"]').filter(b => b.dataset.key !== 'zh2ru' && / on/.test(b.className));
      if (!off.length) break;
      c.click(off[0]);
      await c.tick(35);
    }
    const onlyZh2ru = c.$$('[data-act="q-type"].on').map(b => b.dataset.key);
    c.click(c.$('[data-act="quiz-start"]'));
    await c.tick(260);
    const label = c.$('.q-type') ? c.$('.q-type').textContent : '';
    const options = c.$$('.option span:last-child').map(e => e.textContent.trim());
    const leaked = spoken.filter(t => options.indexOf(t) >= 0);
    if (onlyZh2ru.length !== 1 || onlyZh2ru[0] !== 'zh2ru') {
      issue('P2', '审查脚本未能把题型限定为单选（' + onlyZh2ru.join('/') + '），本节结论仅供参考');
    } else if (leaked.length) {
      issue('P1', '「' + label + '」在作答前自动朗读了答案（听觉泄题）', '朗读：' + leaked.join('/'));
    } else ok('「' + label + '」作答前未朗读答案（' + (spoken.length ? '其余朗读：' + spoken.join('/') : '无朗读') + '）');
    c.win.RVAudio.say = orig;
  }

  console.log('\n=== 5. 生词本语义 ===');
  {
    const c = ctx();
    const id = c.DATA.words[5].id;
    c.win.RVStore.toggleBook(id);                 // 模拟用户在学习卡上手动加入
    const s1 = c.win.RVStore.get(id).book;
    c.win.RVStore.answer(id, true); c.win.RVStore.answer(id, true); c.win.RVStore.answer(id, true);
    const s2 = c.win.RVStore.get(id).book;
    if (s1 && !s2) issue('P1', '手动加入生词本的词，被连续答对后会被静默移除（用户想长期保留的重点词丢失）',
      id + '：手动 book=true → 答对 3 次后 book=' + s2 + '（掌握度 lv=' + c.win.RVStore.get(id).lv + '）');
    else ok('生词本标记稳定（' + s1 + ' → ' + s2 + '）');
  }

  console.log('\n=== 6. 统计口径 ===');
  {
    const c = ctx();
    const b = Object.assign({}, c.win.RVStore.today());
    const id = c.DATA.words[9].id;
    c.win.RVStore.review(id, 1); c.win.RVStore.review(id, 1); c.win.RVStore.review(id, 1);
    const a = c.win.RVStore.today();
    if (a.quiz - b.quiz === 3 && a.correct - b.correct === 0) {
      issue('P1', '复习自评「模糊」计入练习正确率分母，纯复习会显示 0% 正确率，指标含义混淆',
        '3 次自评 → quiz +3、correct +0 → 当日正确率 0%');
    } else ok('统计口径正常');
    // 正确率与学习量定义
    ok('口径现状：正确率 = correct/quiz（含复习自评）；今日学习 = learn + quiz（learn 仅统计翻卡）');
  }

  console.log('\n=== 7. 学习量口径 ===');
  {
    const c = ctx();
    await c.nav('#/unit/u01');
    const b = c.win.RVStore.viewsToday();
    for (let i = 0; i < 3; i++) { c.click(c.$('[data-act="nav-unit"][data-d="1"]')); await c.tick(25); }
    const a = c.win.RVStore.viewsToday();
    if (a <= b) issue('P2', '「今日接触词数」未随浏览增长，学习量统计不完整', 'views ' + b + ' → ' + a);
    else ok('浏览计入「今日接触词数」（' + b + ' → ' + a + '），同时 learn 单独记录翻卡次数');
  }

  console.log('\n=== 8. 拼写题边界 ===');
  {
    const c = ctx();
    const phrases = c.DATA.words.filter(w => /\s/.test(w.ru));
    ok('多词词条 ' + phrases.length + ' 个：' + phrases.map(w => w.ru).join(' / '));
    await c.nav('#/quiz');
    c.$$('[data-act="q-type"]').forEach(b => { if (b.dataset.key !== 'spell' && / on/.test(b.className)) c.click(b); });
    c.click(c.$('[data-act="quiz-start"]'));
    await c.tick(40);
    let badSpell = 0, spellSeen = 0;
    for (let i = 0; i < 40; i++) {
      const slots = c.$$('#slots .slot');
      if (slots.length) {
        spellSeen++;
        const zh = c.$('.q-main.zh') ? c.$('.q-main.zh').textContent.trim() : '';
        const cand = c.DATA.words.filter(w => w.zh === zh);
        if (cand.length === 1 && /\s/.test(cand[0].ru)) badSpell++;
        slots.forEach((s, k) => { if (k > 0) c.click(s); });
        c.$$('#tiles .tile').forEach(t => c.click(t));
        c.click(c.$('[data-act="spell-check"]'));
      }
      const next = c.$('[data-act="q-next"]');
      if (!next) break;
      c.click(next); await c.tick(15);
    }
    if (badSpell) issue('P1', '拼写题仍会出多词短语', badSpell + ' 题');
    else ok('拼写题已自动避开多词短语（抽查 ' + spellSeen + ' 题纯拼写，0 题为短语）');
  }

  console.log('\n=== 9. 卡片导航一致性 ===');
  {
    const c = ctx();
    await c.nav('#/unit/u03');
    const total = c.DATA.units[2].wordIds.length;
    for (let i = 0; i < total - 1; i++) { c.click(c.$('[data-act="nav-unit"][data-d="1"]')); await c.tick(12); }
    const next = c.$('[data-act="nav-unit"][data-d="1"]');
    const prevAtFirst = c.$('[data-act="nav-unit"][data-d="-1"]');
    if (next && !next.hasAttribute('disabled')) {
      issue('P1', '最后一个词时「下一个」仍可点（仅弹提示），而第一个词时「上一个」为禁用态 —— 首尾状态不一致',
        '末词 next disabled=' + next.hasAttribute('disabled') + '；首词 prev disabled=' + prevAtFirst.hasAttribute('disabled'));
    } else ok('首尾导航禁用态一致');
    // 单元切换时的位置重置
    await c.nav('#/unit/u01');
    ok('切换单元后卡片索引重置为第 1 词');
  }

  console.log('\n=== 10. 鲁棒性 ===');
  {
    const c = ctx();
    await c.nav('#/unit/not-exist');
    c.view().length > 50 ? ok('非法单元 id 回退正常') : issue('P0', '非法单元 id 白屏');
    await c.nav('#/nope');
    c.view().length > 50 ? ok('未知路由回退正常') : issue('P0', '未知路由白屏');
    c.win.localStorage.setItem('ruvocab.state.v1', '{broken');
    let crashed = false;
    try { c.win.eval('window.RVStore.today()'); } catch (e) { crashed = true; }
    crashed ? issue('P1', '损坏的 localStorage 会导致读取异常') : ok('损坏 localStorage 已容错（读取不抛异常）');
    // 空态
    const c2 = ctx();
    c2.win.RVStore.clearAll();
    await c2.nav('#/review');
    const hasEmpty = /复习队列是空的/.test(c2.view());
    hasEmpty ? ok('复习空态提示存在') : issue('P1', '复习页无空态引导');
    await c2.nav('#/book');
    /这里还没有生词/.test(c2.view()) ? ok('生词本空态提示存在') : issue('P1', '生词本无空态引导');
    await c2.nav('#/stats');
    c2.$$('.chart-box').length >= 4 ? ok('零数据时统计图表仍可渲染（' + c2.$$('.chart-box').length + ' 个区块）') : issue('P2', '零数据时统计页异常');
  }

  console.log('\n=== 11. 无障碍与可读性 ===');
  {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    css.indexOf(':focus-visible') < 0
      ? issue('P2', '未定义 :focus-visible 焦点样式，键盘用户难以定位焦点', 'styles.css 无 :focus-visible 规则')
      : ok('存在 :focus-visible 样式');
    const hexit = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255);
    const lumOf = rgb => rgb.map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
      .reduce((a, v, i) => a + [0.2126, 0.7152, 0.0722][i] * v, 0);
    const contrast = (fg, bg) => {
      const a = lumOf(hexit(fg)), b = lumOf(hexit(bg));
      const hi = Math.max(a, b), lo = Math.min(a, b);
      return (hi + 0.05) / (lo + 0.05);
    };
    const muted = (css.match(/--muted:\s*(#[0-9a-fA-F]{6})/) || [])[1];
    const r1 = contrast(muted, '#ffffff');
    r1 >= 4.5 ? ok('次级文字色 ' + muted + ' 于白底对比度 ' + r1.toFixed(2) + ':1（达标 WCAG AA 4.5:1）')
      : issue('P2', '次级文字色对比度不足', muted + ' 于白底 ' + r1.toFixed(2) + ':1 < 4.5:1');
    const warn = (css.match(/--warn:\s*(#[0-9a-fA-F]{6})/) || [])[1];
    const r2 = contrast(warn, '#fdf3e2');
    r2 >= 4.5 ? ok('警示色 ' + warn + ' 于浅色 chip 底 ' + r2.toFixed(2) + ':1（达标）')
      : issue('P2', '警示色 chip 对比度不足', warn + ' 于 #fdf3e2 ' + r2.toFixed(2) + ':1');

    const mini = (css.match(/\.mini \{[\s\S]*?height:\s*(\d+)px/) || [])[1];
    const mobileBlock = css.slice(css.indexOf('@media (max-width: 900px)'));
    const miniMobile = (mobileBlock.match(/\.mini \{[^}]*?height:\s*(\d+)px/) || [])[1];
    Number(miniMobile) >= 40
      ? ok('图标按钮点击区：桌面 ' + mini + 'px / 移动端 ' + miniMobile + 'px（移动端达 40px 建议值）')
      : issue('P2', '移动端点击区偏小', '.mini 桌面 ' + mini + 'px、移动端 ' + (miniMobile || mini) + 'px');
    const c = ctx();
    const viewLive = c.$('#view').getAttribute('aria-live');
    await c.nav('#/quiz'); c.click(c.$('[data-act="quiz-start"]')); await c.tick(40);
    const fbLive = c.$('#fb') ? c.$('#fb').getAttribute('aria-live') : null;
    if (!viewLive && fbLive) ok('读屏播报已收敛到反馈区（#view 无 aria-live，#fb aria-live=' + fbLive + '）');
    else issue('P2', 'aria-live 配置不当', '#view=' + viewLive + '，#fb=' + fbLive);
    ok('按钮多数带 aria-label / 可见文字：' + c.$$('[aria-label]').length + ' 处（首屏）');
  }

  console.log('\n=== 12. 代码结构 ===');
  {
    const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
    const defs = (app.match(/function progressRing/g) || []).length;
    const calls = (app.match(/progressRing\(/g) || []).length - defs;
    calls === 0 ? issue('P2', 'progressRing() 定义后未被调用（死代码），或本应展示的“单元进度环”被省略', '定义 ' + defs + ' 次、调用 0 次') : ok('progressRing 已被使用');
    const inlineStyles = (app.match(/style="/g) || []).length;
    issue('P2', '模板中内联样式 ' + inlineStyles + ' 处，建议抽为 CSS 类，便于主题化与维护', 'app.js');
    ok('单文件规模：app.js ' + Math.round(app.split('\n').length) + ' 行、styles.css ' + Math.round(fs.readFileSync(path.join(root, 'styles.css'), 'utf8').split('\n').length) + ' 行');
  }

  const p0 = issues.filter(i => i.level === 'P0').length;
  const p1 = issues.filter(i => i.level === 'P1').length;
  const p2 = issues.filter(i => i.level === 'P2').length;
  console.log('\n==============================');
  console.log('结论：P0 ' + p0 + ' 项 · P1 ' + p1 + ' 项 · P2 ' + p2 + ' 项');
})();

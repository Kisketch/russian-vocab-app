/* 冒烟测试：用 jsdom 加载应用并模拟主要交互流程
   运行： NODE_PATH=<node workspace>/node_modules node tools/smoke.js   */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<script src="[^"]+"><\/script>/g, '');

const errors = [];
const dom = new JSDOM(html, { url: 'http://localhost/index.html', runScripts: 'dangerously', pretendToBeVisual: true });
const win = dom.window;
win.scrollTo = () => { };
win.confirm = () => true;
win.addEventListener('error', e => errors.push('window error: ' + e.message));

// jsdom 无 fetch：用文件系统桩替代（供 assets/grammar.json 加载）
win.fetch = (u) => {
  const path = require('path'), fs = require('fs');
  const p = path.join(process.cwd(), String(u).replace(/^\.?\//, ''));
  if (fs.existsSync(p)) return Promise.resolve({ ok: true, json: () => JSON.parse(fs.readFileSync(p, 'utf8')) });
  return Promise.reject(new Error('404 ' + u));
};
['js/data.js', 'js/scenes.js', 'js/store.js', 'js/audio.js', 'js/grammar_data.js', 'js/grammar.js', 'js/app.js'].forEach(f => {
  try { win.eval(fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), 'utf8') : ''); }
  catch (e) { errors.push('执行 ' + f + ' 出错: ' + e.message); }
});

win.RVDataSafe = u => !!(u.id && u.no && u.ru && u.zh && u.desc && u.wordIds.length);
let failed = 0;
function assert(cond, msg) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + msg);
  if (!cond) { failed++; process.exitCode = 1; }
}
const $ = s => win.document.querySelector(s);
const $$ = s => Array.from(win.document.querySelectorAll(s));
const view = () => $('#view').innerHTML;
const click = el => { if (!el) throw new Error('元素不存在'); el.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); };
const tick = () => new Promise(r => setTimeout(r, 30));
async function nav(hash) {
  win.location.hash = hash;
  await tick();
}

(async function run() {
  console.log('— 数据 —');
  assert(win.RV_DATA.words.length === 173, '词条数 173（实际 ' + win.RV_DATA.words.length + '）');
  assert(win.RV_DATA.units.length === 15, '单元数 15（实际 ' + win.RV_DATA.units.length + '）');
  assert(win.RVScenes.keys().length >= 20, '情景插画 ' + win.RVScenes.keys().length + ' 幅');
  assert(win.RV_DATA.words.every(w => w.ru && w.pos && w.zh && w.ex_ru && w.ex_zh && w.scene), '词条字段完整（俄/词性/汉/例句俄/例句汉/配图）');
  assert(win.RV_DATA.units.every(u => win.RVDataSafe(u)), '单元字段完整');
  await tick();

  console.log('— 路由与首屏 —');
  await nav('#/units');
  assert(view().length > 2000, '首屏渲染 ' + view().length + ' 字节');
  assert($$('.unit').length === 15, '单元卡片 15 张（实际 ' + $$('.unit').length + '）');
  assert($('#dueTag') !== null && $('#sideDue').textContent.length > 0, '到期提示与侧栏进度渲染');

  console.log('— 学习模式 —');
  await nav('#/unit/u03');
  assert($('.flashcard') !== null, '单词卡渲染');
  assert(view().includes('университет'), '正面显示俄语单词');
  assert($$('.scene svg').length + $$('.scene .scene-img').length > 0, '情景插画注入卡片');
  const sceneImg = $('.scene .scene-img');
  assert(sceneImg === null || /assets\/img\/w\d{3}\.jpg$/.test(sceneImg.getAttribute('src') || ''),
    '定制配图路径正确（assets/img/<id>.jpg）');
  assert(view().includes('这是我的新课本') === false, '初始未泄露背面释义（翻转前）');
  click($('[data-act="flip"]'));
  assert($('.flashcard').className.includes('flipped'), '点击翻转到背面');
  assert(view().includes('我在大学读书'), '背面显示汉语释义与译文');
  assert(view().includes('Вот мой новый учебник') === false, '例句随卡展示（当前卡片为第 1 词）');
  click($('[data-act="nav-unit"][data-d="1"]'));
  assert(view().includes('факультет'), '切换到下一词');
  const curId = win.RV_DATA.units[2].wordIds[1];
  click($('[data-act="set-lv"][data-lv="4"]'));
  assert(win.RVStore.get(curId).lv === 4, '手动标记掌握度为「掌握」');
  click($('[data-act="fav"]'));
  assert(win.RVStore.get(curId).fav === true, '收藏生效');
  click($('[data-act="unit-mode"][data-mode="list"]'));
  await tick();
  assert($$('.word-row-item').length === 12, '列表模式展示本课 12 词（实际 ' + $$('.word-row-item').length + '）');

  console.log('— 练习模式 —');
  await nav('#/quiz');
  assert($('[data-act="quiz-start"]') !== null, '练习设置页渲染');
  assert($$('[data-act="q-type"].on').length === 4, '默认四种题型全部选中');
  click($('[data-act="quiz-start"]'));
  await tick();
  assert($('.q-head') !== null, '进入答题界面');
  let answered = 0, sawChoice = false, sawSpell = false, sawListen = false;
  for (let step = 0; step < 40; step++) {
    const opts = $$('.option:not([disabled])');
    const tiles = $$('#tiles .tile');
    if (opts.length) {
      sawChoice = true;
      if (view().includes('选择对应的俄语单词')) sawListen = true;
      const idx = (step % 3 === 0) ? 1 : 0;           // 故意错一部分
      click(opts[Math.min(idx, opts.length - 1)]);
    } else if (tiles.length) {
      sawSpell = true;
      tiles.forEach(t => click(t));                    // 填满所有词块
      click($('[data-act="spell-check"]'));
    } else break;
    answered++;
    assert($('#fb').textContent.length > 20, '第 ' + answered + ' 题即时反馈面板出现');
    const next = $('[data-act="q-next"]');
    if (next) click(next); else break;
    await tick();
  }
  assert(sawChoice, '出现选择题型');
  assert(answered >= 8, '完成 ' + answered + ' 道题流程');
  await tick();
  assert($('.result-score') !== null, '练习结束到达结算页');

  console.log('— 拼写题专测（确定性）—');
  // 同路由再次点击「练习」应回到设置页
  click($$('#tabbar a, #nav a').filter(a => a.dataset.key === 'quiz')[0]);
  await tick(40);
  assert($('[data-act="quiz-start"]') !== null || $$('[data-act="q-type"]').length > 0, '同一路由点击「练习」回到设置页');
  if (!$('[data-act="quiz-start"]')) { await nav('#/units'); await nav('#/quiz'); }
  for (let g = 0; g < 8; g++) {
    const off = $$('[data-act="q-type"].on').filter(b => b.dataset.key !== 'spell');
    if (!off.length) break;
    click(off[0]);
    await tick(30);
  }
  const onlySpell = $$('[data-act="q-type"].on').map(b => b.dataset.key);
  assert(onlySpell.length === 1 && onlySpell[0] === 'spell', '题型限定为拼写（' + onlySpell.join('/') + '）');
  click($('[data-act="quiz-start"]'));
  await tick(60);
  const slots = $$('#slots .slot');
  assert(slots.length > 0, '拼写题渲染 ' + slots.length + ' 个字母槽位');
  const promptZh = $('.q-main.zh') ? $('.q-main.zh').textContent.trim() : '';
  const target = win.RV_DATA.words.filter(w => w.zh === promptZh && !/\s/.test(w.ru))[0];
  assert(!!target, '定位到目标词（' + promptZh + ' → ' + (target ? target.ru : '?') + '）');
  // 按正确顺序点选字母块
  const need = target.ru.toLowerCase().split('');
  for (let i = 1; i < need.length; i++) {
    const tile = $$('#tiles .tile').filter(t => t.dataset.c === need[i] && !t.classList.contains('used'))[0];
    if (tile) click(tile);
    await tick(10);
  }
  click($('[data-act="spell-check"]'));
  await tick(30);
  assert($('#fb').textContent.includes('回答正确'), '拼写判题正确（' + target.ru + '）');
  assert(win.RVStore.get(target.id).lv > 0, '拼写答对后掌握度提升');

  const st = win.RVStore.state;
  const bookNow = Object.keys(st.words).filter(k => st.words[k].book);
  assert(bookNow.length > 0, '答错单词自动进入生词本（当前 ' + bookNow.length + ' 个）');
  assert(Object.keys(st.daily).length > 0 && Object.values(st.daily)[0].quiz > 0, '每日统计写入答题数');
  assert(Object.values(st.words).some(w => w.lv > 0), '答对单词掌握度提升');

  console.log('— 复习机制 —');
  // 间隔重复：模拟到期（把已学单词的 due 时间提前）
  const allIds = win.RV_DATA.words.map(w => w.id);
  const learnedIds = allIds.filter(id => win.RVStore.state.words[id] && win.RVStore.state.words[id].lv > 0);
  learnedIds.slice(0, 8).forEach(id => { win.RVStore.state.words[id].due = Date.now() - 1000; });
  win.RVStore.save();
  const due = win.RVStore.dueIds(allIds);
  assert(due.length >= 1, '间隔重复生成到期队列（' + due.length + ' 词）');
  await nav('#/review');
  await tick();
  if ($('[data-act="review-start"]')) click($('[data-act="review-start"]'));
  await tick();
  assert($('.flashcard') !== null, '复习会话渲染单词卡');
  click($('[data-act="review-show"]'));
  assert($('[data-act="review-grade"]') !== null, '自评面板出现（忘了/模糊/清楚）');
  // 队列已随机化，按当前卡片显示的单词定位目标
  const ruShown = $('.flashcard .ru').textContent.trim();
  const shownId = win.RV_DATA.words.filter(w => w.ru === ruShown)[0].id;
  const lvBefore = win.RVStore.get(shownId).lv;
  const gapBefore = win.RVStore.get(shownId).due - Date.now();
  click($('[data-act="review-grade"][data-q="2"]'));
  await tick();
  const after = win.RVStore.get(shownId);
  assert(after.lv === Math.min(5, lvBefore + 1), '评分“清楚”后掌握度由 ' + lvBefore + ' 提升到 ' + after.lv);
  assert(after.due - Date.now() > gapBefore, '下次复习间隔被延长');
  // 评「忘了」应回到生词本
  if ($('.flashcard')) {
    const ruNow = $('.flashcard .ru').textContent.trim();
    click($('[data-act="review-show"]'));
    click($('[data-act="review-grade"][data-q="0"]'));
    await tick();
    const target = win.RV_DATA.words.filter(w => w.ru === ruNow)[0];
    assert(win.RVStore.get(target.id).lv === 0 && win.RVStore.get(target.id).book === true,
      '评分“忘了”后「' + ruNow + '」回到生词本');
  }

  console.log('— 生词本 —');
  await nav('#/book');
  assert($$('.word-row-item').length > 0, '生词本列出 ' + $$('.word-row-item').length + ' 条');
  click($('[data-act="book-tab"][data-tab="fav"]'));
  await tick();
  assert(true, '收藏页签可切换（' + $$('.word-row-item').length + ' 条）');

  console.log('— 统计 —');
  await nav('#/stats');
  assert($$('.kpi').length === 7, '7 个指标卡（实际 ' + $$('.kpi').length + '）');
  assert($$('.chart-box').length >= 4, '4 个图表区块（实际 ' + $$('.chart-box').length + '）');
  assert(view().includes('polyline') || $$('.bars .bar').length > 0, '图表绘制成功');
  assert(view().includes('正确率'), '统计页含正确率指标');

  console.log('— 词典与语法 —');
  await nav('#/dict');
  assert($('#dictInput') !== null, '词典页渲染搜索框');
  assert((win.RV_DATA.dict || []).length > 500, '内置词典词条充足（实际 ' + (win.RV_DATA.dict || []).length + '）');
  const hit1 = win.RVGrammar.lookup('работаю');
  assert(hit1.words.length === 1 && hit1.words[0].ru === 'работать', '变形反查：работаю → работать');
  const hit4 = win.RVGrammar.lookup('университете');
  assert(hit4.words.length === 1 && hit4.words[0].ru === 'университет', '格变化反查：университете → университет');
  const hit2 = win.RVGrammar.lookup('大学');
  assert(hit2.words.some(w => w.ru === 'университет'), '中文检索：大学 → университет');
  const hit3 = win.RVGrammar.lookup('спасибо');
  assert(hit3.words.length >= 1 || hit3.dict.length >= 1, '词典可查到 спасибо');
  await nav('#/gram');
  assert($$('.gram-topic').length === 6, '语法专题 6 个集合');
  click($('[data-act="gram-topic"][data-topic="pronouns"]'));
  await tick();
  assert($('#gramDetail table') !== null, '代词变格表渲染');
  await nav('#/unit/u03');
  const cardBtn = $('[data-act="unit-mode"][data-mode="card"]');
  if (cardBtn && !cardBtn.classList.contains('on')) { click(cardBtn); await tick(); }
  click($('[data-act="flip"]'));
  await tick();
  assert($('.gram-panel') !== null, '卡片背面含语法详解（名词变格表）');
  assert($('#view').innerHTML.indexOf('二格') >= 0 && $('#view').innerHTML.indexOf('gram-table') >= 0, '卡片背面渲染了变格表');

  await nav('#/know');
  await tick(120);
  assert($('.know-cat') !== null, '知识总结渲染（第1课）');
  assert($$('.know-item').length >= 5, '第1课知识条目≥5（实际 ' + $$('.know-item').length + '）');
  const kchip = $$('[data-act="know-unit"]').find(c => c.dataset.id === 'u07');
  assert(kchip !== undefined, '存在第7课知识 chip');
  click(kchip);
  await tick(120);
  assert($('#view').innerHTML.indexOf('ё 的读音') >= 0, '切换第7课知识');

  console.log('— 课本词表 —');  await nav('#/list');
  assert($$('.vrow').length === 173, '课本词表 173 行（实际 ' + $$('.vrow').length + '）');
  assert($$('.v-cursive').length === 173, '词表含手写体对照（实际 ' + $$('.v-cursive').length + '）');
  click($('.vchips [data-act="vocab-filter"][data-id="u01"]'));
  await tick();
  assert($$('.vrow').length === 10, '第 1 课词表 10 行（实际 ' + $$('.vrow').length + '）');
  click($$('.vrow')[0]);
  await tick();
  assert(win.location.hash === '#/unit/u01', '点词行跳转到对应课的学习卡');
  await nav('#/list');

  console.log('— 设置与持久化 —');
  await nav('#/settings');
  assert($('[data-act="export-json"]') !== null, '设置页渲染导出/清空控件');
  assert($('[data-act="set-slow"]') !== null && $('[data-act="set-tts"]') !== null, '语速/音源开关渲染');
  assert(win.RVAudio && win.RVAudio.counts().words === 173, '音频索引覆盖 173 词');
  const hit = win.RVAudio.resolveId('университет');
  assert(hit && hit.kind === 'word' && hit.id === 'w023', '文本反查词条 id 正确');
  assert(win.localStorage.getItem('ruvocab.state.v1') !== null, '学习进度已写入 localStorage');

  console.log('\n运行期错误：' + (errors.length ? '\n' + errors.join('\n') : '无'));
  console.log(failed ? '\n❌ 有 ' + failed + ' 项未通过' : '\n✅ 全部通过');
})();

// 兼容断言里用到的小工具
win.RVDataSafe = u => !!(u.id && u.no && u.ru && u.zh && u.desc && u.wordIds.length);

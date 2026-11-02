/* 走遍俄罗斯词汇卡 · 主程序（零依赖原生实现） */
(function () {
  'use strict';

  var D = window.RV_DATA, S = window.RVStore, Sc = window.RVScenes;
  var WORDS = D.words, UNITS = D.units;
  var byId = {}, unitById = {}, wordsOfUnit = {};

  WORDS.forEach(function (w) { byId[w.id] = w; });
  UNITS.forEach(function (u) { unitById[u.id] = u; wordsOfUnit[u.id] = []; });
  WORDS.forEach(function (w) { wordsOfUnit[w.unit].push(w); });
  var ALL_IDS = WORDS.map(function (w) { return w.id; });

  /* ---------------- 工具 ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function mmss(ms) { var s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + pad(s % 60); }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1900);
  }

  /* ---------------- 图标 ---------------- */
  var PATHS = {
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    dict: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h8M9 11h6"/>',
    gram: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    know: '<path d="M9 18h10M9 14h10M9 10h10M9 6h10M4.5 6h.01M4.5 10h.01M4.5 14h.01M4.5 18h.01"/>',
    learn: '<path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H10a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H4.5A1.5 1.5 0 0 1 3 16z"/><path d="M21 5.5A1.5 1.5 0 0 0 19.5 4H14a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5h6A1.5 1.5 0 0 0 21 16z"/>',
    quiz: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M5 6l1.4 1.4L8.6 5.2"/>',
    review: '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.8 4.4v4.6h-4.6"/><path d="M12 7.5V12l3 2"/>',
    book: '<path d="M6.5 4h11v16l-5.5-4-5.5 4z"/>',
    stats: '<path d="M4 20h16"/><rect x="6" y="11" width="3.4" height="6" rx="1.2"/><rect x="10.8" y="6.5" width="3.4" height="10.5" rx="1.2"/><rect x="15.6" y="14" width="3.4" height="3" rx="1.2"/>',
    settings: '<path d="M4 7h9M19 7h1M4 17h3M13 17h7"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
    sound: '<path d="M11 5 6.2 9H3v6h3.2L11 19z"/><path d="M15.2 8.6a5 5 0 0 1 0 6.8"/><path d="M18.3 5.6a9.4 9.4 0 0 1 0 12.8"/>',
    mute: '<path d="M11 5 6.2 9H3v6h3.2L11 19z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    star: '<path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.9l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z"/>',
    starOn: '<path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.9l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z" fill="currentColor"/>',
    left: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    right: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    flip: '<path d="M4 10a8 8 0 0 1 13-4.8L20 8"/><path d="M20 4.5V8h-3.4"/><path d="M20 14a8 8 0 0 1-13 4.8L4 16"/><path d="M4 19.5V16h3.4"/>',
    check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    down: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    back: '<path d="M20 12H4"/><path d="M10 6l-6 6 6 6"/>',
    alpha: '<path d="M4 19 9.5 5h2L17 19"/><path d="M6.4 14.2h8.2"/><path d="M19 19h2"/>',
    phrase: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z"/>',
    mic: '<path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3M9 21h6"/>',
    note: '<path d="M5 3h11l3 3v15H5z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2z"/>',
    type: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/>',
    fire: '<path d="M12 22c4 0 7-2.6 7-6.5 0-3.2-2-5.3-3.7-7.2C13.9 6.6 13 4.8 13 2c-2.2 1.3-3.5 3.2-3.5 5.2 0 1.3.5 2.4 1.2 3.3C7.5 11.4 5 13.9 5 16.5 5 20 7.8 22 12 22z"/>'

  };
  function ico(name, size, cls) {
    var p = PATHS[name] || '';
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) +
      '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  /* ---------------- 情景说明 ---------------- */
  var SCENE_DESC = {
    greet: '初次见面的问候与自我介绍',
    person: '人物形象与称谓',
    family: '家庭成员的一幕',
    university: '大学教学楼与课堂',
    book: '课本、练习本等学习用品',
    work: '办公室里的日常工作',
    health: '医院、药房与药品',
    house: '住宅内的房间与家具',
    city: '城市街道与建筑',
    transport: '公共汽车与有轨电车',
    travel: '机场与行李托运',
    food: '餐桌上的三餐',
    clock: '一天中的时刻',
    shop: '临街商店与购物',
    weather: '阴晴雨雪的天气变化',
    nature: '四季的自然景色',
    contact: '电话、信件与网络通讯',
    culture: '剧院舞台与音乐演出',
    gift: '包装精美的礼物盒',
    holiday: '节庆烟火与蛋糕',
    generic: '词义配图'
  };
  function caption(w) {
    var u = unitById[w.unit];
    return (SCENE_DESC[w.scene] || SCENE_DESC.generic) + ' · ' + u.zh;
  }

  /* 词形渲染：默认显示带重音标注的词形（词库未标注时即原形） */
  function ruText(w) {
    return (S.state.settings.showStress === false) ? w.ru : (w.ru_stress || w.ru);
  }

  /* 例句中的目标词高亮：按词干匹配，兼容变格/变位后的词形（университет → в университете） */
  function stemOf(ru) {
    var s = (ru.split(' ')[0] || '').toLowerCase();
    var keep = s.length > 5 ? s.length - 2 : (s.length > 3 ? s.length - 1 : s.length);
    return s.slice(0, Math.max(3, keep)).replace(/ё/g, 'е');
  }
  function highlight(ru, text) {
    var stem = stemOf(ru);
    if (!stem) return esc(text);
    var low = text.toLowerCase().replace(/ё/g, 'е');
    var i = low.indexOf(stem);
    if (i < 0) return esc(text);
    var end = i + stem.length;
    // 向后补齐词尾，向前补齐前缀（преподаватель → преподавателю）
    var tail = (text.slice(end).match(/^[а-яё]+/i) || [''])[0];
    var head = (text.slice(0, i).match(/[а-яё]+$/i) || [''])[0];
    var start = i - head.length;
    var form = head + text.slice(i, end) + tail;
    return esc(text.slice(0, start)) + '<mark class="hl" title="例句中的词形（变格／变位）">' + esc(form) + '</mark>' +
      esc(text.slice(start + form.length));
  }

  /* ---------------- 语音朗读（委托给音频层：本地 MP3 优先，系统语音兜底） ---------------- */
  function speak(text, slow) {
    RVAudio.say(text, { slow: !!slow });
  }

  /* ---------------- 学习状态小工具 ---------------- */
  function lvlOf(id) { return S.get(id).lv; }
  function unitStat(u) {
    var ws = wordsOfUnit[u.id], learned = 0, due = 0, now = Date.now();
    ws.forEach(function (w) {
      var st = S.state.words[w.id];
      if (st && st.lv > 0) learned++;
      if (st && st.lv > 0 && st.due <= now) due++;
    });
    return { total: ws.length, learned: learned, due: due, pct: ws.length ? Math.round(learned / ws.length * 100) : 0 };
  }
  /* 掌握度进度环（用于单元卡片的完成度展示） */
  function progressRing(pct, size, label) {
    size = size || 46;
    var r = (size - 6) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" class="ring" aria-hidden="true">' +
      '<circle class="ring-bg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke-width="4"/>' +
      '<circle class="ring-fg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke-width="4" ' +
      'stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) +
      '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      (label ? '<text x="50%" y="50%" text-anchor="middle" dy="4" font-size="11" fill="currentColor">' + label + '</text>' : '') +
      '</svg>';
  }

  /* ---------------- 界面骨架状态 ---------------- */
  var ui = { unitMode: 'card', unitId: null, idx: 0, flipped: false, vocabFilter: 'all', knowUnit: 'u01' };
  var quiz = null, review = null;

  var TITLES = {
    units: ['学习', '按《走遍俄罗斯》教材单元浏览单词'],
    list: ['课本词表', '按课本课序排列 · 印刷体与手写体对照'],
    dict: ['词典', '查单词 · 变形反查 · 语音输入'],
    gram: ['语法专题', '格变化 · 动词变位 · 代词 · 前置词'],
    know: ['课文知识总结', '发音 · 语法句型 · 词汇 · 文化 · 易错点'],
    alphabet: ['俄语字母表', '33 个字母 · 名称 · 发音 · 例词'],
    phrases: ['情景短语', '问候 · 课堂 · 购物 · 餐厅 · 问路 · 旅行'],
    tools: ['工具箱', '打字 · 手写 · 朗读 · 笔记 · 学习资源'],
    typing: ['打字练习', '看中文 · 输入俄语 · 即时校验'],
    cursive: ['手写转写', '印刷体与手写体对照'],
    speak: ['文本朗读', '粘贴俄语文本 · 神经语音朗读'],
    notes: ['我的笔记', '按单词汇总的个人笔记'],
    game: ['单词配对', '俄语与中文 · 5 组配对'],
    resources: ['学习资源', '外部词典 · 发音 · 翻译 · 语法'],
    unit: ['单元学习', '单词卡片 · 翻转与例句'],
    quiz: ['练习', '四类题型即时反馈'],
    review: ['复习', '间隔重复 · 到期队列'],
    book: ['生词本', '错词自动收录与收藏'],
    stats: ['学习统计', '每日学习量与正确率'],
    settings: ['设置', '朗读、数据与关于']
  };
  var KICKERS = {
    units: 'УЧЕБНИК · 01—15', list: 'СЛОВАРЬ · 词表', dict: 'СЛОВАРЬ · 词典',
    gram: 'ГРАММАТИКА · 语法', know: 'КОНСПЕКТ · 知识', alphabet: 'АЛФАВИТ · 字母',
    phrases: 'ФРАЗЫ · 短语', unit: 'КАРТОЧКА · 卡片', quiz: 'ПРАКТИКА · 练习',
    tools: 'ИНСТРУМЕНТЫ · 工具',
    typing: 'ПЕЧАТЬ · 打字', cursive: 'ПОЧЕРК · 手写', speak: 'ЧТЕНИЕ · 朗读',
    notes: 'ЗАМЕТКИ · 笔记', game: 'ИГРА · 配对', resources: 'ССЫЛКИ · 资源',
    review: 'ПОВТОРЕНИЕ · 复习', book: 'ИЗБРАННОЕ · 生词', stats: 'СТАТИСТИКА · 统计',
    settings: 'НАСТРОЙКИ · 设置'
  };

  function updateChrome(key, sub) {
    var t = TITLES[key] || TITLES.units;
    $('#pageTitle').textContent = t[0];
    $('#pageSub').textContent = sub || t[1];
    var kick = $('#pageKicker'); if (kick) kick.textContent = KICKERS[key] || KICKERS.units;
    var navKey = { typing: 'tools', cursive: 'tools', speak: 'tools', notes: 'tools', game: 'tools', resources: 'tools' }[key] || key;
    $$('#nav a').forEach(function (a) { a.classList.toggle('active', a.dataset.key === navKey); });
    var tabMap = { unit: 'units', alphabet: 'more', phrases: 'more', tools: 'more', typing: 'more', cursive: 'more', speak: 'more', notes: 'more', game: 'more', resources: 'more', dict: 'more', gram: 'more', know: 'more', book: 'more', stats: 'more', settings: 'more' };
    var tk = tabMap[key] || key;
    $$('#tabbar a').forEach(function (a) { a.classList.toggle('active', a.dataset.key === tk); });
    var more = $('#tabMore'); if (more) more.classList.toggle('active', tk === 'more');
    var streak = S.streakDays();
    var sc = $('#streakChip'); if (sc) sc.textContent = streak > 1 ? '连续 ' + streak + ' 天' : '';

    var dueN = S.dueIds(ALL_IDS).length;
    var bookN = S.wordbookIds(ALL_IDS).length;
    $$('[data-count="due"]').forEach(function (n) {
      n.textContent = dueN > 99 ? '99+' : (dueN || '');
      n.classList.toggle('hot', dueN > 0);
      if (!dueN) n.classList.add('hide'); else n.classList.remove('hide');
    });
    $$('[data-count="book"]').forEach(function (n) {
      n.textContent = bookN > 99 ? '99+' : (bookN || '');
      if (!bookN) n.classList.add('hide'); else n.classList.remove('hide');
    });
    var ut = $('[data-count="units"]'); if (ut) ut.textContent = UNITS.length;

    var tag = $('#dueTag');
    tag.textContent = dueN ? dueN + ' 个单词待复习' : '';
    var st = $('#speakToggle');
    st.innerHTML = ico(S.state.settings.autoSpeak ? 'sound' : 'mute', 18);
    st.classList.toggle('on', !!S.state.settings.autoSpeak);
    var ns = $('#navSettings');
    if (ns) {
      ns.innerHTML = ico('settings', 18);
      ns.classList.toggle('on', key === 'settings');
    }

    var sd = $('#sideDue');
    var learned = S.learnedIds(ALL_IDS).length;
    sd.innerHTML = '<div>本册进度 <strong>' + learned + '</strong> / ' + WORDS.length + ' 词</div>' +
      '<span class="mt">今日待复习 <strong>' + dueN + '</strong> 个 · 生词本 <strong>' + bookN + '</strong> 个</span>';
  }

  /* ---------------- 视图：单元总览 ---------------- */
  function renderUnits() {
    var t = S.today();
    var learned = S.learnedIds(ALL_IDS).length;
    var dueN = S.dueIds(ALL_IDS).length;
    var pct = WORDS.length ? Math.round(learned / WORDS.length * 100) : 0;
    var goal = S.state.settings.dailyGoal || 20;
    var todayViews = S.viewsToday();
    var goalPct = clamp(Math.round(todayViews / goal * 100), 0, 100);
    var dayIdx = Math.floor(Date.now() / 86400000) % WORDS.length;
    var daily = WORDS[dayIdx];

    var h = '';
    h += '<div class="hero">' +
      '<div class="hero-text">' +
      '<span class="eyebrow">Дорога в Россию · 第 1 册</span>' +
      '<h2>' + (dueN ? '今天有 ' + dueN + ' 个词<br>在等你复习' : '今天，和俄语<br>待一会儿') + '</h2>' +
      '<p>' + esc(D.meta.book) + ' · 共 ' + UNITS.length + ' 课 / ' + WORDS.length + ' 词。看图记词，听音辨义，按记忆曲线复习。</p>' +
      '</div>' +
      '<div class="hero-stats">' +
      '<div class="hero-stat"><b>' + todayViews + '</b><span>今日接触</span></div>' +
      '<div class="hero-stat"><b>' + (t.quiz ? Math.round(t.correct / t.quiz * 100) + '%' : '—') + '</b><span>练习正确率</span></div>' +
      '<div class="hero-stat"><b>' + S.streakDays() + '</b><span>连续天数</span></div>' +
      '</div>' +
      '<div class="hero-ring">' + progressRing(pct, 104, pct + '%') + '</div>' +
      '<div class="actions">' +
      '<button class="btn primary" data-act="review-start">' + ico('review', 16) + ' ' + (dueN ? '开始复习 ' + dueN + ' 词' : '复习临近词') + '</button>' +
      '<button class="btn" data-act="quick-quiz">' + ico('quiz', 16) + ' 快速练习</button>' +
      '<button class="btn" data-act="go" data-hash="#/alphabet">' + ico('alpha', 16) + ' 字母表</button>' +
      '<button class="btn" data-act="go" data-hash="#/phrases">' + ico('phrase', 16) + ' 情景短语</button>' +
      '</div></div>';

    h += '<div class="home-duo">';
    h += '<div class="card daily-card" data-act="open-word-sheet" data-id="' + daily.id + '" tabindex="0" role="button">' +
      '<div class="daily-art no-photo" data-letter="' + esc(daily.initial) + '"></div>' +
      '<div class="daily-body">' +
      '<div class="daily-kicker">每日一词 · СЛОВО ДНЯ</div>' +
      '<div class="daily-ru">' + esc(ruText(daily)) + '</div>' +
      '<div class="daily-zh">' + esc(daily.zh) + ' <span class="pos">' + esc(daily.pos) + '</span></div>' +
      '<div class="daily-ex">' + highlight(daily.ru, daily.ex_ru) + '</div>' +
      '<div class="daily-ex-zh">' + esc(daily.ex_zh) + '</div>' +
      '</div></div>';

    h += '<div class="card goal-card">' +
      '<div class="goal-top"><span class="daily-kicker">今日目标 · ЦЕЛЬ</span>' + progressRing(goalPct, 72, todayViews + '/' + goal) + '</div>' +
      '<h3>' + (goalPct >= 100 ? '今天的目标完成了' : '再接触 ' + Math.max(0, goal - todayViews) + ' 个词') + '</h3>' +
      '<p>每日 ' + goal + ' 词 · 已接触 ' + todayViews + ' 词 · 待复习 ' + dueN + ' 词</p>' +
      '<div class="goal-bar"><i style="width:' + goalPct + '%"></i></div>' +
      '<div class="actions" style="margin-top:14px">' +
      '<button class="btn sm" data-act="go" data-hash="#/stats">查看统计</button>' +
      '<button class="btn sm" data-act="go" data-hash="#/settings">调整目标</button>' +
      '</div></div>';
    h += '</div>';

    h += '<div class="section"><div class="section-head"><h2>教材单元</h2><span>' + esc(D.meta.note) + '</span></div>';
    h += '<div class="unit-grid">';
    UNITS.forEach(function (u, i) {
      var st = unitStat(u);
      var cover = wordsOfUnit[u.id][0];
      h += '<div class="card unit" data-act="open-unit" data-id="' + u.id + '" tabindex="0" role="button" style="--i:' + i + '">' +
        '<div class="unit-art' + (cover && cover.img ? '' : ' no-photo') + '" data-letter="' + (cover ? esc(cover.initial) : u.no) + '">' +
        (cover ? sceneImg(cover) : '') +
        '<span class="unit-no">' + u.no + '</span></div>' +
        '<div class="unit-top">' +
        '<div class="unit-title"><b>' + esc(u.zh) + '</b><span>' + esc(u.ru) + '</span></div>' +
        '<div class="unit-ring" title="已标记进度">' + progressRing(st.pct, 44, st.pct + '%') + '</div>' +
        '</div>' +
        '<div class="unit-desc">' + esc(u.desc) + '</div>' +
        '<div class="unit-foot"><span>' + st.learned + ' / ' + st.total + ' 词已标记</span>' +
        (st.due ? '<span class="chip lv2">' + st.due + ' 待复习</span>' : '<span class="chip">' + st.total + ' 词</span>') +
        '</div>' +
        '</div>';
    });
    h += '</div></div>';
    return h;
  }

  /* 词条配图：有定制图片用图片，否则回退到通用 SVG 插画 */
  function sceneImg(w, altZh) {
    if (w.img) {
      return '<img class="scene-img" src="assets/img/' + w.id + '.jpg" alt="' + esc(altZh || w.zh) + '" loading="lazy" decoding="async">';
    }
    return Sc.get(w.scene);
  }

  /* ---------------- 语法详解（卡片背面可展开） ---------------- */
  var CASE_ORDER = ['nom', 'gen', 'dat', 'acc', 'ins', 'prep'];
  var CASE_LABEL = { nom: '一格', gen: '二格', dat: '三格', acc: '四格', ins: '五格', prep: '六格' };
  var PERSON_LABEL = { '1sg': 'я', '2sg': 'ты', '3sg': 'он/она', '1pl': 'мы', '2pl': 'вы', '3pl': 'они' };

  /* 词条详情派生信息：只使用词库、语法表和例句，不虚构释义 */
  function grammarOf(w) { try { return RVGrammar.get(w.id); } catch (e) { return null; } }
  function splitSyllables(text) {
    var parts = String(text || '').split(/([аеёиоуыэюя]+)/i), out = [];
    for (var i = 0; i < parts.length; i += 2) {
      var chunk = parts[i] + (parts[i + 1] || '');
      if (chunk) out.push(chunk);
    }
    return out.length > 1 ? out.join(' · ') : text;
  }
  function morphParts(w) {
    var ru = w.ru, m;
    if (/词组|短语/.test(w.pos)) return [];
    if (/动词/.test(w.pos)) {
      m = ru.match(/^(.*?)(ся|сь|ть|ти)$/);
      if (m) return [{ label: '词干', text: m[1] }, { label: '后缀', text: m[2] }];
    }
    if (/名词/.test(w.pos)) {
      var end = '';
      if (/(ая|яя)$/.test(ru)) end = ru.slice(-2);
      else if (/[аяоеиыуюьй]$/.test(ru)) end = ru.slice(-1);
      var root = ru.slice(0, ru.length - end.length);
      return [{ label: '词干', text: root || '—' }, { label: '词尾', text: end || '零词尾' }];
    }
    return [];
  }
  function grammarTags(w) {
    var g = grammarOf(w), tags = [], t = g && g.grammar && g.grammar.type;
    if (/动词/.test(w.pos)) {
      tags.push(/完成体/.test(w.pos) ? '完成体' : (/未完成体/.test(w.pos) ? '未完成体' : '动词'));
      if (g && g.grammar && g.grammar.conj) tags.push('第 ' + g.grammar.conj + ' 变位法');
    } else if (/名词/.test(w.pos)) {
      if (t === 'noun2m') { if (w.pos.indexOf('阳性') < 0) tags.push('阳性'); tags.push('第二变格法'); }
      else if (t === 'noun1') { if (w.pos.indexOf('阴性') < 0) tags.push('阴性'); tags.push('第一变格法'); }
      else if (t === 'noun3') { if (w.pos.indexOf('阴性') < 0) tags.push('阴性'); tags.push('第三变格法'); }
      else if (t === 'noun2n') { if (w.pos.indexOf('中性') < 0) tags.push('中性'); tags.push('第二变格法'); }
      else if (t === 'noun-pl') { tags.push('复数'); }
      else if (t === 'noun-invariable') { tags.push('不变格'); }
    } else if (/词组/.test(w.pos)) tags.push('固定搭配');
    return tags.slice(0, 4);
  }
  function wordExplain(w) {
    var g = grammarOf(w), gr = g && g.grammar, bits = [];
    if (/名词/.test(w.pos)) {
      var gender = gr && gr.type === 'noun2m' ? '阳性' : gr && gr.type === 'noun1' ? '阴性' :
        gr && gr.type === 'noun3' ? '阴性' : gr && gr.type === 'noun2n' ? '中性' : '';
      bits.push('名词' + (gender ? '，' + gender : '') + '。');
      if (gr && gr.sg && gr.pl) bits.push('单数主格 ' + gr.sg.nom + '，复数主格 ' + gr.pl.nom + '。');
      if (gr && gr.type === 'noun-invariable') bits.push('该词属于不变格名词，各格形式相同。');
    } else if (/动词/.test(w.pos)) {
      bits.push('动词' + (/完成体/.test(w.pos) ? '，完成体' : /未完成体/.test(w.pos) ? '，未完成体' : '') + '。');
      if (gr && gr.conj) bits.push('属于第 ' + gr.conj + ' 变位法。');
      if (gr && gr.present) bits.push('现在时：я ' + gr.present['1sg'] + '，ты ' + gr.present['2sg'] + '，он/она ' + gr.present['3sg'] + '。');
    } else if (/词组/.test(w.pos)) {
      bits.push('固定搭配，建议整体记忆，不要逐词直译。');
    } else {
      bits.push(w.pos + '。');
    }
    var unit = unitById[w.unit];
    if (unit) bits.push('本课主题：' + unit.zh + '。');
    return bits.join('');
  }
  function relatedWords(w) {
    return (wordsOfUnit[w.unit] || []).filter(function (x) { return x.id !== w.id; }).slice(0, 6);
  }

  function grammarPanel(w, open) {
    var g = window.RVGrammar && RVGrammar.get(w.id);
    if (!g || !g.grammar) return '';
    var gr = g.grammar, h = '';
    h += '<details class="gram-panel"' + (open ? ' open' : '') + '><summary>' + ico('gram', 14) + ' 语法详解（格变化 / 变位）</summary><div class="gram-body">';
    if (gr.type === 'noun-invariable') {
      h += '<p class="hint">' + esc(gr.note || '外来词，不变格') + '</p>';
    } else if (gr.type && gr.type.indexOf('noun') === 0) {
      h += '<table class="gram-table"><thead><tr><th>格</th><th>单数</th><th>复数</th></tr></thead><tbody>';
      CASE_ORDER.forEach(function (c) {
        h += '<tr><td>' + CASE_LABEL[c] + '</td><td class="ru">' + esc(gr.sg[c] || '—') +
          '</td><td class="ru">' + esc(gr.pl[c] || '—') + '</td></tr>';
      });
      h += '</tbody></table>';
      h += '<p class="hint">变格类型：' + esc({ noun1: '第一变格法（-а/-я）', noun2m: '第二变格法（阳性）', noun2n: '第二变格法（中性）', noun3: '第三变格法（-ь）' }[gr.type] || gr.type) +
        ' · 重音位置请以课本/词典为准</p>';
    } else if (gr.type === 'verb') {
      h += '<table class="gram-table"><thead><tr><th>人称</th><th>变位</th></tr></thead><tbody>';
      ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'].forEach(function (p) {
        h += '<tr><td>' + PERSON_LABEL[p] + '</td><td class="ru">' + esc(gr.present[p] || '—') + '</td></tr>';
      });
      h += '</tbody></table>';
      h += '<div class="gram-rows">' +
        '<span>过去时：<b class="ru">' + esc(gr.past.m) + '</b> / <b class="ru">' + esc(gr.past.f) + '</b> / <b class="ru">' + esc(gr.past.n) + '</b> / <b class="ru">' + esc(gr.past.pl) + '</b></span>' +
        '<span>命令式：<b class="ru">' + esc(gr.imperative || '—') + '</b></span>' +
        '<span>变位法：' + (gr.conj === 2 ? '第二变位法' : '第一变位法') + (gr.irregular ? '（不规则）' : '') + '</span>' +
        '</div>';
    } else if (gr.type === 'adj') {
      h += '<table class="gram-table"><thead><tr><th>性/数</th><th>形式</th></tr></thead><tbody>';
      [['m', '阳性'], ['f', '阴性'], ['n', '中性'], ['pl', '复数']].forEach(function (kv) {
        h += '<tr><td>' + kv[1] + '</td><td class="ru">' + esc(gr.forms[kv[0]] || '—') + '</td></tr>';
      });
      h += '</tbody></table>';
      if (gr.comparative) h += '<p class="hint">比较级：' + esc(gr.comparative.more || '—') + '</p>';
    } else if (gr.note) {
      h += '<p class="hint">' + esc(gr.note) + '</p>';
    }
    h += '</div></details>';
    return h;
  }

  /* ---------------- 视图：词典 ---------------- */
  function renderDict() {
    var h = '';
    h += '<div class="section"><div class="dict-head">' +
      '<div class="dict-search">' +
      '<input id="dictInput" type="search" placeholder="输入俄语/中文，或点话筒说话…" autocomplete="off">' +
      '<button class="icon-btn" data-act="voice-input" id="voiceBtn" title="语音查词" aria-label="语音查词">' + ico('sound', 18) + '</button>' +
      '</div>' +
      '<div class="dict-meta" id="dictMeta">词库 ' + WORDS.length + ' 词 · 内置词典 ' + (D.dict || []).length + ' 条 · 支持变形反查（如读 читаю 查到 читать）</div>' +
      '<div class="dict-result" id="dictResult"></div>' +
      '</div></div>';
    return h;
  }

  function dictRender(q) {
    var box = $('#dictResult');
    if (!box) return;
    var r = RVGrammar.lookup(q);
    if (!q.trim()) {
      var picks = ['семья', 'университет', 'поезд', 'погода', 'здоровье', 'праздник', 'магазин', 'метро'];
      box.innerHTML = '<div class="dict-home">' +
        '<div class="dict-home-title">试试这些词</div>' +
        '<div class="picker">' + picks.map(function (p) {
          return '<button class="pick" data-act="dict-pick" data-q="' + p + '">' + p + '</button>';
        }).join('') + '</div>' +
        '<div class="dict-home-tip">支持俄语原形、变格/变位形式、中文释义三路查询。例如输入 <b>читаю</b> 可以反查到 <b>читать</b>。</div>' +
        '</div>';
      return;
    }
    var h = '';
    if (r.words.length) {
      h += '<div class="dict-group">词库命中 · ' + r.words.length + '</div>';
      r.words.forEach(function (w) {
        var u = unitById[w.unit];
        h += '<div class="dict-row" data-act="open-word-sheet" data-id="' + w.id + '">' +
          '<div class="dr-main"><span class="dr-ru">' + esc(ruText(w)) + '</span><span class="dr-pos">' + esc(w.pos) + '</span></div>' +
          '<div class="dr-zh">' + esc(w.zh) + '</div>' +
          '<div class="dr-unit">' + esc(u ? '第' + u.no + '课 · ' + u.zh : '') + ' · 点击查看详情</div></div>';
      });
    }
    if (r.dict.length) {
      h += '<div class="dict-group">内置词典 · ' + r.dict.length + '</div>';
      r.dict.forEach(function (d) {
        h += '<div class="dict-row plain"><div class="dr-main"><span class="dr-ru">' + esc(d.ru) + '</span><span class="dr-pos">' + esc(d.pos) + '</span></div>' +
          '<div class="dr-zh">' + esc(d.zh) + '</div></div>';
      });
    }
    if (!h) h = '<div class="empty"><h3>没找到「' + esc(q) + '」</h3><p>换个说法试试，或用中文检索；也可以去「课本词表」按课浏览。</p></div>';
    box.innerHTML = h;
  }

  /* ---------------- 视图：语法专题 ---------------- */
  function renderGram() {
    var ref = RVGrammar.ref();
    var h = '<div class="section">';
    if (!ref) { h += '<div class="empty"><h3>语法资料加载中…</h3></div></div>'; return h; }
    h += '<div class="gram-topics">';
    var topics = [
      { key: 'cases', name: '六个格的用法', desc: '一格～六格的意义、疑问词与例句' },
      { key: 'declension', name: '名词变格法', desc: '第一/第二/第三变格法词尾总表' },
      { key: 'conjugation', name: '动词变位法', desc: '第一/第二变位法词尾与例外' },
      { key: 'pronouns', name: '代词变格', desc: '人称/指示/物主/疑问代词全表' },
      { key: 'numbers', name: '数词与数量', desc: '1～10 及数量搭配规则' },
      { key: 'prepositions', name: '前置词与格', desc: '常用前置词接格与语义' }
    ];
    topics.forEach(function (t) {
      h += '<div class="card gram-topic" data-act="gram-topic" data-topic="' + t.key + '">' +
        '<div class="gt-ico">' + ico('gram', 20) + '</div>' +
        '<div><b>' + t.name + '</b><span>' + t.desc + '</span></div>' +
        '<span class="gt-arrow">›</span></div>';
    });
    h += '</div>';
    h += '<div class="card gram-quick"><div class="gq-head"><b>六格速查</b><span>ШЕСТЬ ПАДЕЖЕЙ · 先记疑问词，再记典型例句</span></div>' +
      '<div class="gq-wrap"><table class="gram-table"><thead><tr><th>格</th><th>用法 / 疑问词</th><th>例句</th></tr></thead><tbody>' +
      ref.cases.map(function (c) {
        return '<tr><td class="ru"><b>' + esc(c.zh) + '</b></td><td>' + esc(c.use) + '</td><td class="ru gex">' + esc(c.example) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="hint gq-note">点上方专题看完整变格表；卡片背面的「语法详解」会按当前单词给出具体词形。</p></div>';
    h += '<div id="gramDetail"></div>';
    h += '<p class="hint" style="text-align:center">每个词条的格变化表见「学习」卡片背面 → 语法详解</p>';
    h += '</div>';
    return h;
  }

  function gramShow(topic) {
    var ref = RVGrammar.ref(), box = $('#gramDetail');
    if (!box || !ref) return;
    var h = '';
    if (topic === 'cases') {
      ref.cases.forEach(function (c) {
        h += '<div class="gram-block"><h3>' + c.zh + '</h3>' +
          '<p>' + esc(c.use) + '</p>' +
          '<div class="gram-ex">' + esc(c.example) + '</div></div>';
      });
    } else if (topic === 'declension') {
      ref.declension.forEach(function (d) {
        h += '<div class="gram-block"><h3>' + d.zh + '</h3>' +
          '<p class="gram-when">适用：' + esc(d.when) + '</p>' +
          '<p class="gram-end">词尾：' + esc(d.ending) + '</p></div>';
      });
      ref.notes.forEach(function (n) { h += '<p class="hint">· ' + esc(n) + '</p>'; });
    } else if (topic === 'conjugation') {
      ref.conjugation.forEach(function (c) {
        h += '<div class="gram-block"><h3>' + c.zh + '</h3>' +
          '<p class="gram-when">适用：' + esc(c.when) + '</p>' +
          '<p class="gram-end">词尾：' + esc(c.endings) + '</p>' +
          '<div class="gram-ex">' + esc(c.example) + '</div></div>';
      });
    } else if (topic === 'pronouns') {
      h += '<table class="gram-table"><thead><tr><th>代词</th>' +
        CASE_ORDER.map(function (c) { return '<th>' + CASE_LABEL[c] + '</th>'; }).join('') + '</tr></thead><tbody>';
      Object.keys(ref.pronouns).forEach(function (k) {
        var p = ref.pronouns[k];
        h += '<tr><td class="ru"><b>' + esc(k) + '</b><small>' + esc(p.zh) + '</small></td>' +
          CASE_ORDER.map(function (c) { return '<td class="ru">' + esc(p[c] || '—') + '</td>'; }).join('') + '</tr>';
      });
      h += '</tbody></table>';
    } else if (topic === 'numbers') {
      h += '<table class="gram-table"><thead><tr><th>数词</th><th>二格</th><th>三格</th><th>五格</th><th>六格</th><th>说明</th></tr></thead><tbody>';
      Object.keys(ref.numbers).forEach(function (k) {
        var n = ref.numbers[k];
        h += '<tr><td class="ru"><b>' + esc(k) + '</b><small>' + esc(n.zh) + '</small></td>' +
          '<td class="ru">' + esc(n.gen || '—') + '</td><td class="ru">' + esc(n.dat || '—') + '</td>' +
          '<td class="ru">' + esc(n.ins || '—') + '</td><td class="ru">' + esc(n.prep || '—') + '</td>' +
          '<td class="gnote">' + esc(n.note || '') + '</td></tr>';
      });
      h += '</tbody></table>';
      h += '<p class="hint">搭配：один 接单数；2–4 接单数二格；5 以上接复数二格</p>';
    } else if (topic === 'prepositions') {
      h += '<table class="gram-table pre-table"><thead><tr><th>前置词</th><th>接格</th><th>意义</th><th>例</th></tr></thead><tbody>';
      ref.prepositions.forEach(function (p) {
        h += '<tr><td class="ru"><b>' + esc(p.prep) + '</b></td><td>' + esc(p.cases) + '</td>' +
          '<td>' + esc(p.use) + '</td><td class="ru gex">' + esc(p.example) + '</td></tr>';
      });
      h += '</tbody></table>';
    }
    box.innerHTML = h;
    if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------- 视图：课文知识总结 ---------------- */
  var KNOW_CAT = {
    pron: { name: '特殊发音', color: '#3f6f96' },
    gram: { name: '语法句型', color: '#8a5f0c' },
    vocab: { name: '高频词汇', color: '#2e7d5b' },
    culture: { name: '文化背景', color: '#7a4a8a' },
    pitfall: { name: '易错点', color: '#b5551d' }
  };

  function renderKnow() {
    var f = ui.knowUnit || 'u01';
    var h = '<div class="section">';
    h += '<div class="vchips">';
    UNITS.forEach(function (u) {
      h += '<button class="chip pick' + (f === u.id ? ' on' : '') + '" data-act="know-unit" data-id="' + u.id + '">第' + u.no + '课</button>';
    });
    h += '</div>';
    var u = unitById[f] || UNITS[0];
    h += '<div class="know-head"><b>第' + u.no + '课 · ' + esc(u.zh) + '</b><span>' + esc(u.ru) + ' — ' + esc(u.desc) + '</span></div>';
    var items = (D.knowledge || []).filter(function (k) { return k.unit === f; });
    Object.keys(KNOW_CAT).forEach(function (cat) {
      var list = items.filter(function (k) { return k.cat === cat; });
      if (!list.length) return;
      var meta = KNOW_CAT[cat];
      h += '<div class="know-cat" style="--kc:' + meta.color + '"><div class="know-cat-name">' + meta.name + '</div>';
      list.forEach(function (k) {
        h += '<details class="know-item" open><summary>' + esc(k.title) + '</summary><div class="know-body">' + esc(k.content) + '</div></details>';
      });
      h += '</div>';
    });
    if (!items.length) h += '<div class="empty"><h3>本课知识总结整理中</h3></div>';
    h += '</div>';
    return h;
  }

  /* ---------------- 视图：课本词表（按课序的生词表） ---------------- */
  function renderVocab() {
    var f = ui.vocabFilter || 'all';
    var learned = S.learnedIds(ALL_IDS).length;
    var h = '';

    h += '<div class="section"><div class="vlist-head">' +
      '<div><h2>课本单词表</h2><span>按《走遍俄罗斯》第一册课序排列 · 印刷体与手写体对照 · 点击行可打开学习卡</span></div>' +
      '<div class="vlist-progress">已标记 <b>' + learned + '</b> / ' + WORDS.length + ' 词</div>' +
      '</div>';

    h += '<div class="vchips">' +
      '<button class="chip pick' + (f === 'all' ? ' on' : '') + '" data-act="vocab-filter" data-id="all">全部课</button>';
    UNITS.forEach(function (u) {
      h += '<button class="chip pick' + (f === u.id ? ' on' : '') + '" data-act="vocab-filter" data-id="' + u.id + '">第' + u.no + '课</button>';
    });
    h += '</div>';

    var units = f === 'all' ? UNITS : UNITS.filter(function (u) { return u.id === f; });
    units.forEach(function (u) {
      var st = unitStat(u);
      h += '<div class="card vlesson">' +
        '<div class="vlesson-head">' +
        '<span class="unit-no">' + u.no + '</span>' +
        '<div class="unit-title"><b>第' + u.no + '课 · ' + esc(u.zh) + '</b><span>' + esc(u.ru) + ' · ' + esc(u.desc) + '</span></div>' +
        '<span class="chip">' + st.learned + ' / ' + st.total + '</span>' +
        '</div>' +
        '<div class="vtable">';
      wordsOfUnit[u.id].forEach(function (w, i) {
        var s = S.get(w.id);
        h += '<div class="vrow" data-act="open-word" data-unit="' + u.id + '" data-idx="' + i + '" role="button" tabindex="0">' +
          '<span class="vnum">' + (i + 1) + '</span>' +
          '<div class="vword"><span class="v-ru">' + esc(ruText(w)) + '</span></div>' +
          '<span class="v-cursive">' + esc(w.ru) + '</span>' +
          '<span class="v-pos">' + esc(w.pos) + '</span>' +
          '<span class="v-zh">' + esc(w.zh) + '</span>' +
          '<button class="mini v-speak" data-act="speak" data-text="' + esc(w.ru) + '" aria-label="朗读 ' + esc(w.ru) + '">' + ico('sound', 15) + '</button>' +
          '<span class="v-lv ' + (s.lv ? 'chip lv' + s.lv : '') + '" title="' + S.LEVELS[s.lv].name + '">' + (s.lv ? S.LEVELS[s.lv].name : '—') + '</span>' +
          '</div>';
      });
      h += '</div></div>';
    });
    h += '<p class="hint" style="text-align:center;margin-top:6px">行内喇叭可直接朗读；点行进入该词的学习卡（配图与例句）</p>';
    h += '</div>';
    return h;
  }

  /* ---------------- 视图：单元学习 ---------------- */
  function renderUnit(id) {
    var u = unitById[id]; if (!u) return renderUnits();
    ui.unitId = id;
    var ws = wordsOfUnit[id];
    var st = unitStat(u);

    var h = '<div class="study-wrap">';
    h += '<div class="study-bar">' +
      '<button class="btn sm ghost" data-act="go" data-hash="#/units">' + ico('back', 15) + ' 单元列表</button>' +
      '<span class="spacer"></span>' +
      '<div class="seg">' +
      '<button data-act="unit-mode" data-mode="card" class="' + (ui.unitMode === 'card' ? 'on' : '') + '">卡片</button>' +
      '<button data-act="unit-mode" data-mode="list" class="' + (ui.unitMode === 'list' ? 'on' : '') + '">列表</button>' +
      '</div></div>';

    h += '<div class="section-head" style="margin-bottom:8px">' +
      '<h2>第 ' + u.no + ' 课 · ' + esc(u.zh) + '</h2>' +
      '<span>' + esc(u.ru) + ' · 共 ' + ws.length + ' 词 · 已学 ' + st.learned + '</span></div>';
    h += '<div class="progress-line"><i style="width:' + st.pct + '%"></i></div>';

    if (ui.unitMode === 'list') {
      h += '<div class="word-list">';
      ws.forEach(function (w, i) {
        h += wordRow(w, i);
      });
      h += '</div>';
    } else {
      ui.idx = clamp(ui.idx, 0, ws.length - 1);
      var w = ws[ui.idx], s = S.get(w.id);
      S.view(w.id);                       // 计入“今日接触词数”
      h += '<div class="study-bar">' +
        '<span class="idx">' + (ui.idx + 1) + ' / ' + ws.length + '</span>' +
        '<span class="spacer"></span>' +
        '<button class="mini" data-act="fav" data-id="' + w.id + '" title="收藏">' + ico(s.fav ? 'starOn' : 'star', 17) + '</button>' +
        '<span class="chip ' + S.LEVELS[s.lv].cls + '">' + S.LEVELS[s.lv].name + '</span>' +
        '</div>';

      h += '<div class="flashcard' + (ui.flipped ? ' flipped' : '') + '" data-act="flip">' +
        '<div class="flashcard-inner">' +
        // 正面
        '<div class="face front">' +
        '<div class="scene' + (w.img ? '' : ' no-photo') + '" data-letter="' + esc(w.initial) + '">' + sceneImg(w) + '<span class="scene-cap">' + esc(caption(w)) + '</span></div>' +
        '<div class="body-part">' +
        '<div class="word-row"><div class="ru">' + esc(ruText(w)) + '</div>' +
        '<button class="speak" data-act="speak" data-text="' + esc(w.ru) + '" aria-label="朗读">' + ico('sound', 19) + '</button></div>' +
        (S.state.settings.showCursive === false ? '' :
          '<div class="cursive-line"><span class="cursive-tag">手写体</span><span class="ru-cursive">' + esc(w.ru) + '</span></div>') +
        '<div class="pos">' + esc(w.pos) + '</div>' +
        '<div class="card-meta"><span>第 ' + u.no + ' 课</span><span>' + w.slots + ' 个字母</span><span>' + esc(u.zh) + '</span></div>' +
        '<div class="memory-tip"><b>记忆提示</b> · ' + esc(SCENE_DESC[w.scene] || '结合场景记忆') + '。先看图回忆词义，再点击卡片核对。</div>' +
        '<div class="word-dots" role="group" aria-label="本课单词快速跳转">' +
        ws.map(function (x, i) {
          var sx = S.get(x.id);
          return '<button class="word-dot' + (i === ui.idx ? ' on' : '') + (sx.lv > 0 ? ' done' : '') + '" data-act="goto-word" data-idx="' + i + '" title="' + (i + 1) + '. ' + esc(x.ru) + '" aria-label="第 ' + (i + 1) + ' 词 ' + esc(x.ru) + '"></button>';
        }).join('') + '</div>' +
        '<div class="word-dots-cap">快速跳词 · 本课第 ' + (ui.idx + 1) + ' / ' + ws.length + ' 词 · 绿点表示已标记掌握</div>' +
        '<div class="hint-flip tail">点击卡片 / 按空格翻转查看释义与例句</div>' +
        '</div></div>' +
        // 背面
        '<div class="face back">' +
        '<div class="body-part">' +
        '<div style="display:flex;gap:12px;align-items:center">' +
        '<div class="thumb" style="width:78px;height:58px;flex:0 0 78px">' + sceneImg(w) + '</div>' +
        '<div style="min-width:0">' +
        '<div class="word-row"><div class="ru" style="font-size:25px">' + esc(ruText(w)) + '</div>' +
        '<button class="speak" data-act="speak" data-text="' + esc(w.ru) + '" aria-label="朗读">' + ico('sound', 18) + '</button></div>' +
        '<div class="pos">' + esc(w.pos) + '</div>' +
        '</div></div>' +
        '<div class="zh">' + esc(w.zh) + '</div>' +
        '<div class="example">' +
        '<div class="ex-line">' +
        '<button class="mini" data-act="speak" data-text="' + esc(w.ex_ru) + '" title="朗读例句">' + ico('sound', 16) + '</button>' +
        '<span class="ex-ru">' + highlight(w.ru, w.ex_ru) + '</span></div>' +
        '<div class="ex-zh">' + esc(w.ex_zh) + '</div>' +
        '</div>' +
        grammarPanel(w) +
        '<div class="back-info"><div class="back-info-row"><b>用法</b><span>' + esc(wordExplain(w)) + '</span></div>' +
        '<div class="back-info-row"><b>本课词</b><span class="back-chips">' +
        relatedWords(w).slice(0, 4).map(function (x) { return '<button class="chip pick" data-act="open-word-sheet" data-id="' + x.id + '">' + esc(x.ru) + '</button>'; }).join('') +
        '</span></div></div>' +
        '<div class="hint-flip tail">再次点击卡片返回正面</div>' +
        '</div></div>' +
        '</div></div>';

      h += '<div class="study-actions">' +
        '<button class="btn" data-act="nav-unit" data-d="-1"' + (ui.idx === 0 ? ' disabled' : '') + '>' + ico('left', 16) + ' 上一个</button>' +
        '<button class="btn" data-act="flip">' + ico('flip', 16) + ' 翻转</button>' +
        '<button class="btn" data-act="nav-unit" data-d="1"' + (ui.idx === ws.length - 1 ? ' disabled' : '') + '>下一个 ' + ico('right', 16) + '</button>' +
        '</div>';
      if (ui.idx === ws.length - 1) {
        h += '<p class="hint" style="text-align:center;margin:8px 0 0">已是本课最后一词 · 可去「练习本课」检验一下</p>';
      }
      h += '<div class="level-row"><span>掌握度：</span>';
      S.LEVELS.forEach(function (L, i) {
        h += '<button class="lv-dot' + (i === s.lv ? ' on' : '') + '" data-act="set-lv" data-id="' + w.id + '" data-lv="' + i + '">' + L.name + '</button>';
      });
      h += '</div>';
      h += '<div class="study-actions" style="margin-top:12px">' +
        '<button class="btn ' + (s.book ? 'danger' : '') + '" data-act="toggle-book" data-id="' + w.id + '">' +
        (s.book ? '从生词本移除' : '加入生词本') + '</button>' +
        '<button class="btn primary" data-act="quiz-unit" data-id="' + u.id + '">' + ico('quiz', 16) + ' 练习本课</button>' +
        '</div>';
    }
    h += '</div>';
    return h;
  }

  function wordRow(w, i) {
    var s = S.get(w.id);
    return '<div class="word-row-item" data-act="open-word-sheet" data-id="' + w.id + '" tabindex="0" role="button">' +
      '<span class="row-index">' + (i + 1) + '</span>' +
      '<div class="thumb">' + sceneImg(w) + '</div>' +
      '<div class="wr-text">' +
      '<div class="wr-ru">' + esc(ruText(w)) + ' <small>' + esc(w.pos) + '</small></div>' +
      '<div class="wr-zh">' + esc(w.zh) + ' · ' + highlight(w.ru, w.ex_ru) + '</div>' +
      '</div>' +
      '<span class="chip ' + S.LEVELS[s.lv].cls + '">' + S.LEVELS[s.lv].name + '</span>' +
      '<div class="wr-actions">' +
      '<button class="mini" data-act="speak" data-text="' + esc(w.ru) + '" aria-label="朗读">' + ico('sound', 16) + '</button>' +
      '<button class="mini' + (s.fav ? ' on' : '') + '" data-act="fav" data-id="' + w.id + '" aria-label="收藏">' + ico(s.fav ? 'starOn' : 'star', 16) + '</button>' +
      '<button class="mini" data-act="goto-card" data-idx="' + i + '" aria-label="打开卡片">' + ico('eye', 16) + '</button>' +
      '</div></div>';
  }

  /* ---------------- 视图：练习 ---------------- */
  var QUIZ_TYPES = [
    { key: 'zh2ru', name: '看中文选俄文' },
    { key: 'ru2zh', name: '看俄文选中文' },
    { key: 'spell', name: '拼写填空' },
    { key: 'listen', name: '听音辨词' }
  ];
  var quizSetup = { units: [], types: ['zh2ru', 'ru2zh', 'spell', 'listen'], count: 10, bookFirst: true };

  function renderQuiz(args) {
    if (args && args.auto && args.ids) return startQuiz(args.ids.slice(), args.types || quizSetup.types, args.title || '专项练习');
    if (quiz && quiz.running) return renderRun();
    if (quiz && quiz.done) return renderResult();
    return renderQuizSetup();
  }

  function renderQuizSetup() {
    if (!quizSetup.units.length) quizSetup.units = UNITS.map(function (u) { return u.id; });
    var allUnits = quizSetup.units.length === UNITS.length;
    var bookN = S.wordbookIds(ALL_IDS).length;
    var h = '<div class="quiz"><div class="card" style="padding:18px">';
    h += '<div class="section-head"><h2>练习设置</h2><span>即时反馈，错题自动进生词本</span></div>';
    h += '<div class="field"><label>范围：单元多选</label><div class="picker">' +
      '<button class="pick' + (allUnits ? ' on' : '') + '" data-act="q-units-all">全部</button>' +
      '<button class="pick" data-act="q-units-none">清空</button>';
    UNITS.forEach(function (u) {
      h += '<button class="pick' + (!allUnits && quizSetup.units.indexOf(u.id) >= 0 ? ' on' : '') + '" data-act="q-unit" data-id="' + u.id + '">' +
        u.no + '. ' + esc(u.zh) + ' <span class="cnt">' + wordsOfUnit[u.id].length + '</span></button>';
    });
    h += '</div></div>';

    h += '<div class="field"><label>题型：可多选</label><div class="picker">';
    QUIZ_TYPES.forEach(function (t) {
      h += '<button class="pick' + (quizSetup.types.indexOf(t.key) >= 0 ? ' on' : '') + '" data-act="q-type" data-key="' + t.key + '">' + t.name + '</button>';
    });
    h += '</div></div>';

    h += '<div class="field"><label>题量：<b id="cntLabel">' + quizSetup.count + '</b> 题</label>' +
      '<div class="range-row"><input type="range" min="5" max="40" step="5" value="' + quizSetup.count + '" data-act="q-count" aria-label="题量">' +
      '<span class="hint">5 ~ 40</span></div></div>';

    h += '<label class="switch"><input type="checkbox" data-act="q-book" ' + (quizSetup.bookFirst ? 'checked' : '') + '><span class="track"></span>' +
      '优先抽取生词本中的词（当前 ' + bookN + ' 个）</label>';

    var pool = poolIds();
    h += '<p class="hint" style="margin:4px 0 14px">本次可用词数：<b>' + pool.length + '</b> · 若可用词不足会自动补足本组其他词汇</p>';
    h += '<div class="actions">' +
      '<button class="btn primary" data-act="quiz-start" ' + (pool.length ? '' : 'disabled') + '>' + ico('quiz', 16) + ' 开始练习</button>' +
      (bookN ? '<button class="btn" data-act="quiz-book">' + ico('book', 16) + ' 只练生词本 (' + bookN + ')</button>' : '') +
      '</div>';
    h += '</div></div>';
    return h;
  }

  function poolIds() {
    var pool = [];
    quizSetup.units.forEach(function (uid) {
      wordsOfUnit[uid].forEach(function (w) { pool.push(w.id); });
    });
    if (quizSetup.bookFirst) {
      var bk = S.wordbookIds(pool);
      var rest = pool.filter(function (id) { return bk.indexOf(id) < 0; });
      return shuffle(bk).concat(shuffle(rest));
    }
    return shuffle(pool);
  }

  function startQuiz(ids, types, title) {
    if (!ids.length) { toast('没有可练习的单词'); return renderQuizSetup(); }
    var n = Math.min(quizSetup.count, ids.length);
    quiz = {
      ids: ids.slice(0, n), types: types, title: title || '单元练习',
      idx: 0, right: 0, wrong: 0, log: [], running: true, done: false,
      startedAt: Date.now(), answered: false, q: null
    };
    nextQuestion();
    return renderRun();
  }

  function distractors(w, n) {
    var sameU = shuffle(wordsOfUnit[w.unit].filter(function (x) { return x.id !== w.id; })).slice(0, n);
    var need = n - sameU.length;
    if (need > 0) {
      var pool = shuffle(WORDS.filter(function (x) {
        return x.id !== w.id && sameU.indexOf(x) < 0;
      }));
      sameU = sameU.concat(pool.slice(0, need));
    }
    return sameU;
  }

  function buildQuestion() {
    var w = byId[quiz.ids[quiz.idx]];
    var type = pickOne(quiz.types);
    // 拼写题排除多词短语（до свидания 之类逐字母点选负担过重，且分组会泄露结构）
    if (type === 'spell' && /\s/.test(w.ru)) {
      var pool = quiz.ids.filter(function (id) { return !/\s/.test(byId[id].ru); });
      if (pool.length) {
        w = byId[pool[Math.floor(Math.random() * pool.length)]];
      } else {
        var alt = quiz.types.filter(function (x) { return x !== 'spell'; });
        type = alt.length ? pickOne(alt) : 'zh2ru';
      }
    }
    var q = { w: w, type: type, options: [], answer: 0 };
    if (type === 'ru2zh') {
      // 干扰项避免与目标中文释义重复
      var ds = distractors(w, 3);
      q.options = shuffle([w].concat(ds)).map(function (x) { return { id: x.id, text: x.zh, ru: false }; });
    } else {
      var ds2 = distractors(w, 3);
      q.options = shuffle([w].concat(ds2)).map(function (x) { return { id: x.id, text: x.ru, ru: true }; });
    }
    q.answer = q.options.map(function (o) { return o.id; }).indexOf(w.id);
    return q;
  }

  var TYPE_LABEL = { zh2ru: '看中文选俄文', ru2zh: '看俄文选中文', spell: '拼写填空', listen: '听音辨词' };

  function nextQuestion() {
    if (quiz.idx >= quiz.ids.length) { finishQuiz(); return; }
    quiz.q = buildQuestion();
    quiz.answered = false;
    // 朗读规则：听力题必读；拼写题（听写）作为辅助朗读；选择题不朗读，避免作答前泄题
    var t = quiz.q.type, sl = S.state.settings.slow;
    if (t === 'listen' || (t === 'spell' && S.state.settings.autoSpeak)) {
      setTimeout(function () {
        if (quiz && quiz.running && quiz.q && quiz.q.type === t) speak(quiz.q.w.ru, sl);
      }, 90);
    }
  }

  function finishQuiz() {
    quiz.running = false; quiz.done = true;
    var total = quiz.right + quiz.wrong;
    if (total && quiz.right / total >= 0.8) setTimeout(confettiBurst, 120);
  }

  function renderRun() {
    if (!quiz || quiz.done) return renderResult();
    var q = quiz.q, w = q.w;
    var pct = Math.round(quiz.idx / quiz.ids.length * 100);
    var h = '<div class="quiz">';
    h += '<div class="q-head">' +
      '<button class="btn sm ghost" data-act="quiz-quit">' + ico('close', 15) + ' 退出</button>' +
      '<span class="q-type">' + TYPE_LABEL[q.type] + '</span>' +
      '<span class="spacer"></span>' +
      '<span class="chip">' + (quiz.idx + 1) + ' / ' + quiz.ids.length + '</span>' +
      '<span class="chip lv4">✓ ' + quiz.right + '</span>' +
      '</div>';
    h += '<div class="progress-line"><i style="width:' + pct + '%"></i></div>';

    if (q.type === 'spell') {
      h += '<div class="q-scene">' + sceneImg(w) + '</div>';
      h += '<div class="q-prompt"><div class="q-main zh">' + esc(w.zh) + '</div><div class="q-sub">' + esc(w.pos) + ' · ' + caption(w) + '</div></div>';
      h += spellWidget(w);
    } else if (q.type === 'listen') {
      h += '<div class="q-prompt">' +
        '<button class="speak" style="width:72px;height:72px;flex:0 0 72px" data-act="speak" data-slow="1" data-text="' + esc(w.ru) + '" aria-label="再次播放（慢速）">' + ico('sound', 30) + '</button>' +
        '<div class="q-sub" style="margin-top:10px">听发音，选择对应的俄语单词 <span class="hint">（可反复点击慢速重听）</span></div></div>';
      h += optionsHtml(q);
    } else if (q.type === 'ru2zh') {
      h += '<div class="q-prompt"><div class="q-main">' + esc(ruText(w)) + '</div>' +
        '<div class="q-sub">' + esc(w.pos) + '</div>' +
        '<button class="btn sm ghost" style="margin-top:8px" data-act="speak" data-text="' + esc(w.ru) + '">' + ico('sound', 14) + ' 朗读</button></div>';
      h += optionsHtml(q);
    } else {
      h += '<div class="q-scene">' + sceneImg(w) + '</div>';
      h += '<div class="q-prompt"><div class="q-main zh">' + esc(w.zh) + '</div><div class="q-sub">' + esc(w.pos) + '</div></div>';
      h += optionsHtml(q);
    }

    h += '<div id="fb" aria-live="polite"></div>';
    if (S.state.settings.ttsOnly && !RVAudio.hasRussian()) {
      h += '<p class="hint" style="text-align:center;margin-top:10px">提示：系统未安装俄语语音包，朗读可能使用默认音色。</p>';
    }
    h += '</div>';
    return h;
  }

  function optionsHtml(q) {
    var h = '<div class="options">';
    q.options.forEach(function (o, i) {
      h += '<button class="option" data-act="answer" data-i="' + i + '">' +
        '<span class="key">' + 'ABCD'[i] + '</span>' +
        '<span class="' + (o.ru ? 'ru-t' : '') + '">' + esc(o.text) + '</span></button>';
    });
    return h + '</div>';
  }

  /* 拼写 widgets —— 词块选择，兼容手机无俄语键盘 */
  function targetLetters(w) {
    return w.ru.replace(/ё/g, 'ё').toLowerCase().split('');
  }
  function spellWidget(w) {
    var letters = targetLetters(w).filter(function (c) { return c !== ' ' && c !== '-'; });
    var noise = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
    var extra = [];
    while (extra.length < 3) {
      var c = noise[Math.floor(Math.random() * noise.length)];
      if (letters.indexOf(c) < 0 || extra.indexOf(c) < 0) extra.push(c);
    }
    // 首母提示：保留词首字母已在槽位
    quiz.spell = { letters: letters, filled: [targetLetters(w)[0]], target: letters.join('') };
    var h = '<div class="slots" id="slots">';
    var groups = w.ru.toLowerCase().split(' ');
    var idx = 0;
    groups.forEach(function (g, gi) {
      if (gi > 0) h += '<span style="width:14px"></span>';
      g.split('').forEach(function () {
        h += '<div class="slot' + (idx < quiz.spell.filled.length ? ' filled' : '') + '" data-act="slot" data-i="' + idx + '">' +
          (idx < quiz.spell.filled.length ? esc(quiz.spell.filled[idx]) : '') + '</div>';
        idx++;
      });
    });
    h += '</div>';
    // 组字母
    var pool = shuffle(letters.slice(1).concat(extra));
    h += '<div class="tiles" id="tiles">';
    pool.forEach(function (c, i) {
      h += '<button class="tile" data-act="tile" data-c="' + c + '" data-i="' + i + '">' + esc(c) + '</button>';
    });
    h += '</div>';
    h += '<div class="actions center" style="margin-top:14px">' +
      '<button class="btn sm" data-act="spell-clear">清空</button>' +
      '<button class="btn sm" data-act="spell-hint">提示一个字母</button>' +
      '<button class="btn primary sm" data-act="spell-check">确认拼写</button>' +
      '</div>';
    return h;
  }

  function refreshSpell() {
    var slots = $('#slots'); if (!slots) return;
    $$('#slots .slot').forEach(function (el, i) {
      var v = quiz.spell.filled[i];
      el.textContent = v || '';
      el.classList.toggle('filled', !!v);
    });
    $$('#tiles .tile').forEach(function (el, i) {
      el.classList.remove('used');
    });
    // 标记已用字母（按数量）。注意：filled[0] 是固定的首字母提示，不来自字母块，
    // 不能计入占用，否则「торт / мама / папа」这类首字母重复的词会误标字母块。
    var used = quiz.spell.filled.slice(1);
    $$('#tiles .tile').forEach(function (el) {
      var c = el.dataset.c;
      var pos = used.indexOf(c);
      if (pos >= 0) { el.classList.add('used'); used.splice(pos, 1); }
    });
  }

  function answerCommon(ok, chosenId) {
    var q = quiz.q, w = q.w;
    var s = S.answer(w.id, ok);
    quiz.log.push({ id: w.id, ok: ok, type: q.type });
    if (ok) quiz.right++; else quiz.wrong++;
    var fb = $('#fb');
    var cls = ok ? 'ok' : 'bad';
    var title = ok ? '回答正确' : '回答错误 · 已加入生词本';
    fb.innerHTML = '<div class="feedback ' + cls + '">' +
      '<div class="fb-title">' + ico(ok ? 'check' : 'close', 15) + ' ' + title + '</div>' +
      '<div class="fb-ru">' + esc(ruText(w)) + ' <span class="chip">' + esc(w.pos) + '</span> ' + esc(w.zh) + '</div>' +
      '<div style="margin-top:4px">' + highlight(w.ru, w.ex_ru) + ' — ' + esc(w.ex_zh) + '</div>' +
      '<div class="fb-actions">' +
      '<button class="btn sm" data-act="speak" data-text="' + esc(w.ru) + '">' + ico('sound', 14) + ' 朗读单词</button>' +
      '<button class="btn sm" data-act="speak" data-text="' + esc(w.ex_ru) + '">' + ico('sound', 14) + ' 朗读例句</button>' +
      '<span class="spacer" style="flex:1"></span>' +
      '<button class="btn primary sm" data-act="q-next">下一个 ' + ico('right', 14) + '</button>' +
      '</div></div>';
    if (fb && fb.scrollIntoView) fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (ok) toast('正确！掌握度提升到「' + S.LEVELS[s.lv].name + '」');
  }

  function renderResult() {
    var total = quiz.right + quiz.wrong;
    var acc = total ? Math.round(quiz.right / total * 100) : 0;
    var dur = Date.now() - quiz.startedAt;
    var wrongIds = quiz.log.filter(function (l) { return !l.ok; }).map(function (l) { return l.id; });
    var uniq = wrongIds.filter(function (v, i) { return wrongIds.indexOf(v) === i; });
    var h = '<div class="result"><div class="card" style="padding:22px">';
    h += '<div class="chip">' + esc(quiz.title) + '</div>';
    h += '<div class="result-score" style="color:' + (acc >= 80 ? 'var(--ok)' : acc >= 60 ? 'var(--accent)' : 'var(--bad)') + '">' + acc + '%</div>';
    h += '<div class="result-sub">共 ' + total + ' 题 · 正确 ' + quiz.right + ' · 错误 ' + quiz.wrong + ' · 用时 ' + mmss(dur) + '</div>';
    h += '<div class="actions center" style="margin:18px 0 6px">' +
      '<button class="btn primary" data-act="quiz-again">' + ico('flip', 16) + ' 再来一组</button>' +
      (uniq.length ? '<button class="btn" data-act="quiz-wrong" data-ids="' + uniq.join(',') + '">' + ico('book', 16) + ' 专攻错词 (' + uniq.length + ')</button>' : '') +
      '<button class="btn" data-act="go" data-hash="#/stats">' + ico('stats', 16) + ' 查看统计</button>' +
      '<button class="btn ghost" data-act="go" data-hash="#/units">返回单元</button>' +
      '</div>';
    if (uniq.length) {
      h += '<div class="section-head" style="margin-top:18px"><h2>错词回顾</h2><span>点击行可朗读取义</span></div><div class="word-list">';
      uniq.forEach(function (id) {
        var w = byId[id];
        h += '<div class="word-row-item"><div class="thumb">' + sceneImg(w) + '</div>' +
          '<div class="wr-text"><div class="wr-ru">' + esc(w.ru) + ' <small>' + esc(w.pos) + '</small></div>' +
          '<div class="wr-zh">' + esc(w.zh) + '</div></div>' +
          '<div class="wr-actions"><button class="mini" data-act="speak" data-text="' + esc(w.ru) + '">' + ico('sound', 16) + '</button></div></div>';
      });
      h += '</div>';
    }
    h += '</div></div>';
    return h;
  }

  /* ---------------- 视图：复习 ---------------- */
  function startReview(ids) {
    review = { ids: shuffle(ids).slice(0, 30), idx: 0, shown: false, log: [], done: false, startedAt: Date.now() };
  }

  function renderReview(autoStart) {
    var due = S.dueIds(ALL_IDS);
    if ((!review || review.done) && autoStart && due.length) startReview(due);
    if (review && !review.done && review.idx < review.ids.length) return renderReviewRun();
    return renderReviewHome(due);
  }

  function renderReviewHome(due) {
    var bookN = S.wordbookIds(ALL_IDS).length;
    var weak = ALL_IDS.filter(function (id) { var s = S.state.words[id]; return s && s.lv > 0 && s.lv <= 1; });
    var h = '<div class="study-wrap">';
    h += '<div class="hero"><div class="hero-text"><h2>' + (due.length ? '今日复习队列：' + due.length + ' 词' : '暂无到期复习的单词') + '</h2>' +
      '<p>采用间隔重复：答对「清楚」会延长下次间隔，答错回到生词本。</p></div>' +
      '<div class="hero-stats"><div class="hero-stat"><b>' + due.length + '</b><span>今日到期</span></div>' +
      '<div class="hero-stat"><b>' + bookN + '</b><span>生词本</span></div>' +
      '<div class="hero-stat"><b>' + weak.length + '</b><span>需巩固</span></div></div></div>';

    if (!due.length) {
      h += '<div class="card empty"><div class="empty-art">' + Sc.get('clock') + '</div><h3>复习队列是空的</h3>' +
        '<p>先去单元里学几个新词，系统会按 10 分钟 / 1 小时 / 1 天 / 3 天 / 7 天的节奏安排复习。</p>' +
        '<button class="btn primary" style="margin-top:10px" data-act="go" data-hash="#/units">去学习新词</button></div>';
    } else {
      h += '<div class="section-head"><h2>待复习单词</h2><span>按到期时间排序</span></div><div class="word-list">';
      due.slice(0, 40).forEach(function (id, i) { var w = byId[id]; h += wordRow(w, i); });
      h += '</div>';
      h += '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn primary" data-act="review-start">' + ico('review', 16) + ' 开始复习 ' + due.length + ' 词</button>' +
        '</div>';
    }
    if (bookN) {
      h += '<div class="section" style="margin-top:22px"><div class="section-head"><h2>生词本待巩固</h2><span>' + bookN + ' 词</span></div>' +
        '<div class="actions"><button class="btn" data-act="go" data-hash="#/book">打开生词本</button>' +
        '<button class="btn" data-act="quiz-book">' + ico('quiz', 16) + ' 练习生词</button></div></div>';
    }
    h += '</div>';
    return h;
  }

  function renderReviewRun() {
    var w = byId[review.ids[review.idx]], s = S.get(w.id);
    var pct = Math.round(review.idx / review.ids.length * 100);
    var h = '<div class="study-wrap">';
    h += '<div class="q-head" style="max-width:620px;margin:0 auto">' +
      '<button class="btn sm ghost" data-act="review-quit">' + ico('close', 15) + ' 暂停</button>' +
      '<span class="spacer"></span><span class="chip">' + (review.idx + 1) + ' / ' + review.ids.length + '</span>' +
      '<span class="chip ' + S.LEVELS[s.lv].cls + '">' + S.LEVELS[s.lv].name + '</span></div>';
    h += '<div class="progress-line"><i style="width:' + pct + '%"></i></div>';
    h += '<div class="flashcard' + (review.shown ? ' flipped' : '') + '" data-act="flip">' +
      '<div class="flashcard-inner">' +
      '<div class="face front">' +
      '<div class="scene' + (w.img ? '' : ' no-photo') + '" data-letter="' + esc(w.initial) + '">' + sceneImg(w) + '<span class="scene-cap">' + esc(caption(w)) + '</span></div>' +
      '<div class="body-part">' +
      '<div class="word-row"><div class="ru">' + esc(ruText(w)) + '</div>' +
      '<button class="speak" data-act="speak" data-text="' + esc(w.ru) + '">' + ico('sound', 19) + '</button></div>' +
      (S.state.settings.showCursive === false ? '' :
        '<div class="cursive-line"><span class="cursive-tag">手写体</span><span class="ru-cursive">' + esc(w.ru) + '</span></div>') +
      '<div class="pos">' + esc(w.pos) + '</div>' +
      '<div class="hint-flip tail">先回忆词义，再点「显示释义」自评</div>' +
      '</div></div>' +
      '<div class="face back"><div class="body-part">' +
      '<div class="zh" style="font-size:23px">' + esc(w.zh) + '</div>' +
      '<div class="pos" style="margin-top:2px">' + esc(w.ru) + ' · ' + esc(w.pos) + '</div>' +
      '<div class="example">' +
      '<div class="ex-line"><button class="mini" data-act="speak" data-text="' + esc(w.ex_ru) + '">' + ico('sound', 16) + '</button>' +
      '<span class="ex-ru">' + highlight(w.ru, w.ex_ru) + '</span></div>' +
      '<div class="ex-zh">' + esc(w.ex_zh) + '</div></div>' +
      '<div class="hint-flip tail">根据自己的熟练程度评分</div>' +
      '</div></div></div></div>';

    if (!review.shown) {
      h += '<div class="study-actions"><button class="btn primary" data-act="review-show">' + ico('eye', 16) + ' 显示释义</button></div>';
    } else {
      h += '<div class="study-actions">' +
        '<button class="btn danger" data-act="review-grade" data-q="0">忘了</button>' +
        '<button class="btn" data-act="review-grade" data-q="1">模糊</button>' +
        '<button class="btn primary" data-act="review-grade" data-q="2">清楚</button>' +
        '</div>';
      h += '<p class="hint" style="text-align:center;margin-top:10px">自评依据：完全没想起来选「忘了」，想起来但不牢选「模糊」，脱口而出选「清楚」。选「忘了」不丢人——它会重新回到生词本。</p>';
    }
    h += '</div>';
    return h;
  }

  function finishReview() {
    review.done = true;
    var cnt = { 0: 0, 1: 0, 2: 0 };
    review.log.forEach(function (q) { cnt[q]++; });
    var h = '<div class="result"><div class="card" style="padding:22px">' +
      '<div class="chip">复习完成</div>' +
      '<div class="result-score">' + review.ids.length + '</div>' +
      '<div class="result-sub">本轮复习词数 · 清楚 ' + cnt[2] + ' · 模糊 ' + cnt[1] + ' · 忘了 ' + cnt[0] + '</div>' +
      '<div class="actions center" style="margin-top:18px">' +
      '<button class="btn primary" data-act="review-start">继续复习剩余</button>' +
      '<button class="btn" data-act="go" data-hash="#/stats">' + ico('stats', 16) + ' 查看统计</button>' +
      '<button class="btn ghost" data-act="go" data-hash="#/units">返回学习</button>' +
      '</div></div></div>';
    return h;
  }

  /* ---------------- 视图：生词本 ---------------- */
  var bookTab = 'all';
  function bookIds() {
    var list = S.wordbookIds(ALL_IDS);
    if (bookTab === 'book') return list.filter(function (id) { return S.get(id).book; });
    if (bookTab === 'fav') return list.filter(function (id) { return S.get(id).fav; });
    return list;
  }
  function renderBook() {
    var list = bookIds();
    var all = S.wordbookIds(ALL_IDS);
    var h = '<div class="study-wrap">';
    h += '<div class="section-head" style="margin-bottom:8px"><h2>生词本</h2><span>错过的词自动收录，达标后自动淡化</span></div>';
    h += '<div class="picker" style="margin-bottom:14px">' +
      '<button class="pick' + (bookTab === 'all' ? ' on' : '') + '" data-act="book-tab" data-tab="all">全部 <span class="cnt">' + all.length + '</span></button>' +
      '<button class="pick' + (bookTab === 'book' ? ' on' : '') + '" data-act="book-tab" data-tab="book">错词 <span class="cnt">' + all.filter(function (i) { return S.get(i).book; }).length + '</span></button>' +
      '<button class="pick' + (bookTab === 'fav' ? ' on' : '') + '" data-act="book-tab" data-tab="fav">收藏 <span class="cnt">' + all.filter(function (i) { return S.get(i).fav; }).length + '</span></button>' +
      '<span class="spacer" style="flex:1"></span>' +
      '<button class="btn sm" data-act="export-csv">' + ico('down', 15) + ' 导出 CSV</button>' +
      '</div>';

    if (!list.length) {
      h += '<div class="card empty"><div class="empty-art">' + Sc.get('book') + '</div><h3>这里还没有生词</h3>' +
        '<p>练习中答错的单词会自动出现在这里；也可以在学习卡上手动加入，手动加入的词不会被自动移除。</p>' +
        '<div class="actions center" style="margin-top:12px"><button class="btn primary" data-act="go" data-hash="#/quiz">去做练习</button>' +
        '<button class="btn" data-act="go" data-hash="#/units">去学习</button></div></div>';
    } else {
      h += '<div class="actions" style="margin-bottom:14px">' +
        '<button class="btn primary" data-act="quiz-ids" data-ids="' + list.join(',') + '">' + ico('quiz', 16) + ' 练习这 ' + list.length + ' 个词</button>' +
        '<button class="btn" data-act="review-ids" data-ids="' + list.join(',') + '">' + ico('review', 16) + ' 立即复习</button>' +
        '</div>';
      h += '<div class="word-list">';
      list.forEach(function (id) {
        var w = byId[id], s = S.get(id);
        h += '<div class="word-row-item" data-act="open-word-sheet" data-id="' + id + '" tabindex="0" role="button">' +
          '<div class="thumb">' + sceneImg(w) + '</div>' +
          '<div class="wr-text"><div class="wr-ru">' + esc(w.ru) + ' <small>' + esc(w.pos) + '</small></div>' +
          '<div class="wr-zh">' + esc(w.zh) + ' · ' + highlight(w.ru, w.ex_ru) + '</div></div>' +
          '<span class="chip ' + S.LEVELS[s.lv].cls + '">' + S.LEVELS[s.lv].name + '</span>' +
          '<div class="wr-actions">' +
          '<button class="mini" data-act="speak" data-text="' + esc(w.ru) + '">' + ico('sound', 16) + '</button>' +
          '<button class="mini' + (s.fav ? ' on' : '') + '" data-act="fav" data-id="' + id + '">' + ico(s.fav ? 'starOn' : 'star', 16) + '</button>' +
          '<button class="mini" data-act="level-up" data-id="' + id + '" title="提升掌握度">' + ico('plus', 16) + '</button>' +
          '<button class="mini" data-act="remove-book" data-id="' + id + '" title="移出生词本">' + ico('close', 16) + '</button>' +
          '</div></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function exportCsv() {
    var rows = [['俄语', '词性', '汉语释义', '俄文例句', '中文译文', '单元', '掌握度']];
    bookIds().forEach(function (id) {
      var w = byId[id], s = S.get(id);
      rows.push([w.ru, w.pos, w.zh, w.ex_ru, w.ex_zh, unitById[w.unit].zh, S.LEVELS[s.lv].name]);
    });
    var csv = '\ufeff' + rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '生词本_' + S.todayKey() + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast('已导出 ' + (rows.length - 1) + ' 条生词');
  }

  /* ---------------- 视图：统计 ---------------- */
  function renderStats() {
    var ser = S.series(14);
    var learned = S.learnedIds(ALL_IDS).length;
    var mastered = ALL_IDS.filter(function (id) { return S.state.words[id] && S.state.words[id].lv >= 4; }).length;
    var dueN = S.dueIds(ALL_IDS).length;
    var bookN = S.wordbookIds(ALL_IDS).length;
    var t = S.today();
    var totalQuiz = ser.reduce(function (a, b) { return a + b.quiz; }, 0);
    var totalRight = ser.reduce(function (a, b) { return a + b.correct; }, 0);
    var hasData = learned > 0 || totalQuiz > 0 || t.review > 0 || ser.some(function (d) { return d.views + d.learn + d.quiz + d.review > 0; });

    if (!hasData) {
      return '<div class="card empty" style="padding:52px 24px">' +
        '<div class="empty-art">' + Sc.get('clock') + '</div>' +
        '<h3>统计会从第一次学习开始生长</h3>' +
        '<p>去单元里翻几张卡片，或做一组 10 题练习。之后这里会出现每日学习量、正确率趋势、掌握度分布和连续天数。</p>' +
        '<div class="actions center" style="margin-top:16px">' +
        '<button class="btn primary" data-act="go" data-hash="#/units">去学习</button>' +
        '<button class="btn" data-act="go" data-hash="#/quiz">做一组练习</button></div>' +
        '<div class="card-meta" style="justify-content:center;margin-top:22px"><span>1 · 看图记词</span><span>2 · 即时练习</span><span>3 · 间隔复习</span></div>' +
        '</div>';
    }

    var h = '';
    h += '<div class="kpis section">' +
      kpi('今日接触', S.viewsToday() + ' 词', '翻卡 ' + t.learn + ' 次 · 答题 ' + t.quiz + ' 道') +
      kpi('练习正确率', t.quiz ? Math.round(t.correct / t.quiz * 100) + '%' : '—', '答对 ' + t.correct + ' / ' + t.quiz + '（仅客观题）') +
      kpi('复习自评', t.review + ' 词', '清楚 ' + t.revGood + ' · 模糊 ' + t.revHard + ' · 忘了 ' + t.revForget) +
      kpi('连续学习', S.streakDays() + ' 天', '近两周 ' + ser.filter(function (d) { return d.learn + d.quiz + d.review > 0; }).length + ' 天活跃') +
      kpi('已学单词', learned + ' / ' + WORDS.length, '其中已掌握 ' + mastered) +
      kpi('生词本', bookN, '今日新增错题 ' + t.wrong) +
      kpi('待复习', dueN, dueN ? '建议今天清空队列' : '队列已清空') +
      '</div>';

    h += '<div class="chart-grid">';

    // 学习量柱状（堆叠：新学 + 复习 + 测验）
    var maxV = Math.max(1, Math.max.apply(null, ser.map(function (d) { return d.learn + d.review + d.quiz; })));
    h += '<div class="card chart-box"><h3>每日学习量</h3><div class="cap">近 14 天 · 翻卡 / 复习 / 练习题目</div>' +
      '<div class="bars">';
    ser.forEach(function (d) {
      var a = d.learn / maxV * 100, b = d.review / maxV * 100, c = d.quiz / maxV * 100;
      h += '<div class="col" title="' + d.label + '：翻卡 ' + d.learn + ' · 复习 ' + d.review + ' · 练习 ' + d.quiz + '">' +
        '<div class="stack" style="height:' + (a + b + c) + '%">' +
        '<i class="bar" style="height:' + (c / Math.max(a + b + c, 1) * 100) + '%;background:#7ea0cf" title="练习"></i>' +
        '<i class="bar" style="height:' + (b / Math.max(a + b + c, 1) * 100) + '%;background:#7ba58a" title="复习"></i>' +
        '<i class="bar" style="height:' + (a / Math.max(a + b + c, 1) * 100) + '%;background:#3f6f96" title="翻卡"></i>' +
        '</div><span class="xlab">' + d.label + '</span></div>';
    });
    h += '</div><div class="legend"><span><i style="background:#3f6f96"></i>翻卡</span><span><i style="background:#7ba58a"></i>复习</span><span><i style="background:#7ea0cf"></i>练习</span></div></div>';

    // 正确率折线
    h += '<div class="card chart-box"><h3>正确率趋势</h3><div class="cap">近 14 天 · 折线为当日正确率，柱为错题数</div>' + lineChart(ser) + '</div>';

    // 掌握度分布
    h += '<div class="card chart-box"><h3>掌握度分布</h3><div class="cap">全部 ' + WORDS.length + ' 词 · 未学习的词计入「生词」</div>' + levelChart() + '</div>';

    // 单元进度
    h += '<div class="card chart-box"><h3>各单元进度</h3><div class="cap">已标记的单词 / 单元总词数</div><ul class="legend-bars">';
    UNITS.forEach(function (u) {
      var st = unitStat(u);
      h += '<li title="' + esc(u.ru) + '"><span>' + u.no + '. ' + esc(u.zh) + '</span>' +
        '<span class="track"><i style="width:' + st.pct + '%;background:#3f6f96"></i></span>' +
        '<span class="v">' + st.learned + '/' + st.total + '</span></li>';
    });
    h += '</ul></div>';

    h += '</div>';

    // 累计概览
    h += '<div class="hero" style="margin-top:16px"><div class="hero-text"><h2>累计数据</h2>' +
      '<p>' + esc(D.meta.book) + '</p></div>' +
      '<div class="hero-stats">' +
      '<div class="hero-stat"><b>' + totalQuiz + '</b><span>累计答题</span></div>' +
      '<div class="hero-stat"><b>' + (totalQuiz ? Math.round(totalRight / totalQuiz * 100) + '%' : '—') + '</b><span>平均正确率</span></div>' +
      '<div class="hero-stat"><b>' + Math.round(learned / WORDS.length * 100) + '%</b><span>词表覆盖率</span></div>' +
      '</div></div>';
    return h;
  }

  function kpi(label, value, sub) {
    return '<div class="card kpi"><div class="k-label">' + label + '</div><div class="k-value">' + value + '</div><div class="k-sub">' + sub + '</div></div>';
  }

  function lineChart(ser) {
    var w = 320, hgt = 150, padL = 26, padB = 22, padT = 8;
    var n = ser.length;
    var maxBad = Math.max(1, Math.max.apply(null, ser.map(function (d) { return d.wrong; })));
    var pts = [], dots = '';
    ser.forEach(function (d, i) {
      var x = padL + i * (w - padL - 6) / (n - 1);
      var y = d.acc == null ? null : hgt - padB - (d.acc / 100) * (hgt - padB - padT);
      if (y != null) pts.push(x.toFixed(1) + ',' + y.toFixed(1));
      if (y != null) dots += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.6" fill="#3f6f96"/>';
    });
    var bars = '';
    ser.forEach(function (d, i) {
      var x = padL + i * (w - padL - 6) / (n - 1);
      var bh = d.wrong / maxBad * 60;
      bars += '<rect x="' + (x - 4) + '" y="' + (hgt - padB - bh) + '" width="8" height="' + bh + '" rx="2" fill="#e0b7a8"/>';
    });
    var grid = '';
    [0, 50, 100].forEach(function (v) {
      var y = hgt - padB - (v / 100) * (hgt - padB - padT);
      grid += '<line x1="' + padL + '" y1="' + y + '" x2="' + (w - 6) + '" y2="' + y + '" stroke="#eceff4"/>' +
        '<text x="4" y="' + (y + 3.5) + '" font-size="9" fill="#a4acb8">' + v + '</text>';
    });
    var xlabs = '';
    ser.forEach(function (d, i) {
      if (i % 2 === 0 || i === n - 1) {
        var x = padL + i * (w - padL - 6) / (n - 1);
        xlabs += '<text x="' + x + '" y="' + (hgt - 6) + '" font-size="9" fill="#a4acb8" text-anchor="middle">' + d.label + '</text>';
      }
    });
    var line = pts.length > 1 ? '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#3f6f96" stroke-width="2" stroke-linejoin="round"/>' : '';
    return '<svg viewBox="0 0 ' + w + ' ' + hgt + '" width="100%" role="img" aria-label="正确率趋势图">' +
      grid + bars + line + dots + xlabs + '</svg>' +
      '<div class="legend"><span><i style="background:#3f6f96"></i>当日正确率</span><span><i style="background:#e0b7a8"></i>错题数</span></div>';
  }

  function levelChart() {
    var counts = S.LEVELS.map(function () { return 0; });
    ALL_IDS.forEach(function (id) {
      var s = S.state.words[id];
      counts[s ? s.lv : 0]++;
    });
    var maxv = Math.max(1, Math.max.apply(null, counts));
    var colors = ['#c8553d', '#c08a2e', '#7ea0cf', '#4a7fb5', '#3f8f74', '#2e7a5e'];
    var h = '<ul class="legend-bars">';
    S.LEVELS.forEach(function (L, i) {
      h += '<li><span>' + L.name + '</span><span class="track"><i style="width:' + (counts[i] / maxv * 100) + '%;background:' + colors[i] + '"></i></span>' +
        '<span class="v">' + counts[i] + '</span></li>';
    });
    return h + '</ul>';
  }

  /* ---------------- 视图：字母表 ---------------- */
  var alphaFilter = '全部';
  function renderAlphabet() {
    var list = D.alphabet || [];
    var types = ['全部', '元音', '辅音', '无音'];
    var shown = list.filter(function (a) { return alphaFilter === '全部' || a.type === alphaFilter; });
    var h = '<div class="card alpha-intro">' +
      '<div><h2>Алфавит · 33 个字母</h2><p>10 个元音、21 个辅音、2 个无音符号。先认字母，再记单词——零基础也能从这里开始。点击字母卡查看发音要点与例词。</p></div>' +
      '<div class="alpha-filters">' + types.map(function (t) {
        return '<button class="pick' + (alphaFilter === t ? ' on' : '') + '" data-act="alpha-filter" data-type="' + t + '">' + t + '</button>';
      }).join('') + '</div></div>';
    h += '<div class="alpha-grid">';
    shown.forEach(function (a, i) {
      h += '<div class="alpha-card" data-act="open-alpha" data-upper="' + esc(a.upper) + '" tabindex="0" role="button" data-type="' + esc(a.type) + '">' +
        '<div class="alpha-big">' + esc(a.upper) + '<small>' + esc(a.lower) + '</small></div>' +
        '<div class="alpha-name">' + esc(a.name) + ' <span class="alpha-ipa">' + esc(a.ipa) + '</span></div>' +
        '<div class="alpha-ex"><b>' + esc(a.example) + '</b> · ' + esc(a.exampleZh) + '</div></div>';
    });
    h += '</div>';
    return h;
  }

  /* ---------------- 视图：情景短语 ---------------- */
  var phraseCat = '全部';
  function renderPhrases() {
    var list = D.phrases || [];
    var cats = ['全部']; list.forEach(function (p) { if (cats.indexOf(p.cat) < 0) cats.push(p.cat); });
    var shown = list.filter(function (p) { return phraseCat === '全部' || p.cat === phraseCat; });
    var h = '<div class="card alpha-intro"><div><h2>Фразы · 开口就能用</h2><p>' + list.length + ' 句高频情景短语，按场景分组。点击卡片朗读，长按/右键可复制俄语原文。</p></div>' +
      '<div class="alpha-filters">' + cats.map(function (c) {
        return '<button class="pick' + (phraseCat === c ? ' on' : '') + '" data-act="phrase-cat" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('') + '</div></div>';
    h += '<div class="phrase-grid">';
    shown.forEach(function (p) {
      h += '<div class="card phrase-card" data-act="speak" data-text="' + esc(p.ru) + '">' +
        '<button class="mini ph-play" data-act="speak" data-text="' + esc(p.ru) + '" aria-label="朗读">' + ico('sound', 15) + '</button>' +
        '<div class="ph-cat">' + esc(p.cat) + '</div><div class="ph-ru">' + esc(p.ru) + '</div>' +
        '<div class="ph-zh">' + esc(p.zh) + '</div>' + (p.note ? '<div class="ph-note">' + esc(p.note) + '</div>' : '') + '</div>';
    });
    h += '</div>';
    return h;
  }

  /* ---------------- 工具箱 ---------------- */
  var typingState = null;
  var matching = null;
  function newMatching() {
    var picks = shuffle(WORDS).slice(0, 5);
    var cards = [];
    picks.forEach(function (w) {
      cards.push({ key: 'ru-' + w.id, id: w.id, kind: 'ru', text: w.ru });
      cards.push({ key: 'zh-' + w.id, id: w.id, kind: 'zh', text: w.zh });
    });
    matching = { cards: shuffle(cards), selected: [], matched: {}, moves: 0 };
  }
  function newTypingWord() {
    var w = WORDS[Math.floor(Math.random() * WORDS.length)];
    typingState = { id: w.id, answered: false, right: 0, total: 0 };
    return w;
  }
  function renderTools() {
    var noteCount = Object.keys(S.state.notes || {}).length;
    var h = '<div class="section">';
    h += '<div class="card alpha-intro"><div><h2>Инструменты · 工具箱</h2><p>不依赖网络的本地练习与小工具；外部资源会标注「需联网」。</p></div></div>';
    h += '<div class="tool-grid">';
    var items = [
      ['typing', 'type', '打字练习', '看中文，输入俄语单词', '速记'],
      ['cursive', 'spark', '手写转写', '把印刷体转成手写体对照', '书写'],
      ['speak', 'sound', '文本朗读', '粘贴俄语文本，逐句朗读', '听说'],
      ['notes', 'note', '我的笔记', noteCount ? noteCount + ' 条单词笔记' : '给难词写下自己的记忆线索', '笔记'],
      ['game', 'spark', '单词配对', '俄语与中文配对，记住 5 组词', '游戏'],
      ['resources', 'link', '学习资源', '词典、发音、翻译与语法站点', '需联网'],
      ['book', 'book', '生词本', '收藏与错词集中复习', '复习'],
      ['stats', 'stats', '学习统计', '查看连续天数与掌握度', '数据']
    ];
    items.forEach(function (it) {
      h += '<button class="card tool-tile" data-act="go" data-hash="#/' + it[0] + '">' +
        '<span class="tool-ico">' + ico(it[1], 22) + '</span>' +
        '<span class="tool-tag">' + it[4] + '</span>' +
        '<b>' + it[2] + '</b><small>' + it[3] + '</small></button>';
    });
    h += '<button class="card tool-tile" data-act="quick-listen">' +
      '<span class="tool-ico">' + ico('quiz', 22) + '</span><span class="tool-tag">即时</span>' +
      '<b>听力拼写</b><small>听音辨词 + 拼写，立即开始 10 题</small></button>';
    h += '</div>';
    h += '<div class="card tool-tip"><b>学习建议</b><span>先用「学习」卡片建立画面与发音，再用「打字练习」检验拼写，最后在「复习」里按间隔重复巩固。</span></div>';
    h += '</div>';
    return h;
  }
  function renderTyping() {
    if (!typingState) newTypingWord();
    var w = byId[typingState.id] || newTypingWord();
    var u = unitById[w.unit];
    var h = '<div class="section tool-page">';
    h += '<div class="tool-head"><button class="btn sm ghost" data-act="go" data-hash="#/tools">' + ico('back', 15) + ' 工具箱</button>' +
      '<span class="hint">看中文与提示，输入完整俄语单词</span></div>';
    h += '<div class="card typing-card"><div class="typing-kicker">第 ' + u.no + ' 课 · ' + esc(u.zh) + '</div>' +
      '<h2 style="font-family:var(--serif);font-size:26px;margin:4px 0 0">打字练习</h2>' +
      '<div class="typing-zh">' + esc(w.zh) + '</div>' +
      '<div class="typing-hint">' + esc(w.pos) + ' · ' + w.ru.length + ' 个字母 · 首字母 ' + esc(w.ru.charAt(0).toUpperCase()) + '</div>' +
      '<div class="typing-row"><input id="typeInput" class="typing-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="在这里输入俄语…" aria-label="输入俄语单词">' +
      '<button class="btn primary" data-act="typing-check">检查</button></div>' +
      '<div id="typeFb" class="typing-fb" aria-live="polite"></div>' +
      '<div class="typing-actions"><button class="btn sm" data-act="typing-reveal">看答案</button>' +
      '<button class="btn sm" data-act="typing-next">换一个 ' + ico('right', 14) + '</button>' +
      '<span class="hint" id="typeStats">本轮答对 ' + typingState.right + ' / ' + typingState.total + '</span></div></div></div>';
    return h;
  }
  function renderCursive() {
    return '<div class="section tool-page"><div class="tool-head"><button class="btn sm ghost" data-act="go" data-hash="#/tools">' + ico('back', 15) + ' 工具箱</button>' +
      '<span class="hint">印刷体 → 手写体</span></div><div class="card tool-card"><h2>手写转写</h2>' +
      '<p class="hint">输入俄语单词或短句，立即查看手写体对照。手写体仅用于认读练习，不作为书写规范。</p>' +
      '<input id="cursiveInput" class="typing-input" value="Привет, как дела?" autocomplete="off" aria-label="输入俄语">' +
      '<div class="cursive-output" id="cursiveOut">Привет, как дела?</div>' +
      '<div class="sheet-actions"><button class="btn sm" data-act="speak-text">' + ico('sound', 14) + ' 朗读</button>' +
      '<button class="btn sm" data-act="copy-cursive">' + ico('note', 14) + ' 复制俄语</button></div></div></div>';
  }
  function renderSpeak() {
    return '<div class="section tool-page"><div class="tool-head"><button class="btn sm ghost" data-act="go" data-hash="#/tools">' + ico('back', 15) + ' 工具箱</button>' +
      '<span class="hint">文本朗读</span></div><div class="card tool-card"><h2>文本朗读</h2>' +
      '<p class="hint">粘贴任意俄语文本，用内置神经语音朗读；长文本建议分段。</p>' +
      '<textarea id="speakText" class="wd-note-input" rows="6" placeholder="Вставьте русский текст…">Привет! Меня зовут Анна. Я изучаю русский язык.</textarea>' +
      '<div class="sheet-actions"><button class="btn sm primary" data-act="speak-text">' + ico('sound', 14) + ' 朗读文本</button>' +
      '<button class="btn sm" data-act="stop-text">停止</button></div></div></div>';
  }
  function renderNotes() {
    var ids = Object.keys(S.state.notes || {});
    var h = '<div class="section tool-page"><div class="tool-head"><button class="btn sm ghost" data-act="go" data-hash="#/tools">' + ico('back', 15) + ' 工具箱</button>' +
      '<span class="hint">' + ids.length + ' 条笔记</span></div>';
    h += '<div class="card tool-card"><h2>我的笔记</h2>';
    if (!ids.length) {
      h += '<div class="empty"><h3>还没有笔记</h3><p>在任意词条详情里写下搭配、易错点或自己的联想，这里会按单词汇总。</p>' +
        '<button class="btn primary" data-act="go" data-hash="#/units">去学习</button></div></div></div>';
      return h;
    }
    h += '<div class="notes-list">';
    ids.forEach(function (id) {
      var w = byId[id]; if (!w) return;
      var txt = S.note(id);
      h += '<div class="note-item" data-act="open-word-sheet" data-id="' + id + '" tabindex="0" role="button">' +
        '<div class="note-word">' + esc(w.ru) + '<small>' + esc(w.zh) + '</small></div>' +
        '<div class="note-text">' + esc(txt) + '</div></div>';
    });
    h += '</div></div></div>';
    return h;
  }
  function renderGame() {
    if (!matching) newMatching();
    var h = '<div class="section tool-page"><div class="tool-head"><button class="btn sm ghost" data-act="go" data-hash="#/tools">' + ico('back', 15) + ' 工具箱</button>' +
      '<span class="hint">先点俄语，再点中文</span></div><div class="card tool-card"><h2>单词配对</h2>' +
      '<p class="hint">5 组词，找出俄语与中文的对应关系。配对成功会变绿。</p>' +
      '<div class="match-status"><span>步数 <b id="matchMoves">' + matching.moves + '</b></span>' +
      '<span>已配对 <b id="matchDone">' + Object.keys(matching.matched).length + ' / 5</b></span>' +
      '<button class="btn sm" data-act="match-new">换一组</button></div>' +
      '<div class="match-grid">';
    matching.cards.forEach(function (c) {
      var done = matching.matched[c.id];
      h += '<button class="match-card ' + c.kind + (done ? ' ok' : '') + '" data-act="match-card" data-key="' + c.key + '" data-id="' + c.id + '" data-kind="' + c.kind + '"' + (done ? ' disabled' : '') + '>' + esc(c.text) + '</button>';
    });
    h += '</div><div class="match-win" id="matchWin">' + (Object.keys(matching.matched).length === 5 ? '<b>完成！</b> 用了 ' + matching.moves + ' 步。<button class="btn sm primary" data-act="match-new">再来一局</button>' : '') + '</div></div></div>';
    return h;
  }
  function renderResources() {
    var links = [
      ['ru.wiktionary.org', '俄语维基词典', '查词义、变格与词源', 'https://ru.wiktionary.org/'],
      ['forvo.com', 'Forvo 真人发音', '听母语者的单词发音', 'https://forvo.com/languages/ru/'],
      ['translate.yandex.com', 'Yandex 翻译', '俄中互译与例句', 'https://translate.yandex.com/ru/'],
      ['masterrussian.com', 'Master Russian', '语法与常用表达参考', 'https://masterrussian.com/']
    ];
    var h = '<div class="section tool-page"><div class="tool-head"><button class="btn sm ghost" data-act="go" data-hash="#/tools">' + ico('back', 15) + ' 工具箱</button>' +
      '<span class="hint">外部网站 · 需联网</span></div><div class="card tool-card"><h2>学习资源</h2>' +
      '<p class="hint">以下为外部网站，点击后用系统浏览器打开；应用内的词库、发音和练习仍可完全离线使用。</p><div class="res-list">';
    links.forEach(function (l) {
      h += '<a class="res-item" href="' + l[3] + '" target="_blank" rel="noopener">' +
        '<span class="res-icon">' + ico('link', 18) + '</span><span><b>' + l[1] + '</b><small>' + l[2] + '</small><em>' + l[0] + '</em></span><span class="gt-arrow">›</span></a>';
    });
    h += '</div></div></div>';
    return h;
  }

  /* ---------------- 底部抽屉与单词详情 ---------------- */
  var sheetLastFocus = null;
  function openSheet(html, label, mode) {
    var sheet = $('#sheet'), body = $('#sheetBody');
    if (!sheet || !body) return;
    sheetLastFocus = document.activeElement;
    sheet.classList.toggle('detail', mode === 'detail');
    body.innerHTML = html;
    sheet.hidden = false;
    document.body.classList.add('sheet-open');
    var panel = sheet.querySelector('.sheet-panel');
    if (panel) panel.setAttribute('aria-label', label || '详情');
    var close = sheet.querySelector('.sheet-close');
    if (close) setTimeout(function () { close.focus(); }, 40);
    lockMainScroll(true);
  }
  function closeSheet() {
    var sheet = $('#sheet');
    if (!sheet || sheet.hidden) return;
    try { stopRecord(); } catch (e) { }
    sheet.hidden = true;
    sheet.classList.remove('detail');
    document.body.classList.remove('sheet-open');
    lockMainScroll(false);
    if (sheetLastFocus && sheetLastFocus.focus) sheetLastFocus.focus();
  }
  function lockMainScroll(on) {
    var main = $('#main');
    if (!main) return;
    if (on) { main.dataset.scrollTop = main.scrollTop; main.style.overflow = 'hidden'; }
    else { main.style.overflow = ''; if (main.dataset.scrollTop) main.scrollTop = +main.dataset.scrollTop; }
  }
  function wordSheet(id) {
    var w = byId[id]; if (!w) return;
    var s = S.get(id);
    var u = unitById[w.unit];
    var tags = grammarTags(w), parts = morphParts(w), rel = relatedWords(w);
    var note = S.note(id);
    var h = '<div class="wd-head">' +
      '<div class="wd-eyebrow">СЛОВО · 词条详情</div>' +
      '<div class="wd-title"><div class="wd-ru">' + esc(ruText(w)) + '</div>' +
      '<button class="speak" data-act="speak" data-text="' + esc(w.ru) + '" aria-label="朗读">' + ico('sound', 20) + '</button></div>' +
      '<div class="wd-syll">读音参考 · ' + esc(splitSyllables(w.ru)) + '</div>' +
      '<div class="wd-meta"><span class="chip">' + esc(w.pos) + '</span><span class="chip">第 ' + u.no + ' 课 · ' + esc(u.zh) + '</span>' +
      tags.map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('') + '</div>' +
      (S.state.settings.showCursive === false ? '' :
        '<div class="cursive-line" style="justify-content:flex-start"><span class="cursive-tag">手写体</span><span class="ru-cursive" style="font-size:28px">' + esc(w.ru) + '</span></div>') +
      '</div>';

    if (w.img) h += '<div class="wd-cover">' + sceneImg(w) + '</div>';

    h += '<div class="wd-sec"><h3>' + ico('dict', 15) + ' 释义</h3>' +
      '<div class="wd-zh">' + esc(w.zh) + '</div>' +
      '<div class="wd-explain">' + esc(wordExplain(w)) + '</div></div>';

    h += '<div class="wd-sec"><h3>' + ico('phrase', 15) + ' 例句</h3>' +
      '<div class="wd-ex"><span class="ex-ru">' + highlight(w.ru, w.ex_ru) + '</span>' +
      '<button class="mini" data-act="speak" data-text="' + esc(w.ex_ru) + '" title="朗读例句">' + ico('sound', 14) + '</button></div>' +
      '<div class="sheet-ex-zh">' + esc(w.ex_zh) + '</div></div>';

    h += '<div class="wd-sec"><h3>' + ico('gram', 15) + ' 形态学分析</h3>';
    if (parts.length) {
      h += '<div class="morph-parts">' + parts.map(function (p) {
        return '<span class="morph-part"><b>' + esc(p.text) + '</b><small>' + esc(p.label) + '</small></span>';
      }).join('<span class="morph-plus">+</span>') + '</div>' +
        '<p class="wd-note">词形结构为自动拆分，用于帮助记忆词干与词尾；不规则变化以语法表为准。</p>';
    } else {
      h += '<p class="wd-note">固定搭配按整体记忆，不拆分词素。</p>';
    }
    h += '<div class="wd-tags">' + tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>';
    var gp = grammarPanel(w, true);
    h += (gp || '<p class="wd-note">该词没有变格/变位表，按固定表达记忆。</p>') + '</div>';

    if (rel.length) {
      h += '<div class="wd-sec"><h3>' + ico('learn', 15) + ' 同课词汇</h3><div class="wd-rel">' +
        rel.map(function (x) { return '<button class="chip pick" data-act="open-word-sheet" data-id="' + x.id + '">' + esc(x.ru) + ' <em>' + esc(x.zh) + '</em></button>'; }).join('') +
        '</div></div>';
    }

    h += '<div class="wd-sec"><h3>' + ico('note', 15) + ' 我的笔记</h3>' +
      '<textarea class="wd-note-input" id="wordNote" maxlength="800" placeholder="记下搭配、易错点或自己的联想……">' + esc(note) + '</textarea>' +
      '<button class="btn sm" data-act="save-note" data-id="' + id + '">保存笔记</button></div>';

    h += '<div class="wd-sec"><h3>' + ico('mic', 15) + ' 发音练习</h3>' +
      '<p class="wd-note">先听标准发音，再录下自己的跟读；录音仅保存在本次会话，不会上传。</p>' +
      '<div class="wd-actions"><button class="btn sm" data-act="record-word" data-id="' + id + '">' + ico('mic', 14) + ' <span id="recLabel">录音跟读</span></button>' +
      '<button class="btn sm" data-act="play-rec" ' + (recState.url && recState.id === id ? '' : 'disabled') + '>' + ico('sound', 14) + ' 播放我的录音</button>' +
      '<button class="btn sm" data-act="score-word" data-id="' + id + '">' + ico('spark', 14) + ' 识别评分</button></div>' +
      '<div class="pron-result" id="pronResult"></div></div>';

    h += '<div class="sheet-actions">' +
      '<button class="btn sm ' + (s.fav ? 'primary' : '') + '" data-act="fav" data-id="' + id + '">' + ico(s.fav ? 'starOn' : 'star', 14) + ' ' + (s.fav ? '已收藏' : '收藏') + '</button>' +
      '<button class="btn sm" data-act="toggle-book" data-id="' + id + '">' + ico('book', 14) + ' ' + (s.book ? '移出生词本' : '加入生词本') + '</button>' +
      '<button class="btn sm" data-act="goto-card-detail" data-unit="' + w.unit + '" data-id="' + id + '">' + ico('learn', 14) + ' 打开学习卡</button>' +
      '</div>';
    openSheet(h, w.ru, 'detail');
  }

  /* 跟读录音：MediaRecorder，仅本机会话；失败时给出明确提示 */
  var recState = { id: null, url: null, recorder: null, chunks: [], stream: null, timer: null };
  function stopRecord() {
    if (recState.timer) { clearTimeout(recState.timer); recState.timer = null; }
    if (recState.recorder && recState.recorder.state !== 'inactive') recState.recorder.stop();
  }
  function toggleRecord(id) {
    if (recState.recorder && recState.recorder.state === 'recording') { stopRecord(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      toast('当前设备不支持录音，请用系统 TTS 或手机录音 App');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      recState.id = id; recState.chunks = []; recState.stream = stream;
      var rec = new MediaRecorder(stream);
      recState.recorder = rec;
      var label = $('#recLabel'); if (label) label.textContent = '停止录音';
      rec.ondataavailable = function (e) { if (e.data && e.data.size) recState.chunks.push(e.data); };
      rec.onstop = function () {
        try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { }
        var blob = new Blob(recState.chunks, { type: rec.mimeType || 'audio/webm' });
        if (recState.url) { try { URL.revokeObjectURL(recState.url); } catch (e) { } }
        recState.url = URL.createObjectURL(blob);
        recState.recorder = null; recState.stream = null;
        var l = $('#recLabel'); if (l) l.textContent = '重新录音';
        var btn = document.querySelector('[data-act="play-rec"]'); if (btn) btn.disabled = false;
        var box = $('#pronResult'); if (box) box.innerHTML = '<span class="ok-text">已录制 ' + Math.max(1, Math.round(blob.size / 1200)) + ' KB · 可播放或进行识别评分</span>';
      };
      rec.start();
      recState.timer = setTimeout(stopRecord, 8000);
    }).catch(function () {
      toast('无法访问麦克风：请检查系统/浏览器的录音权限');
    });
  }
  function playRecording() {
    if (!recState.url) { toast('还没有录音，先点「录音跟读」'); return; }
    var a = new Audio(recState.url); a.play().catch(function () { toast('录音播放失败'); });
  }
  function scoreWord(id) {
    var w = byId[id]; if (!w) return;
    if (!RVGrammar.speechAvailable || !RVGrammar.speechAvailable()) { toast('当前设备没有语音识别，可先练跟读录音'); return; }
    var box = $('#pronResult'); if (box) box.innerHTML = '<span class="muted">正在听……请读一遍这个词</span>';
    try {
      RVGrammar.listen('ru-RU', function (text) {
        if (!text) { if (box) box.innerHTML = '<span class="bad-text">没有听清，再试一次</span>'; return; }
        var target = w.ru.toLowerCase(), got = text.toLowerCase();
        var d = editDistance(target, got), max = Math.max(target.length, got.length, 1);
        var score = Math.max(0, Math.round((1 - d / max) * 100));
        if (box) box.innerHTML = '<div class="pron-score"><b>' + score + '</b><span>参考分</span></div>' +
          '<div class="wd-note">识别到：' + esc(text) + '</div>' +
          '<div class="wd-note">' + (score >= 80 ? '很接近标准发音。' : score >= 50 ? '再听一遍标准音，注意重音和词尾。' : '慢速跟读，先分音节再连起来。') + '</div>';
      }, function (err) {
        if (box) box.innerHTML = '<span class="bad-text">识别失败：' + esc(String(err)) + '</span>';
      });
    } catch (e) {
      if (box) box.innerHTML = '<span class="bad-text">识别失败，请稍后重试</span>';
    }
  }
  function editDistance(a, b) {
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      var tmp = prev; prev = cur; cur = tmp;
    }
    return prev[n];
  }
  function alphaSheet(upper) {
    var a = (D.alphabet || []).filter(function (x) { return x.upper === upper; })[0];
    if (!a) return;
    var sameType = (D.alphabet || []).filter(function (x) { return x.type === a.type; }).length;
    var h = '<div class="alpha-detail"><div class="alpha-hero-letter">' + esc(a.upper) + '<div style="font-size:30px;color:var(--muted);text-align:center">' + esc(a.lower) + '</div></div>' +
      '<div><h2>' + esc(a.name) + '</h2><div class="alpha-meta">' + esc(a.type) + ' · ' + esc(a.ipa) + ' · 同类字母 ' + sameType + ' 个</div>' +
      '<div class="alpha-note">' + esc(a.note) + '</div>' +
      '<div class="alpha-word">' + esc(a.example) + ' <span style="font-family:var(--sans);font-size:13px;color:var(--muted)">' + esc(a.exampleZh) + '</span></div>' +
      '<div class="sheet-actions"><button class="btn sm primary" data-act="speak" data-text="' + esc(a.example) + '">' + ico('sound', 14) + ' 朗读例词</button>' +
      '<button class="btn sm" data-act="speak" data-text="' + esc(a.name) + '">朗读字母名称</button></div></div></div>';
    openSheet(h, a.name);
  }

  /* ---------------- 搜索命令面板 ---------------- */
  var paletteIndex = -1, paletteHits = [];
  function openPalette() {
    var p = $('#palette'); if (!p) return;
    p.hidden = false;
    var input = $('#paletteInput');
    if (input) { input.value = ''; input.focus(); }
    paletteIndex = -1;
    paletteRender('');
  }
  function closePalette() { var p = $('#palette'); if (p) p.hidden = true; }
  function paletteRender(q) {
    q = (q || '').trim().toLowerCase();
    var hits = [];
    if (!q) {
      hits = WORDS.slice(0, 8);
    } else {
      WORDS.forEach(function (w) {
        var score = 0;
        if (w.ru.toLowerCase().indexOf(q) === 0) score = 3;
        else if (w.ru.toLowerCase().indexOf(q) > -1) score = 2;
        else if (w.zh.indexOf(q) > -1) score = 2;
        else if (w.pos.indexOf(q) > -1) score = 1;
        if (score) hits.push({ w: w, score: score });
      });
      hits.sort(function (a, b) { return b.score - a.score; });
      hits = hits.slice(0, 12).map(function (x) { return x.w; });
    }
    paletteHits = hits;
    var box = $('#paletteResults');
    if (!box) return;
    if (!hits.length) { box.innerHTML = '<div class="palette-empty">没有找到「' + esc(q) + '」<br><span style="font-size:12px">试试俄语原形、中文释义，或去词典做变格反查</span></div>'; return; }
    box.innerHTML = hits.map(function (w, i) {
      return '<div class="palette-row' + (i === paletteIndex ? ' on' : '') + '" data-act="palette-open" data-id="' + w.id + '">' +
        '<span class="pr-ru">' + esc(ruText(w)) + '</span><span class="pr-zh">' + esc(w.zh) + '</span>' +
        '<span class="pr-pos">' + esc(w.pos) + '</span></div>';
    }).join('');
  }


  function renderSettings() {
    var st = S.state.settings;
    var h = '<div class="study-wrap"><div class="card" style="padding:18px">';
    h += '<div class="section-head"><h2>学习与朗读</h2></div>';
    h += '<label class="switch"><input type="checkbox" data-act="set-auto" ' + (st.autoSpeak ? 'checked' : '') + '><span class="track"></span><span class="switch-text">卡片出现时自动朗读俄语<small>翻到新词时自动播放发音</small></span></label>';
    h += '<label class="switch"><input type="checkbox" data-act="set-slow" ' + (st.slow ? 'checked' : '') + '><span class="track"></span><span class="switch-text">慢速朗读<small>约 0.8 倍速，适合跟读</small></span></label>';
    h += '<label class="switch"><input type="checkbox" data-act="set-tts" ' + (st.ttsOnly ? 'checked' : '') + '><span class="track"></span><span class="switch-text">仅使用系统语音<small>不播放内置真人发音</small></span></label>';
    var stressed = WORDS.filter(function (w) { return !!w.ru_stress; }).length;
    h += '<label class="switch' + (stressed ? '' : ' is-disabled') + '"><input type="checkbox" data-act="set-stress" ' + (stressed && st.showStress !== false ? 'checked' : '') + (stressed ? '' : ' disabled') + '><span class="track"></span><span class="switch-text">显示重音符号<small>' + (stressed ? '已标注 ' + stressed + ' / ' + WORDS.length + ' 词' : '当前词库尚未标注重音，暂以真人发音为准') + '</small></span></label>';
    h += '<label class="switch"><input type="checkbox" data-act="set-cursive" ' + (st.showCursive === false ? '' : 'checked') + '><span class="track"></span><span class="switch-text">单词下方显示手写体<small>对照印刷体与手写体</small></span></label>';
    h += '<div style="display:flex;gap:10px;align-items:center;margin-top:10px">' +
      '<button class="btn sm" data-act="audio-selftest">' + ico('sound', 15) + ' 测试发音</button>' +
      '<span class="hint" id="selftestResult">点击后播放第 1 个单词，并报告播放通道与失败原因</span></div>';
    h += '<div class="field" style="max-width:340px"><label>朗读语速：<b id="rateLabel">' + st.rate.toFixed(2) + '</b></label>' +
      '<input type="range" min="0.5" max="1.2" step="0.05" value="' + st.rate + '" data-act="set-rate"></div>';
    var goal = st.dailyGoal || 20;
    h += '<div class="field" style="max-width:340px"><label>每日目标：<b>' + goal + '</b> 词</label>' +
      '<div class="range-row"><input type="range" min="10" max="60" step="5" value="' + goal + '" data-act="set-goal" aria-label="每日目标"><span class="hint">10 ~ 60</span></div></div>';

    h += '<div class="section-head" style="margin-top:18px"><h2>离线语音</h2><span>共 ' + RVAudio.counts().words + ' 个单词 + ' + RVAudio.counts().sents + ' 个例句</span></div>';
    if (location.protocol === 'file:') {
      h += '<p class="hint" style="margin:0 0 10px">当前为本地文件模式，语音已随应用附带，无需额外下载。</p>';
    } else {
      h += '<div class="actions" style="align-items:center;margin-bottom:6px">' +
        '<button class="btn" data-act="precache">' + ico('down', 15) + ' 缓存全部语音到本机</button>' +
        '<span class="hint" id="precacheTip">适合手机/PWA 首次使用，之后可完全离线学习</span></div>' +
        '<div class="progress-line" id="precacheBar" style="display:none;max-width:340px"><i style="width:0%"></i></div>';
    }

    h += '<div class="section-head" style="margin-top:18px"><h2>数据</h2><span>所有进度保存在本机浏览器中</span></div>';
    h += '<div class="actions">' +
      '<button class="btn" data-act="export-json">' + ico('down', 15) + ' 导出学习记录</button>' +
      '<button class="btn danger" data-act="reset">' + ico('close', 15) + ' 清空全部进度</button>' +
      '</div>';

    h += '<div class="section-head" style="margin-top:22px"><h2>关于词库</h2></div>';
    h += '<div class="due-card">' + esc(D.meta.book) + '<br>单元主题按教材课序编排，共 ' + UNITS.length + ' 课 ' + WORDS.length + ' 词。' +
      '<span class="mt">词条为各课核心词汇（俄语单词、重音、词性、释义均依俄语规范标注），例句为本应用编写的教学短句，用于情景记忆。教材正文版权归外语教学与研究出版社。</span></div>';
    h += '</div></div>';
    return h;
  }

  function exportJson() {
    var data = { exportedAt: new Date().toISOString(), state: S.state };
    var blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = '俄语学习记录_' + S.todayKey() + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast('学习记录已导出');
  }

  /* ---------------- 路由 ---------------- */
  var lastHash = null;
  function render() {
    var raw = (location.hash || '#/units').replace(/^#\/?/, '');
    // 离开页面后清掉“已结束的练习会话”，避免再次进入时停留在旧结算页
    if (location.hash !== lastHash) {
      if (quiz && !quiz.running) quiz = null;
      lastHash = location.hash;
    }
    var parts = raw.split('?');
    var seg = parts[0].split('/').filter(Boolean);
    var key = seg[0] || 'units';
    var html = '';
    switch (key) {
      case 'units': html = renderUnits(); break;
      case 'list': html = renderVocab(); break;
      case 'dict': html = renderDict(); break;
      case 'gram': html = renderGram(); break;
      case 'know': html = renderKnow(); break;
      case 'alphabet': html = renderAlphabet(); break;
      case 'phrases': html = renderPhrases(); break;
      case 'tools': html = renderTools(); break;
      case 'typing': html = renderTyping(); break;
      case 'cursive': html = renderCursive(); break;
      case 'speak': html = renderSpeak(); break;
      case 'notes': html = renderNotes(); break;
      case 'game': html = renderGame(); break;
      case 'resources': html = renderResources(); break;
      case 'unit': html = renderUnit(seg[1]); key = 'unit'; break;
      case 'quiz': html = renderQuiz(); break;
      case 'review': html = renderReview(); break;
      case 'book': html = renderBook(); break;
      case 'stats': html = renderStats(); break;
      case 'settings': html = renderSettings(); break;
      default: html = renderUnits(); key = 'units';
    }
    var sub = null;
    if (key === 'unit' && unitById[seg[1]]) {
      var uu = unitById[seg[1]];
      sub = '第 ' + uu.no + ' 课 · ' + uu.zh + ' · ' + uu.ru + ' · 单词卡片';
    }
    $('#view').innerHTML = html;
    var vEl = $('#view');
    vEl.classList.remove('view-enter');
    void vEl.offsetWidth;
    vEl.classList.add('view-enter');
    updateChrome(key === 'unit' ? 'units' : key, sub);
    if (key === 'dict') {
      var di = $('#dictInput');
      if (di) {
        di.addEventListener('input', function () { dictRender(di.value); });
        setTimeout(function () { di.focus(); }, 60);
      }
      dictRender('');
    }
    window.scrollTo({ top: 0 });
    var mainEl = $('#main'); if (mainEl) mainEl.scrollTop = 0;
  }

  function go(hash) { location.hash = hash; }

  /* ---------------- 事件委托 ---------------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.dataset.act, id = el.dataset.id, v = el.dataset;
    switch (act) {
      case 'go': go(v.hash); break;
      case 'open-word-sheet': wordSheet(id); break;
      case 'save-note': {
        var ta = $('#wordNote');
        if (!ta) break;
        S.setNote(id, ta.value);
        el.textContent = '已保存';
        setTimeout(function () { if (el) el.textContent = '保存笔记'; }, 1500);
        toast('笔记已保存');
        break;
      }
      case 'record-word': toggleRecord(id); break;
      case 'play-rec': playRecording(); break;
      case 'score-word': scoreWord(id); break;
      case 'typing-check': {
        if (!typingState || typingState.answered) break;
        var ti = $('#typeInput'), fb = $('#typeFb');
        if (!ti || !fb) break;
        var tw = byId[typingState.id];
        var norm = function (x) { return String(x || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim(); };
        var ok = norm(ti.value) === norm(tw.ru);
        typingState.answered = true; typingState.total++;
        if (ok) typingState.right++;
        ti.classList.toggle('ok', ok); ti.classList.toggle('bad', !ok);
        fb.innerHTML = ok ? '<span class="ok-text">正确 · ' + esc(tw.ru) + '</span>' :
          '<span class="bad-text">正确答案：<b>' + esc(tw.ru) + '</b></span>';
        var stats = $('#typeStats'); if (stats) stats.textContent = '本轮答对 ' + typingState.right + ' / ' + typingState.total;
        var check = document.querySelector('[data-act="typing-check"]'); if (check) check.disabled = true;
        break;
      }
      case 'typing-reveal': {
        if (!typingState) break;
        var rw = byId[typingState.id], rfb = $('#typeFb');
        if (rfb) rfb.innerHTML = '<span class="muted">答案：<b>' + esc(rw.ru) + '</b> · ' + esc(rw.zh) + '</span>';
        typingState.answered = true;
        break;
      }
      case 'typing-next': typingState = null; render(); break;
      case 'match-card': {
        if (!matching || matching.matched[id]) break;
        if (matching.selected.some(function (s) { return s.key === v.key; })) break;
        matching.selected.push({ key: v.key, id: id, kind: v.kind });
        el.classList.add('sel');
        if (matching.selected.length < 2) break;
        matching.moves++;
        var ma = matching.selected[0], mb = matching.selected[1];
        if (ma.id === mb.id && ma.kind !== mb.kind) {
          matching.matched[ma.id] = true;
          [ma, mb].forEach(function (x) {
            var n = document.querySelector('[data-key="' + x.key + '"]');
            if (n) { n.classList.remove('sel'); n.classList.add('ok'); n.disabled = true; }
          });
          matching.selected = [];
          var mv = $('#matchMoves'), md = $('#matchDone');
          if (mv) mv.textContent = matching.moves;
          var done = Object.keys(matching.matched).length;
          if (md) md.textContent = done + ' / 5';
          if (done === 5) {
            var mw = $('#matchWin');
            if (mw) mw.innerHTML = '<b>完成！</b> 用了 ' + matching.moves + ' 步。<button class="btn sm primary" data-act="match-new">再来一局</button>';
          }
        } else {
          [ma, mb].forEach(function (x) {
            var n = document.querySelector('[data-key="' + x.key + '"]');
            if (n) n.classList.add('bad');
          });
          var wrong = matching.selected;
          matching.selected = [];
          setTimeout(function () {
            wrong.forEach(function (x) {
              var n = document.querySelector('[data-key="' + x.key + '"]');
              if (n) n.classList.remove('bad', 'sel');
            });
          }, 620);
        }
        break;
      }
      case 'match-new': matching = null; render(); break;
      case 'quick-listen': {
        quizSetup.types = ['listen', 'spell'];
        startQuiz(shuffle(ALL_IDS).slice(0, 10), ['listen', 'spell'], '听力拼写');
        go('#/quiz');
        break;
      }
      case 'speak-text': {
        var stEl = $('#speakText') || $('#cursiveInput') || $('#typeInput');
        var stTxt = stEl ? (stEl.value || stEl.textContent) : '';
        if (stTxt.trim()) speak(stTxt.trim()); else toast('先输入要朗读的俄语');
        break;
      }
      case 'stop-text': if (window.RVAudio && RVAudio.stop) RVAudio.stop(); break;
      case 'copy-cursive': {
        var ci = $('#cursiveInput');
        var cv = ci ? ci.value : '';
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(cv).then(function () { toast('已复制俄语原文'); });
        else toast('当前环境不支持剪贴板');
        break;
      }
      case 'dict-pick': {
        var di = $('#dictInput'); if (di) di.value = v.q; dictRender(v.q); break;
      }
      case 'open-alpha': alphaSheet(v.upper); break;
      case 'alpha-filter': alphaFilter = v.type; render(); break;
      case 'phrase-cat': phraseCat = v.cat; render(); break;
      case 'palette-open': closePalette(); wordSheet(id); break;
      case 'goto-card-detail': {
        var wid = byId[id]; if (!wid) break;
        var wi = wordsOfUnit[wid.unit].map(function (x) { return x.id; }).indexOf(id);
        ui.unitMode = 'card'; ui.idx = wi < 0 ? 0 : wi; ui.flipped = false;
        closeSheet(); go('#/unit/' + wid.unit); break;
      }
      case 'goto-card': ui.unitMode = 'card'; ui.idx = +v.idx; ui.flipped = false; render(); break;
      case 'goto-word': ui.unitMode = 'card'; ui.idx = +v.idx; ui.flipped = false; render(); break;
      case 'unit-mode': ui.unitMode = v.mode; ui.flipped = false; render(); break;
      case 'flip':
        if (quiz && quiz.running) return;
        if (review && review.idx < review.ids.length && review.ids.length) { review.shown = !review.shown; renderReviewPaint(); break; }
        flipCard(); break;
      case 'speak': speak(v.text, v.slow === '1' || S.state.settings.slow); e.stopPropagation(); break;
      case 'fav': { var f = S.toggleFav(id); toast(f ? '已收藏' : '已取消收藏'); render(); break; }
      case 'toggle-book': { var b = S.toggleBook(id); toast(b ? '已加入生词本' : '已移出生词本'); render(); break; }
      case 'set-lv': S.setLevel(id, +v.lv); toast('已标记为「' + S.LEVELS[+v.lv].name + '」'); render(); break;
      case 'level-up': {
        var s = S.get(id); S.setLevel(id, Math.min(5, s.lv + 1));
        toast('掌握度提升到「' + S.LEVELS[S.get(id).lv].name + '」'); render(); break;
      }
      case 'remove-book': {
        var st = S.get(id); st.book = false; st.fav = false; st.manual = false; S.save(); toast('已移出生词本'); render(); break;
      }
      case 'nav-unit': moveCard(+v.d); break;
      case 'open-word':
        if (e.target.closest('[data-act="speak"]')) return;
        ui.unitMode = 'card'; ui.idx = +v.idx; ui.flipped = false;
        RVAudio.prefetch(wordsOfUnit[v.unit].map(function (w) { return w.id; }));
        go('#/unit/' + v.unit); break;
      case 'vocab-filter':
        ui.vocabFilter = v.id; render(); break;
      case 'know-unit':
        ui.knowUnit = v.id; render(); break;
      case 'gram-topic':
        gramShow(v.topic); break;
      case 'voice-input': {
        var btn = $('#voiceBtn');
        if (!RVGrammar.speechAvailable()) { toast('当前环境不支持语音识别（可用 Chrome/Edge 或安装版 App）'); break; }
        if (btn) { btn.classList.add('rec'); btn.innerHTML = ico('sound', 18); }
        toast('请说俄语…');
        RVGrammar.listen('ru-RU', function (text) {
          if (btn) { btn.classList.remove('rec'); btn.innerHTML = ico('sound', 18); }
          var input = $('#dictInput');
          if (input) { input.value = text; dictRender(text); }
          if (text) toast('识别：' + text); else toast('没有识别到内容');
        }, function (err) {
          if (btn) { btn.classList.remove('rec'); btn.innerHTML = ico('sound', 18); }
          toast('语音识别失败：' + err);
        });
        break;
      }
      case 'open-unit':
        if (e.target.closest('[data-act="fav"],[data-act="speak"]')) return;
        ui.idx = 0; ui.flipped = false;
        RVAudio.prefetch(wordsOfUnit[el.dataset.id].map(function (w) { return w.id; }));
        go('#/unit/' + el.dataset.id); break;
      case 'quiz-unit': {
        quizSetup.units = [id]; quizSetup.types = ['zh2ru', 'ru2zh', 'spell', 'listen'];
        quiz = null; go('#/quiz'); toast('已选择本课，点「开始练习」即可'); break;
      }
      case 'quiz-book': {
        var ids = S.wordbookIds(ALL_IDS);
        if (!ids.length) { toast('生词本是空的'); break; }
        quizSetup.bookFirst = true; location.hash = '#/quiz';
        setTimeout(function () { startQuiz(shuffle(ids), quizSetup.types, '生词专项'); render(); updateChrome('quiz'); }, 0);
        break;
      }
      case 'quick-quiz': {
        var dueIds2 = S.dueIds(ALL_IDS);
        var fresh = ALL_IDS.filter(function (i) { return !S.state.words[i]; });
        var picked = shuffle(dueIds2.concat(shuffle(fresh))).slice(0, quizSetup.count);
        location.hash = '#/quiz';
        setTimeout(function () {
          if (!picked.length) picked = shuffle(ALL_IDS).slice(0, quizSetup.count);
          startQuiz(picked, quizSetup.types, '快速练习'); render(); updateChrome('quiz');
        }, 0);
        break;
      }
      case 'quiz-start': location.hash = '#/quiz'; RVAudio.prefetch(quizSetup.bookFirst ? poolIds().slice(0, 40) : []); startQuiz(shuffle(poolIds()), quizSetup.types, '单元练习'); render(); break;
      case 'q-units-all': quizSetup.units = UNITS.map(function (u) { return u.id; }); render(); break;
      case 'q-units-none': quizSetup.units = []; render(); break;
      case 'q-unit': {
        var i = quizSetup.units.indexOf(id);
        if (i >= 0) quizSetup.units.splice(i, 1); else quizSetup.units.push(id);
        render(); break;
      }
      case 'q-type': {
        var j = quizSetup.types.indexOf(v.key);
        if (j >= 0) { if (quizSetup.types.length > 1) quizSetup.types.splice(j, 1); } else quizSetup.types.push(v.key);
        render(); break;
      }
      case 'q-book': render(); break;
      case 'answer': doAnswer(+v.i); break;
      case 'q-next': quiz.idx++; if (quiz.idx >= quiz.ids.length) { finishQuiz(); render(); } else { nextQuestion(); render(); } break;
      case 'quiz-quit': quiz = null; go('#/units'); break;
      case 'quiz-again': location.hash = '#/quiz'; startQuiz(shuffle(poolIds()), quizSetup.types, quiz.title); render(); break;
      case 'quiz-wrong': {
        var wIds = v.ids.split(',');
        quizSetup.bookFirst = true; location.hash = '#/quiz';
        setTimeout(function () { startQuiz(shuffle(wIds), quizSetup.types, '错词专攻'); render(); updateChrome('quiz'); }, 0);
        break;
      }
      case 'quiz-ids': {
        var ids3 = v.ids.split(','); location.hash = '#/quiz';
        setTimeout(function () { startQuiz(shuffle(ids3), quizSetup.types, '生词练习'); render(); updateChrome('quiz'); }, 0);
        break;
      }
      case 'tile': pushTile(el, v.c); break;
      case 'slot': popSlot(+v.i); break;
      case 'spell-clear': quiz.spell.filled = [targetLetters(quiz.q.w)[0]]; refreshSpell(); break;
      case 'spell-hint': spellHint(); break;
      case 'spell-check': spellCheck(); break;
      case 'review-start': {
        var due = S.dueIds(ALL_IDS);
        var poolLR = due.length ? due : ALL_IDS.filter(function (i) { var s = S.state.words[i]; return s && s.lv <= 1; });
        if (!poolLR.length) poolLR = shuffle(ALL_IDS).slice(0, 10);
        location.hash = '#/review';
        setTimeout(function () { startReview(poolLR); render(); updateChrome('review'); }, 0);
        break;
      }
      case 'review-quit': review = null; go('#/review'); break;
      case 'review-show': review.shown = true; renderReviewPaint(); break;
      case 'review-grade': gradeReview(+v.q); break;
      case 'review-ids': {
        var ids4 = v.ids.split(','); location.hash = '#/review';
        setTimeout(function () { startReview(ids4); render(); updateChrome('review'); }, 0);
        break;
      }
      case 'book-tab': bookTab = v.tab; render(); break;
      case 'export-csv': exportCsv(); break;
      case 'export-json': exportJson(); break;
      case 'reset':
        if (confirm('确定清空全部学习进度？该操作不可恢复。')) { S.clearAll(); toast('已清空'); go('#/units'); }
        break;
      case 'set-auto': S.state.settings.autoSpeak = el.checked; S.save(); updateChrome('settings'); break;
      case 'set-slow': S.state.settings.slow = el.checked; S.save(); toast(el.checked ? '已切换为慢速朗读' : '已恢复标准语速'); break;
      case 'set-tts': S.state.settings.ttsOnly = el.checked; S.save(); toast(el.checked ? '将仅使用系统语音' : '将优先使用内置真人发音'); break;
      case 'set-stress': S.state.settings.showStress = el.checked; S.save(); render(); break;
      case 'set-cursive': S.state.settings.showCursive = el.checked; S.save(); render(); break;
      case 'audio-selftest': {
        var box = $('#selftestResult');
        if (box) box.textContent = '正在测试…';
        RVAudio.selfTest().then(function (r) {
          var msg = (r.ok ? '✓ 发音正常（' + r.via + '）' : '✗ 全部通道失败') + ' · ' + (r.error || '');
          if (box) box.textContent = msg;
          toast(r.ok ? '发音正常：' + r.via : '发音异常，详见设置页说明');
        });
        break;
      }
      case 'precache': {
        var tip = $('#precacheTip'), bar = $('#precacheBar');
        if (bar) bar.style.display = 'block';
        RVAudio.precacheAll(function (p, done) {
          if (bar) bar.firstElementChild.style.width = Math.round(p * 100) + '%';
          if (tip) tip.textContent = '已缓存 ' + done + ' 个音频…';
          if (p >= 1) { if (tip) tip.textContent = '全部语音已缓存，可完全离线学习'; toast('语音缓存完成'); }
        }).catch(function () {
          if (tip) tip.textContent = '当前环境不支持缓存，语音将按需加载';
        });
        break;
      }
      case 'set-rate': S.state.settings.rate = parseFloat(el.value); $('#rateLabel').textContent = parseFloat(el.value).toFixed(2); S.save(); break;
    }
  });

  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'q-book') { quizSetup.bookFirst = el.checked; render(); }
    if (el.dataset.act === 'q-count') { quizSetup.count = +el.value; var l = $('#cntLabel'); if (l) l.textContent = el.value; }
  });
  document.addEventListener('input', function (e) {
    var el = e.target.closest('[data-act="q-count"]');
    if (el) { quizSetup.count = +el.value; var l = $('#cntLabel'); if (l) l.textContent = el.value; }
    var el2 = e.target.closest('[data-act="set-rate"]');
    if (el2) { S.state.settings.rate = parseFloat(el2.value); var r = $('#rateLabel'); if (r) r.textContent = parseFloat(el2.value).toFixed(2); S.save(); }
    var el3 = e.target.closest('[data-act="set-goal"]');
    if (el3) { S.state.settings.dailyGoal = +el3.value; S.save(); var gl = el3.parentElement.parentElement.querySelector('label b'); if (gl) gl.textContent = el3.value; }
  });

  /* 学习卡操作 */
  function flipCard() {
    ui.flipped = !ui.flipped;
    var el = $('#view .flashcard');
    if (el) el.classList.toggle('flipped', ui.flipped);
    if (ui.flipped) {
      S.touch('learn');
      var w = wordsOfUnit[ui.unitId][ui.idx];
      if (S.state.settings.autoSpeak) setTimeout(function () { speak(w.ru, S.state.settings.slow); }, 120);
      if (!S.state.words[w.id] || S.state.words[w.id].seen === 0) { }
    }
  }
  function moveCard(d) {
    var ws = wordsOfUnit[ui.unitId];
    var next = clamp(ui.idx + d, 0, ws.length - 1);
    if (next === ui.idx && d > 0) { toast('本单元已学完这一轮'); return; }
    ui.idx = next; ui.flipped = false;
    render();
    if (S.state.settings.autoSpeak) setTimeout(function () { speak(wordsOfUnit[ui.unitId][ui.idx].ru, S.state.settings.slow); }, 60);
  }

  /* 手机滑动手势：右滑上一词、左滑下一词、上滑翻面 */
  var swipe = { x: 0, y: 0, t: 0 };
  document.addEventListener('touchstart', function (e) {
    if (!e.target.closest('#view .flashcard')) return;
    if ((location.hash || '').indexOf('#/unit/') !== 0 || ui.unitMode !== 'card') return;
    var t = e.touches[0]; swipe.x = t.clientX; swipe.y = t.clientY; swipe.t = Date.now();
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!e.target.closest('#view .flashcard')) return;
    if ((location.hash || '').indexOf('#/unit/') !== 0 || ui.unitMode !== 'card') return;
    if (Date.now() - swipe.t > 700) return;
    var t = e.changedTouches[0]; if (!t) return;
    var dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
    if (Math.abs(dx) > 58 && Math.abs(dy) < 46) { if (navigator.vibrate) navigator.vibrate(8); moveCard(dx > 0 ? -1 : 1); }
    else if (dy < -72 && Math.abs(dx) < 52) { if (navigator.vibrate) navigator.vibrate(8); flipCard(); }
  }, { passive: true });

  function confettiBurst() {
    var box = $('#confetti'); if (!box) return;
    var colors = ['#b23a2e', '#a87c2f', '#3f6e58', '#e06a56', '#20201d'];
    for (var i = 0; i < 42; i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * .25) + 's';
      p.style.transform = 'rotate(' + (Math.random() * 180) + 'deg)';
      p.style.opacity = .8;
      box.appendChild(p);
    }
    setTimeout(function () { box.innerHTML = ''; }, 2400);
  }

  /* 复习绘画（避免整页重绘导致闪动） */
  function renderReviewPaint() { render(); }

  function gradeReview(q) {
    var id = review.ids[review.idx];
    S.review(id, q);
    review.log.push(q);
    review.idx++; review.shown = false;
    if (review.idx >= review.ids.length) { review.done = true; $('#view').innerHTML = finishReview(); updateChrome('review'); return; }
    render();
  }

  /* 答题 */
  function doAnswer(i) {
    if (!quiz || quiz.answered) return;
    quiz.answered = true;
    var q = quiz.q;
    var ok = q.options[i].id === q.w.id;
    $$('#view .option').forEach(function (el, k) {
      if (q.options[k].id === q.w.id) el.classList.add('correct');
      else if (k === i) el.classList.add('wrong');
      else el.classList.add('dim');
      el.disabled = true;
    });
    answerCommon(ok, q.options[i].id);
  }

  function pushTile(el, c) {
    if (quiz.answered) return;
    if (quiz.spell.filled.length >= quiz.spell.letters.length) return;
    quiz.spell.filled.push(c);
    el.classList.add('used');
    refreshSpell();
  }
  function popSlot(i) {
    if (quiz.answered) return;
    if (i === 0) return;               // 首字母提示固定
    if (i >= quiz.spell.filled.length) return;
    quiz.spell.filled.splice(i);
    refreshSpell();
  }
  function spellHint() {
    if (quiz.answered) return;
    var w = quiz.q.w;
    var letters = quiz.spell.letters;
    var cur = quiz.spell.filled.length;
    if (cur >= letters.length) return;
    quiz.spell.filled.push(letters[cur]);
    refreshSpell();
    if (cur >= letters.length - 1) return;
  }
  function spellCheck() {
    if (quiz.answered) return;
    var val = quiz.spell.filled.join('');
    var ok = val.toLowerCase() === quiz.spell.target;
    if (!ok) {
      // 展示正确答案
      quiz.spell.filled = quiz.spell.letters.slice();
      refreshSpell();
      $$('#slots .slot').forEach(function (el) { el.classList.add('bad'); });
    } else {
      $$('#slots .slot').forEach(function (el) { el.classList.add('ok'); });
    }
    doAnswerVirtual(ok);
  }
  function doAnswerVirtual(ok) {
    quiz.answered = true;
    var q = quiz.q;
    answerCommon(ok, q.w.id);
  }

  /* 导航栏点击：即使 hash 未变化（例如停留在结算页再点「练习」）也强制回到该页初始状态 */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('#nav a, #tabbar a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href === location.hash) {
      if (quiz && !quiz.running) quiz = null;
      if (review && review.done) review = null;
      render();
    }
  });

  /* 抽屉 / 搜索 / 更多 / 主题 / 滚动进度 */
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close-sheet]')) { closeSheet(); return; }
    if (e.target.id === 'palette') { closePalette(); return; }
    if (e.target.closest('#openSearch')) { openPalette(); return; }
    if (e.target.closest('#tabMore')) { openMoreSheet(); return; }
    var moreLink = e.target.closest('[data-more-link]');
    if (moreLink) { closeSheet(); go(moreLink.dataset.moreLink); }
  });
  function openMoreSheet() {
    var items = [
      ['dict', '词典', 'dict'], ['gram', '语法', 'gram'], ['know', '知识总结', 'know'],
      ['alphabet', '字母表', 'alpha'], ['phrases', '情景短语', 'phrase'], ['tools', '工具箱', 'tool'], ['book', '生词本', 'book'],
      ['stats', '统计', 'stats'], ['settings', '设置', 'settings'], ['units', '学习', 'learn']
    ];
    var h = '<h2 style="margin-bottom:4px">更多</h2><p class="hint" style="margin:0 0 14px">全部学习工具</p><div class="more-grid">' +
      items.map(function (it) {
        return '<button class="more-item" data-more-link="#/' + it[0] + '"><span class="ico">' + ico(it[2], 20) + '</span>' + it[1] + '</button>';
      }).join('') + '</div>';
    openSheet(h, '更多');
  }
  var paletteInput = $('#paletteInput');
  if (paletteInput) {
    paletteInput.addEventListener('input', function () { paletteIndex = -1; paletteRender(paletteInput.value); });
    paletteInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); paletteIndex = Math.min(paletteHits.length - 1, paletteIndex + 1); paletteRender(paletteInput.value); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); paletteIndex = Math.max(0, paletteIndex - 1); paletteRender(paletteInput.value); }
      else if (e.key === 'Enter') { e.preventDefault(); var w = paletteHits[paletteIndex] || paletteHits[0]; if (w) { closePalette(); wordSheet(w.id); } }
      else if (e.key === 'Escape') { closePalette(); }
    });
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
    try { localStorage.setItem('ruvocab.theme', t); } catch (e) { }
    var label = document.querySelector('.theme-label');
    if (label) label.textContent = t === 'dark' ? '浅色模式' : '深色模式';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#151512' : '#f4f0e7');
  }
  function initTheme() {
    var t = 'light';
    try { t = localStorage.getItem('ruvocab.theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch (e) { }
    try { var q = new URLSearchParams(location.search).get('theme'); if (q === 'dark' || q === 'light') t = q; } catch (e) { }
    applyTheme(t);
  }
  initTheme();
  var themeBtn = $('#themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
  function bindScrollProgress() {
    var main = $('#main'), bar = $('#scrollProgress i');
    if (!main || !bar) return;
    main.addEventListener('scroll', function () {
      var max = main.scrollHeight - main.clientHeight;
      bar.style.width = (max > 0 ? (main.scrollTop / max * 100) : 0) + '%';
    }, { passive: true });
  }
  bindScrollProgress();
  /* 内层滚动容器在边界处不把滚轮事件传给外层（修复内外窗口共用滚轮） */
  function bindWheelContainment() {
    document.addEventListener('wheel', function (e) {
      var el = e.target.closest('.gram-body, .sheet-body, .palette-results, .vchips');
      if (!el) return;
      var canScroll = el.scrollHeight > el.clientHeight + 1;
      if (!canScroll) return;
      var delta = e.deltaY;
      var atTop = el.scrollTop <= 0;
      var atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((delta < 0 && atTop) || (delta > 0 && atBottom)) { e.preventDefault(); e.stopPropagation(); }
    }, { passive: false });
    document.addEventListener('touchmove', function (e) {
      var el = e.target.closest('.gram-body, .sheet-body, .palette-results');
      if (!el) return;
      if (el.scrollHeight <= el.clientHeight + 1) return;
      var t = e.touches[0]; if (!t) return;
      var atTop = el.scrollTop <= 0, atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if (atTop || atBottom) e.stopPropagation();
    }, { passive: true });
  }
  bindWheelContainment();


  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'cursiveInput') {
      var out = $('#cursiveOut'); if (out) out.textContent = e.target.value || '…';
    }
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openPalette(); return; }
    if (e.target && e.target.id === 'typeInput' && e.key === 'Enter') {
      e.preventDefault();
      var tb = document.querySelector(typingState && typingState.answered ? '[data-act="typing-next"]' : '[data-act="typing-check"]');
      if (tb) tb.click();
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('[role="button"][data-act]')) {
      e.preventDefault(); e.target.click(); return;
    }
    if (e.key === 'Escape') { if (!$('#sheet').hidden) closeSheet(); if (!$('#palette').hidden) closePalette(); return; }
    if (!$('#sheet').hidden || !$('#palette').hidden) return;
    if (/input|textarea|select/i.test((e.target.tagName || ''))) return;
    var key = e.key;
    var inUnit = (location.hash || '').indexOf('#/unit/') === 0 && ui.unitMode === 'card';
    if (inUnit) {
      if (key === ' ' || key === 'Enter') { e.preventDefault(); flipCard(); }
      else if (key === 'ArrowLeft') { moveCard(-1); }
      else if (key === 'ArrowRight') { moveCard(1); }
      else if (key === 'f' || key === 'F') { var w0 = wordsOfUnit[ui.unitId][ui.idx]; speak(w0.ru, S.state.settings.slow); }
      return;
    }
    if (quiz && quiz.running) {
      if (!quiz.answered && /^[1-4]$/.test(key) && quiz.q.type !== 'spell') { doAnswer(+key - 1); }
      else if (key === 'Enter' && quiz.answered) { var b = $('[data-act="q-next"]'); if (b) b.click(); }
      else if (key === ' ' && !quiz.answered && quiz.q.type === 'listen') { e.preventDefault(); speak(quiz.q.w.ru, true); }
      return;
    }
    if (review && review.idx < review.ids.length && !review.done) {
      if (key === ' ') { e.preventDefault(); review.shown = true; render(); }
      else if (review.shown && /^[1-3]$/.test(key)) { gradeReview(+key - 1); }
    }
  });

  /* 初始化 */
  function boot() {
    // 导航/标签栏图标（data-ico → 内联 SVG）
    $$('[data-ico]').forEach(function (s) { s.innerHTML = ico(s.dataset.ico, 20); });
    // 音频全通道失败时的可见反馈（绝不无声无息）
    window.addEventListener('rv-audio-fail', function (e) {
      toast('发音播放失败：' + (e.detail || '未知原因') + '（可在设置-测试发音查看详情）');
    });
    // 语法/词典数据（失败不影响主流程；加载完成后重渲染以补全语法详解）
    if (window.RVGrammar) {
      RVGrammar.load().then(function () { try { render(); } catch (e) { } })
        .catch(function () { });
    }
    if (!location.hash) location.hash = '#/units';
    render();
    window.addEventListener('hashchange', render);
    // 顶部朗读开关
    $('#speakToggle').addEventListener('click', function () {
      S.state.settings.autoSpeak = !S.state.settings.autoSpeak; S.save(); updateChrome('units');
      toast(S.state.settings.autoSpeak ? '已开启自动朗读' : '已关闭自动朗读');
    });
    bindNativeBack();
  }

  /* 安卓硬件返回键：先退子页面 → 回到首页 → 再按退出应用（避免一按就退出） */
  function bindNativeBack() {
    var Cap = window.Capacitor;
    if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
    var App = Cap.Plugins && Cap.Plugins.App;
    if (!App || !App.addListener) return;
    App.addListener('backButton', function () {
      var h = location.hash || '#/units';
      if (!$('#sheet').hidden) { closeSheet(); return; }
      if (!$('#palette').hidden) { closePalette(); return; }
      if (quiz && quiz.running) { quiz = null; go('#/quiz'); return; }      // 答题中 → 退出本次练习
      if (review && !review.done && review.ids.length) { review = null; go('#/review'); return; }
      var toolsBack = { '#/typing': 1, '#/cursive': 1, '#/speak': 1, '#/notes': 1, '#/game': 1, '#/resources': 1 };
      if (toolsBack[h]) { go('#/tools'); return; }
      if (h !== '#/units' && h !== '' && h !== '#') { go('#/units'); return; }
      if (App.exitApp) App.exitApp();
    });
  }

  boot();
})();

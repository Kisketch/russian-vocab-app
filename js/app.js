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
    back: '<path d="M20 12H4"/><path d="M10 6l-6 6 6 6"/>'
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
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" class="ring">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="#e5e8ee" stroke-width="4"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="#3f6f96" stroke-width="4" ' +
      'stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) +
      '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      (label ? '<text x="50%" y="50%" text-anchor="middle" dy="4" font-size="11" fill="#7b8493">' + label + '</text>' : '') +
      '</svg>';
  }

  /* ---------------- 界面骨架状态 ---------------- */
  var ui = { unitMode: 'card', unitId: null, idx: 0, flipped: false };
  var quiz = null, review = null;

  var TITLES = {
    units: ['学习', '按《走遍俄罗斯》教材单元浏览单词'],
    unit: ['单元学习', '单词卡片 · 翻转与例句'],
    quiz: ['练习', '四类题型即时反馈'],
    review: ['复习', '间隔重复 · 到期队列'],
    book: ['生词本', '错词自动收录与收藏'],
    stats: ['学习统计', '每日学习量与正确率'],
    settings: ['设置', '朗读、数据与关于']
  };

  function updateChrome(key, sub) {
    var t = TITLES[key] || TITLES.units;
    $('#pageTitle').textContent = t[0];
    $('#pageSub').textContent = sub || t[1];
    $$('#nav a, #tabbar a').forEach(function (a) { a.classList.toggle('active', a.dataset.key === key); });

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
    var h = '';
    h += '<div class="hero">' +
      '<div class="hero-text">' +
      '<h2>' + (dueN ? '今天有 ' + dueN + ' 个单词到期复习' : '开始今天的学习') + '</h2>' +
      '<p>' + esc(D.meta.book) + ' · 共 ' + UNITS.length + ' 课 / ' + WORDS.length + ' 词</p>' +
      '</div>' +
      '<div class="hero-stats">' +
      '<div class="hero-stat"><b>' + S.viewsToday() + '</b><span>今日接触词</span></div>' +
      '<div class="hero-stat"><b>' + (t.quiz ? Math.round(t.correct / t.quiz * 100) + '%' : '—') + '</b><span>练习正确率</span></div>' +
      '<div class="hero-stat"><b>' + learned + '</b><span>已学词数</span></div>' +
      '<div class="hero-stat"><b>' + S.streakDays() + '</b><span>连续天数</span></div>' +
      '</div>' +
      '<div class="actions">' +
      '<button class="btn primary" data-act="review-start">' + ico('review', 16) + ' ' + (dueN ? '开始复习' : '复习临近词') + '</button>' +
      '<button class="btn" data-act="quick-quiz">' + ico('quiz', 16) + ' 快速练习</button>' +
      '</div></div>';

    h += '<div class="section"><div class="section-head"><h2>教材单元</h2><span>' + esc(D.meta.note) + '</span></div>';
    h += '<div class="unit-grid">';
    UNITS.forEach(function (u) {
      var st = unitStat(u);
      h += '<div class="card unit" data-act="open-unit" data-id="' + u.id + '" tabindex="0" role="button">' +
        '<div class="unit-top">' +
        '<div class="unit-no">' + u.no + '</div>' +
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
        '<div class="scene">' + Sc.get(w.scene) + '<span class="scene-cap">' + esc(caption(w)) + '</span></div>' +
        '<div class="body-part">' +
        '<div class="word-row"><div class="ru">' + esc(ruText(w)) + '</div>' +
        '<button class="speak" data-act="speak" data-text="' + esc(w.ru) + '" aria-label="朗读">' + ico('sound', 19) + '</button></div>' +
        '<div class="pos">' + esc(w.pos) + '</div>' +
        '<div class="hint-flip tail">点击卡片 / 按空格翻转查看释义与例句</div>' +
        '</div></div>' +
        // 背面
        '<div class="face back">' +
        '<div class="body-part">' +
        '<div style="display:flex;gap:12px;align-items:center">' +
        '<div class="thumb" style="width:78px;height:58px;flex:0 0 78px">' + Sc.get(w.scene) + '</div>' +
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
    return '<div class="word-row-item">' +
      '<span class="row-index">' + (i + 1) + '</span>' +
      '<div class="thumb">' + Sc.get(w.scene) + '</div>' +
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
    var bookN = S.wordbookIds(ALL_IDS).length;
    var h = '<div class="quiz"><div class="card" style="padding:18px">';
    h += '<div class="section-head"><h2>练习设置</h2><span>即时反馈，错题自动进生词本</span></div>';
    h += '<div class="field"><label>范围：单元多选</label><div class="picker">' +
      '<button class="pick' + (quizSetup.units.length === UNITS.length ? ' on' : '') + '" data-act="q-units-all">全部</button>' +
      '<button class="pick" data-act="q-units-none">清空</button>';
    UNITS.forEach(function (u) {
      h += '<button class="pick' + (quizSetup.units.indexOf(u.id) >= 0 ? ' on' : '') + '" data-act="q-unit" data-id="' + u.id + '">' +
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
      var alt = quiz.types.filter(function (x) { return x !== 'spell'; });
      type = alt.length ? pickOne(alt) : 'zh2ru';
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
      h += '<div class="q-scene">' + Sc.get(w.scene) + '</div>';
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
      h += '<div class="q-scene">' + Sc.get(w.scene) + '</div>';
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
    // 标记已用字母（按数量）
    var used = quiz.spell.filled.slice();
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
        h += '<div class="word-row-item"><div class="thumb">' + Sc.get(w.scene) + '</div>' +
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
      '<div class="scene">' + Sc.get(w.scene) + '<span class="scene-cap">' + esc(caption(w)) + '</span></div>' +
      '<div class="body-part">' +
      '<div class="word-row"><div class="ru">' + esc(ruText(w)) + '</div>' +
      '<button class="speak" data-act="speak" data-text="' + esc(w.ru) + '">' + ico('sound', 19) + '</button></div>' +
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
        h += '<div class="word-row-item">' +
          '<div class="thumb">' + Sc.get(w.scene) + '</div>' +
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

  /* ---------------- 视图：设置 ---------------- */
  function renderSettings() {
    var st = S.state.settings;
    var h = '<div class="study-wrap"><div class="card" style="padding:18px">';
    h += '<div class="section-head"><h2>学习与朗读</h2></div>';
    h += '<label class="switch"><input type="checkbox" data-act="set-auto" ' + (st.autoSpeak ? 'checked' : '') + '><span class="track"></span>卡片出现时自动朗读俄语</label>';
    h += '<label class="switch"><input type="checkbox" data-act="set-slow" ' + (st.slow ? 'checked' : '') + '><span class="track"></span>慢速朗读（约 0.8 倍速，适合跟读）</label>';
    h += '<label class="switch"><input type="checkbox" data-act="set-tts" ' + (st.ttsOnly ? 'checked' : '') + '><span class="track"></span>仅使用系统语音（不读内置真人发音）</label>';
    var stressed = WORDS.filter(function (w) { return w.ru_stress && w.ru_stress !== w.ru; }).length;
    h += '<label class="switch"><input type="checkbox" data-act="set-stress" ' + (st.showStress === false ? '' : 'checked') + '><span class="track"></span>显示重音符号' +
      '<span class="hint" style="margin-left:6px">已标注 ' + stressed + ' / ' + WORDS.length + ' 词</span></label>';
    h += '<div class="field" style="max-width:340px"><label>朗读语速：<b id="rateLabel">' + st.rate.toFixed(2) + '</b></label>' +
      '<input type="range" min="0.5" max="1.2" step="0.05" value="' + st.rate + '" data-act="set-rate"></div>';

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
    updateChrome(key === 'unit' ? 'units' : key, sub);
    window.scrollTo({ top: 0 });
  }

  function go(hash) { location.hash = hash; }

  /* ---------------- 事件委托 ---------------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.dataset.act, id = el.dataset.id, v = el.dataset;
    switch (act) {
      case 'go': go(v.hash); break;
      case 'goto-card': ui.unitMode = 'card'; ui.idx = +v.idx; ui.flipped = false; render(); break;
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

  /* 键盘快捷键 */
  document.addEventListener('keydown', function (e) {
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
      if (quiz && quiz.running) { quiz = null; go('#/quiz'); return; }      // 答题中 → 退出本次练习
      if (review && !review.done && review.ids.length) { review = null; go('#/review'); return; }
      if (h !== '#/units' && h !== '' && h !== '#') { go('#/units'); return; }
      if (App.exitApp) App.exitApp();
    });
  }

  boot();
})();

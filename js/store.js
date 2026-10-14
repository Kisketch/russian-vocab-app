/* 状态层：localStorage 持久化 + 轻量 SM-2 间隔重复调度 */
(function () {
  'use strict';

  var KEY = 'ruvocab.state.v1';

  /* 掌握度等级：0 生词 → 5 精通 */
  var LEVELS = [
    { name: '生词', en: 'again', gap: 0, cls: 'lv0' },
    { name: '模糊', en: 'hard', gap: 10 * 60 * 1000, cls: 'lv1' },
    { name: '认识', en: 'good', gap: 60 * 60 * 1000, cls: 'lv2' },
    { name: '熟悉', en: 'ok', gap: 24 * 60 * 60 * 1000, cls: 'lv3' },
    { name: '掌握', en: 'solid', gap: 3 * 24 * 60 * 60 * 1000, cls: 'lv4' },
    { name: '精通', en: 'master', gap: 7 * 24 * 60 * 60 * 1000, cls: 'lv5' }
  ];
  var MASTER_GAP = 15 * 24 * 60 * 60 * 1000; // 已到精通，再次答对后延长到 15 天

  var state = {
    words: {},      // id -> { lv, due, seen, right, wrong, streak, book, manual, fav, last }
    daily: {},      // 'YYYY-MM-DD' -> { learn, views, quiz, correct, wrong, newWords, review, revGood, revHard, revForget }
    views: { date: '', ids: [] },   // 当日接触过的词（去重）
    settings: { rate: 0.85, autoSpeak: true, slow: false, ttsOnly: false, showStress: true, showCursive: true },
    createdAt: Date.now()
  };

  function todayKey(ts) {
    var d = ts ? new Date(ts) : new Date();
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        state.words = s.words || {};
        state.daily = s.daily || {};
        state.views = s.views || { date: '', ids: [] };
        state.settings = Object.assign(state.settings, s.settings || {});
        state.createdAt = s.createdAt || Date.now();
      }
    } catch (e) { /* 忽略损坏数据，使用默认状态 */ }
  }

  var saveTimer = null;
  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { }
    }, 120);
  }

  function get(id) {
    var w = state.words[id];
    if (!w) {
      w = { lv: 0, due: 0, seen: 0, right: 0, wrong: 0, streak: 0, book: false, manual: false, fav: false, last: 0 };
      state.words[id] = w;
    }
    if (w.manual === undefined) w.manual = false;
    return w;
  }

  function blank() { return { learn: 0, views: 0, quiz: 0, correct: 0, wrong: 0, newWords: 0, review: 0, revGood: 0, revHard: 0, revForget: 0 }; }

  function touch(kind, n) {
    var k = todayKey();
    var d = state.daily[k] || (state.daily[k] = blank());
    d[kind] = (d[kind] || 0) + (n === undefined ? 1 : n);
    save();
    return d;
  }

  /* 记录「今天看过这个词」（去重），用于“今日接触词数” */
  function view(id) {
    var k = todayKey();
    if (!state.views || state.views.date !== k) state.views = { date: k, ids: [] };
    if (state.views.ids.indexOf(id) < 0) {
      state.views.ids.push(id);
      touch('views');
      return true;
    }
    return false;
  }

  function viewsToday() {
    var k = todayKey();
    var d = state.daily[k];
    return (d && d.views) || 0;
  }

  /* 答题回调：ok 是否答对（仅用于客观题，复习自评走 review()） */
  function answer(id, ok) {
    var w = get(id);
    var now = Date.now();
    if (w.seen === 0) touch('newWords');
    w.seen++; w.last = now;
    if (ok) {
      w.right++; w.streak++;
      w.lv = Math.min(LEVELS.length - 1, w.lv + 1);
      if (w.lv >= 3 && !w.manual) w.book = false;   // 手动收藏的词不移除
    } else {
      w.wrong++; w.streak = 0;
      w.lv = 0;
      w.book = true;                       // 错词自动进生词本
      touch('wrong');
    }
    w.due = now + (w.lv === LEVELS.length - 1 && w.streak > 1 ? MASTER_GAP : LEVELS[w.lv].gap);
    touch('quiz');
    if (ok) touch('correct');
    save();
    return w;
  }

  /* 复习自评：0 忘了 / 1 模糊 / 2 清楚 —— 计入复习统计，不计入练习正确率 */
  function review(id, quality) {
    var w = get(id);
    if (quality === 0) {
      w.lv = 0; w.wrong++; w.book = true; touch('wrong'); touch('revForget');
    } else if (quality === 1) {
      w.lv = Math.max(0, w.lv - 1);
      if (w.lv < 3) w.book = true;          // 手动标记的词保持
      w.book = w.manual ? true : w.book;
      touch('revHard');
    } else {
      w.right++; w.streak++;
      w.lv = Math.min(LEVELS.length - 1, w.lv + 1);
      if (w.lv >= 3 && !w.manual) w.book = false;
      touch('revGood');
    }
    w.last = Date.now();
    w.due = Date.now() + (w.lv === LEVELS.length - 1 && w.streak > 1 ? MASTER_GAP : LEVELS[w.lv].gap);
    touch('review');
    save();
    return w;
  }

  function setLevel(id, lv) {
    var w = get(id);
    w.lv = Math.max(0, Math.min(LEVELS.length - 1, lv));
    w.due = Date.now() + LEVELS[w.lv].gap;
    save(); return w;
  }

  function toggleFav(id) { var w = get(id); w.fav = !w.fav; save(); return w.fav; }
  function toggleBook(id) {
    var w = get(id);
    w.book = !w.book;
    w.manual = w.book;          // 手动加入的词不会被自动移除
    save();
    return w.book;
  }

  function dueIds(allIds) {
    var now = Date.now();
    return allIds.filter(function (id) {
      var w = state.words[id];
      return w && w.lv > 0 && w.due <= now;
    }).sort(function (a, b) { return state.words[a].due - state.words[b].due; });
  }

  function wordbookIds(allIds) {
    return allIds.filter(function (id) {
      var w = state.words[id];
      return w && (w.book || w.fav);
    });
  }

  function learnedIds(allIds) {
    return allIds.filter(function (id) { return state.words[id] && state.words[id].lv > 0; });
  }

  /* 最近 N 天的统计序列 */
  function series(days) {
    days = days || 14;
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var ts = Date.now() - i * 86400000;
      var k = todayKey(ts);
      var d = state.daily[k] || blank();
      var t = new Date(ts);
      out.push({
        key: k, label: (t.getMonth() + 1) + '/' + t.getDate(),
        learn: d.learn || 0, views: d.views || 0, quiz: d.quiz || 0, correct: d.correct || 0, wrong: d.wrong || 0,
        newWords: d.newWords || 0, review: d.review || 0,
        revGood: d.revGood || 0, revHard: d.revHard || 0, revForget: d.revForget || 0,
        acc: d.quiz ? Math.round((d.correct || 0) / d.quiz * 100) : null
      });
    }
    return out;
  }

  function streakDays() {
    var n = 0;
    for (var i = 0; i < 400; i++) {
      var ts = Date.now() - i * 86400000;
      var k = todayKey(ts);
      var d = state.daily[k];
      var active = d && (d.learn + d.quiz + d.review > 0);
      if (active) n++;
      else if (i > 0) break;
      else if (i === 0) continue; // 今天还没开始，不计断
    }
    return n;
  }

  function clearAll() {
    state.words = {}; state.daily = {}; state.views = { date: '', ids: [] }; state.createdAt = Date.now();
    try { localStorage.removeItem(KEY); } catch (e) { }
  }

  load();

  window.RVStore = {
    LEVELS: LEVELS,
    state: state,
    save: save,
    get: get,
    answer: answer,
    review: review,
    view: view,
    viewsToday: viewsToday,
    setLevel: setLevel,
    toggleFav: toggleFav,
    toggleBook: toggleBook,
    touch: touch,
    dueIds: dueIds,
    wordbookIds: wordbookIds,
    learnedIds: learnedIds,
    series: series,
    streakDays: streakDays,
    todayKey: todayKey,
    today: function () { var k = todayKey(); return state.daily[k] || blank(); },
    clearAll: clearAll
  };
})();

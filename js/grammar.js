/* 语法与词典支撑层：加载 assets/grammar.json，提供词形查询与变形匹配 */
(function () {
  'use strict';

  var grammar = null;      // assets/grammar.json
  var D = window.RV_DATA;
  var wordIndex = {};      // ru -> 词条
  var formIndex = {};      // 变形形式 -> [词条id]
  var dictIndex = {};      // 词典 ru -> 词条列表

  (D.words || []).forEach(function (w) { wordIndex[w.ru] = w; });

  function load() {
    try {
      return fetch('assets/grammar.json').then(function (r) { return r.json(); }).then(function (g) {
        grammar = g;
        // 变形索引：任何格/人称形式都能反查到词条
        Object.keys(g.words || {}).forEach(function (id) {
          var e = g.words[id];
          var w = (D.words || []).filter(function (x) { return x.id === id; })[0];
          if (!w) return;
          formIndex[w.ru] = w;
          var gr = e.grammar || {};
          if (gr.sg) Object.keys(gr.sg).forEach(function (k) { formIndex[gr.sg[k]] = w; });
          if (gr.pl) Object.keys(gr.pl).forEach(function (k) { formIndex[gr.pl[k]] = w; });
          if (gr.present) Object.keys(gr.present).forEach(function (k) { formIndex[gr.present[k]] = w; });
          if (gr.past) Object.keys(gr.past).forEach(function (k) { formIndex[gr.past[k]] = w; });
          if (gr.imperative) formIndex[gr.imperative] = w;
        });
        // 词典索引
        (D.dict || []).forEach(function (d) {
          var key = d.ru.toLowerCase();
          (dictIndex[key] = dictIndex[key] || []).push(d);
        });
        return grammar;
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /* 综合查询：先词库 → 再变形反查 → 再内置词典 */
  function lookup(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return { words: [], dict: [] };
    var words = [], dict = [];
    if (wordIndex[q]) words.push(wordIndex[q]);
    if (formIndex[q] && words.indexOf(formIndex[q]) < 0) words.push(formIndex[q]);
    // 词典精确
    if (dictIndex[q]) dict = dictIndex[q].slice();
    // 中文检索
    var zhHits = (D.words || []).filter(function (w) { return w.zh.indexOf(q) >= 0; });
    zhHits.forEach(function (w) { if (words.indexOf(w) < 0) words.push(w); });
    // 前缀模糊（俄文输入）
    if (words.length + dict.length < 6 && /[а-яё]/.test(q)) {
      Object.keys(wordIndex).forEach(function (k) {
        if (k.indexOf(q) === 0 && words.indexOf(wordIndex[k]) < 0) words.push(wordIndex[k]);
      });
      Object.keys(dictIndex).forEach(function (k) {
        if (k.indexOf(q) === 0) dictIndex[k].forEach(function (d) { dict.push(d); });
      });
    }
    // 中文模糊
    (D.dict || []).forEach(function (d) {
      if (d.zh.indexOf(q) >= 0 && dict.indexOf(d) < 0) dict.push(d);
    });
    return { words: words.slice(0, 20), dict: dict.slice(0, 30) };
  }

  /* 语音识别（浏览器 SpeechRecognition；安卓原生由插件提供） */
  function speechAvailable() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var cap = window.Capacitor;
    var native = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.SpeechRecognition;
    return !!(SR || native);
  }

  function listen(lang, onResult, onError) {
    var cap = window.Capacitor;
    var native = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.SpeechRecognition;
    if (native) {
      return native.start({ language: lang || 'ru-RU', maxResults: 3, prompt: '请说俄语' })
        .then(function (r) {
          var list = (r.matches || []).map(function (m) { return m.trim(); });
          onResult(list[0] || '', list);
        }, function (e) { onError && onError('native:' + (e && e.message || e)); });
    }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { onError && onError('unsupported'); return null; }
    var rec = new SR();
    rec.lang = lang || 'ru-RU';
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.onresult = function (e) {
      var list = [];
      for (var i = 0; i < e.results[0].length; i++) list.push(e.results[0][i].transcript.trim());
      onResult(list[0] || '', list);
    };
    rec.onerror = function (e) { onError && onError(e.error || 'error'); };
    rec.start();
    return rec;
  }

  window.RVGrammar = {
    load: load,
    get: function (id) { return grammar && grammar.words ? grammar.words[id] : null; },
    ref: function () { return grammar ? grammar.reference : null; },
    lookup: lookup,
    speechAvailable: speechAvailable,
    listen: listen,
    counts: function () {
      return { words: (D.words || []).length, dict: (D.dict || []).length, grammar: grammar ? Object.keys(grammar.words).length : 0 };
    }
  };
})();

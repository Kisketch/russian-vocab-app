/* 音频播放层：优先播放随包分发的真人发音（MP3），缺失或被拦截时回退系统语音。
   针对移动端做了三件事：
   1) 复用 Audio 元素（避免重复创建导致的解锁失效）；
   2) 首次手势时播放一段程序生成的静音 WAV，解锁 iOS/WebView 的自动播放限制；
   3) 若仍被策略拦截，把待播内容挂起，在用户下一次点击时自动补播，并记录原因供自检。 */
(function () {
  'use strict';

  var D = window.RV_DATA, S = window.RVStore;
  var current = null;          // 当前播放的 <audio>
  var warned = false;
  var audioCache = {};         // url -> Audio（复用元素）
  var unlocked = false;        // 媒体是否已解锁
  var lastError = '';          // 最近一次播放失败原因（供自检显示）
  var pending = null;          // 被自动播放策略拦截、等待下一次手势的朗读
  var wordIndex = {}, sentIndex = {}, idIndex = {};

  (D.words || []).forEach(function (w) {
    wordIndex[w.ru] = w.id;
    sentIndex[w.ex_ru] = w.id;
    idIndex[w.id] = w;
  });

  function src(id, kind) {
    return 'assets/audio/' + (kind === 'sent' ? 'sent' : 'words') + '/' + id + '.mp3';
  }

  /* ---------- 程序生成 0.2s 静音 WAV（用于解锁媒体） ---------- */
  function silentWavUrl() {
    var rate = 8000, n = Math.floor(rate * 0.2);
    var buf = new ArrayBuffer(44 + n * 2);
    var v = new DataView(buf);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  var silentUrl = null;
  function unlockMedia() {
    if (unlocked) return;
    unlocked = true;
    try {
      if (!silentUrl) silentUrl = silentWavUrl();
      var a = new Audio(silentUrl);
      a.volume = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () { });
    } catch (e) { }
  }

  function onFirstGesture() {
    unlockMedia();
    if (pending) {
      var p = pending; pending = null;
      setTimeout(function () { say(p.text, p.opts); }, 60);
    }
  }
  ['pointerdown', 'touchend', 'click'].forEach(function (ev) {
    document.addEventListener(ev, onFirstGesture, { passive: true });
  });

  /* ---------- Web Speech 兜底 ---------- */
  var synth = window.speechSynthesis, voices = [];
  function loadVoices() { if (synth) voices = synth.getVoices() || []; }
  if (synth) { loadVoices(); try { synth.onvoiceschanged = loadVoices; } catch (e) { } }
  function hasRussian() { return voices.some(function (v) { return /^ru/i.test(v.lang); }); }

  function tts(text, slow) {
    if (!synth) { lastError = 'no-tts-engine'; return; }
    try { synth.cancel(); } catch (e) { }
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    u.rate = slow ? 0.65 : (S.state.settings.rate || 0.85);
    var v = voices.filter(function (x) { return /^ru/i.test(x.lang); })[0];
    if (v) u.voice = v;
    else if (!voices.length) lastError = 'no-tts-voice';
    try { synth.speak(u); } catch (e) { lastError = 'tts-error'; }
  }

  function stop() {
    if (current) { try { current.pause(); } catch (e) { } current = null; }
    if (synth) { try { synth.cancel(); } catch (e) { } }
  }

  /* ---------- 本地 MP3 ---------- */
  function getAudio(url) {
    var a = audioCache[url];
    if (!a) {
      a = new Audio(url);
      a.preload = 'auto';
      audioCache[url] = a;
    }
    return a;
  }

  function playFile(id, kind, slow) {
    return new Promise(function (resolve, reject) {
      var url = src(id, kind);
      var a = getAudio(url);
      var done = false;
      var rate = slow ? 0.8 : 1.0;
      function finish(ok, why) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (ok) resolve();
        else {
          lastError = why || 'fail';
          try { a.pause(); } catch (e) { }
          reject(new Error(why || 'fail'));
        }
      }
      a.onerror = function () { finish(false, 'missing'); };
      a.onended = function () { finish(true); };
      var p;
      try {
        a.pause();
        a.currentTime = 0;
        a.playbackRate = rate;
        p = a.play();
        current = a;
      } catch (e) { finish(false, e && e.name || 'blocked'); return; }
      if (p && p.catch) p.catch(function (e) {
        finish(false, (e && e.name) || 'blocked');
      });
      // 兜底：3s 仍未开始且无错误 → 认为文件不可用
      var timer = setTimeout(function () {
        if (!done && (a.readyState < 2 || (a.currentTime === 0 && a.paused))) finish(false, 'stalled');
      }, 3000);
    });
  }

  /* ---------- 对外 API ---------- */
  function resolveId(text) {
    if (wordIndex[text]) return { id: wordIndex[text], kind: 'word' };
    if (sentIndex[text]) return { id: sentIndex[text], kind: 'sent' };
    return null;
  }

  function say(text, opts) {
    opts = opts || {};
    stop();
    var hit = opts.id ? { id: opts.id, kind: opts.kind || 'word' } : resolveId(text);
    var slow = !!opts.slow;
    if (S.state.settings.ttsOnly || !hit) { tts(text, slow); return Promise.resolve(); }
    return playFile(hit.id, hit.kind, slow).catch(function (e) {
      var reason = e && e.message;
      if (reason === 'NotAllowedError') {
        // 自动播放策略拦截：挂起，等用户下一次点击时补播
        pending = { text: text, opts: opts };
        return;
      }
      tts(text, slow);
    });
  }

  /* 预取（点击发热词时无感） */
  function prefetch(ids) {
    (ids || []).slice(0, 60).forEach(function (id) {
      ['words', 'sent'].forEach(function (dir) {
        getAudio('assets/audio/' + dir + '/' + id + '.mp3');
      });
    });
  }

  /* 发音自检：依次尝试本地 MP3，返回诊断信息（设置页展示） */
  function selfTest() {
    lastError = '';
    var id = (D.words[0] && D.words[0].id) || 'w001';
    return playFile(id, 'words', false).then(function () {
      return { ok: true, via: '本地 MP3（' + src(id, 'words') + '）', error: '' };
    }, function (e) {
      var r = e && e.message || 'unknown';
      var hint = {
        NotAllowedError: '浏览器/WebView 拦截了自动播放（点一下页面任意处再试）',
        NotSupportedError: '文件格式不被当前环境支持',
        missing: '音频文件缺失',
        stalled: '加载超时',
        'no-tts-engine': '系统语音不可用'
      }[r] || '未知原因';
      return { ok: false, via: '回退系统语音', error: r + ' — ' + hint };
    });
  }

  /* PWA 场景：把全部语音写入 Cache Storage，实现完全离线 */
  function precacheAll(onProgress) {
    if (!('caches' in window)) return Promise.reject(new Error('no-cache-api'));
    return fetch('assets/audio/manifest.json').then(function (r) { return r.json(); }).then(function (m) {
      var urls = [];
      (m.items || []).forEach(function (it) {
        if (it.word > 0) urls.push('assets/audio/words/' + it.id + '.mp3');
        if (it.sent > 0) urls.push('assets/audio/sent/' + it.id + '.mp3');
      });
      return caches.open('ruvocab-audio-v1').then(function (cache) {
        var i = 0, done = 0;
        function next() {
          if (i >= urls.length) { onProgress && onProgress(1, urls.length); return Promise.resolve(); }
          var u = urls[i++];
          return (cache.match(u).then(function (hit) {
            return hit ? null : cache.add(u);
          })).catch(function () { }).then(function () {
            done++;
            onProgress && onProgress(done / urls.length, done);
            return next();
          });
        }
        return next();
      });
    });
  }

  window.RVAudio = {
    say: say,
    stop: stop,
    tts: tts,
    prefetch: prefetch,
    precacheAll: precacheAll,
    selfTest: selfTest,
    hasRussian: hasRussian,
    resolveId: resolveId,
    counts: function () { return { words: Object.keys(wordIndex).length, sents: Object.keys(sentIndex).length }; }
  };
})();

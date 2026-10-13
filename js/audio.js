/* 音频播放层：优先播放随包分发的真人发音（MP3），缺失或被拦截时回退系统语音 */
(function () {
  'use strict';

  var D = window.RV_DATA, S = window.RVStore;
  var current = null;          // 当前播放的 <audio>
  var warned = false;
  var wordIndex = {}, sentIndex = {}, idIndex = {};

  (D.words || []).forEach(function (w) {
    wordIndex[w.ru] = w.id;
    sentIndex[w.ex_ru] = w.id;
    idIndex[w.id] = w;
  });

  function src(id, kind) {
    return 'assets/audio/' + (kind === 'sent' ? 'sent' : 'words') + '/' + id + '.mp3';
  }

  /* ---------- Web Speech 兜底 ---------- */
  var synth = window.speechSynthesis, voices = [];
  function loadVoices() { if (synth) voices = synth.getVoices() || []; }
  if (synth) { loadVoices(); try { synth.onvoiceschanged = loadVoices; } catch (e) { } }
  function hasRussian() { return voices.some(function (v) { return /^ru/i.test(v.lang); }); }

  function tts(text, slow) {
    if (!synth) return;
    try { synth.cancel(); } catch (e) { }
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    u.rate = slow ? 0.65 : (S.state.settings.rate || 0.85);
    var v = voices.filter(function (x) { return /^ru/i.test(x.lang); })[0];
    if (v) u.voice = v;
    try { synth.speak(u); } catch (e) { }
    if (!hasRussian() && !warned) {
      warned = true;
      if (window.RVStore) setTimeout(function () { }, 0);
    }
  }

  function stop() {
    if (current) { try { current.pause(); } catch (e) { } current = null; }
    if (synth) { try { synth.cancel(); } catch (e) { } }
  }

  /* ---------- 本地 MP3 ---------- */
  function playFile(id, kind, slow) {
    return new Promise(function (resolve, reject) {
      var a = new Audio(src(id, kind));
      a.preload = 'auto';
      var done = false;
      var rate = slow ? 0.8 : 1.0;
      function finish(ok, why) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (ok) resolve(); else { try { a.pause(); } catch (e) { } reject(new Error(why || 'fail')); }
      }
      a.onerror = function () { finish(false, 'missing'); };
      a.onended = function () { finish(true); };
      var p;
      try {
        a.playbackRate = rate;
        p = a.play();
        current = a;
      } catch (e) { finish(false, 'blocked'); return; }
      if (p && p.catch) p.catch(function () { finish(false, 'blocked'); });
      // 兜底：2.8s 仍未开始且无错误 → 认为文件不可用
      var timer = setTimeout(function () {
        if (!done && (a.readyState < 2 || a.currentTime === 0)) finish(false, 'stalled');
      }, 2800);
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
    return playFile(hit.id, hit.kind, slow).catch(function () { tts(text, slow); });
  }

  /* 预取（点击发热词时无感） */
  function prefetch(ids) {
    (ids || []).slice(0, 60).forEach(function (id) {
      ['words', 'sent'].forEach(function (dir) {
        var a = new Audio();
        a.preload = 'auto';
        a.src = 'assets/audio/' + dir + '/' + id + '.mp3';
      });
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
    hasRussian: hasRussian,
    resolveId: resolveId,
    counts: function () { return { words: Object.keys(wordIndex).length, sents: Object.keys(sentIndex).length }; }
  };
})();

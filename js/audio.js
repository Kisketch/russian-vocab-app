/* 音频播放层：优先播放随包分发的真人发音（MP3），失败时逐级回退。
   移动端关键设计：
   1) 不复用 Audio 元素 —— 一个元素一旦出错（error 状态）会永久污染，
      之后每次 play() 都立刻 reject，表现为"多点几次也没声音"；
   2) 每次播放新建元素并 preload，播放失败后重试一次（换新元素），仍失败才回退系统 TTS；
   3) 首次手势播放静音 WAV 解锁 iOS/WebView 自动播放策略；
   4) 被自动播放策略拦截时挂起，用户下一次点击自动补播；
   5) 安卓端优先走原生 NativeAudio（彻底绕开 WebView 媒体策略），
      原生不可用时回退 HTMLAudio，再回退系统语音。 */
(function () {
  'use strict';

  var D = window.RV_DATA, S = window.RVStore;
  var current = null;          // 当前播放的 <audio>
  var warned = false;
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

  /* ---------- 原生音频（安卓 App 内可用，绕开 WebView 媒体限制） ---------- */
  var native = null, nativeOk = null, nativeLoading = {};
  function getNative() {
    if (nativeOk === false) return null;
    if (native) return native;
    var cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) { nativeOk = false; return null; }
    var p = cap.Plugins && (cap.Plugins.NativeAudio || cap.Plugins['NativeAudio']);
    if (!p || !p.preload || !p.play) { nativeOk = false; return null; }
    native = p;
    nativeOk = true;
    return native;
  }

  /* 原生播放：按需预载，返回 Promise（resolve=已播放，reject=原生不可用/失败） */
  function playNative(id, kind) {
    var p = getNative();
    if (!p) return Promise.reject(new Error('no-native'));
    var nid = 'w_' + kind + '_' + id;
    // APK 内 web 资产位于 assets/public/，原生插件直接从 assets/ 根按此路径读取
    var path = 'public/assets/audio/' + (kind === 'sent' ? 'sent' : 'words') + '/' + id + '.mp3';
    function go() {
      return p.play({ id: nid }).then(function () {
        lastError = '';
      }, function (e) {
        nativeLoading[nid] = false;
        throw e;
      });
    }
    if (nativeLoading[nid]) return go();
    return p.preload({
      id: nid,
      assetPath: path,
      volume: 1
    }).then(function () { nativeLoading[nid] = true; return go(); },
      function () { nativeOk = false; throw new Error('preload-failed'); });
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

  /* ---------- 本地 MP3（每次新元素，避免污染元素被反复复用） ---------- */
  function playFile(id, kind, slow) {
    return new Promise(function (resolve, reject) {
      var a = new Audio(src(id, kind));
      a.preload = 'auto';
      var done = false, started = false;
      function finish(ok, why) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        a.onplaying = a.onerror = a.onended = null;
        if (ok) resolve();
        else {
          lastError = why || 'fail';
          try { a.pause(); } catch (e) { }
          reject(new Error(why || 'fail'));
        }
      }
      a.onplaying = function () { started = true; };
      a.onended = function () { finish(true); };
      a.onerror = function () {
        // 元素已进入 error 状态，必须丢弃（不能复用）
        finish(false, (a.error && a.error.code) ? 'media-' + a.error.code : 'missing');
      };
      var p;
      try {
        a.playbackRate = slow ? 0.8 : 1.0;
        p = a.play();
        current = a;
      } catch (e) { finish(false, e && e.name || 'blocked'); return; }
      if (p && p.catch) p.catch(function (e) {
        finish(false, (e && e.name) || 'blocked');
      });
      // 兜底：5s 仍无播放迹象才判失败
      var timer = setTimeout(function () {
        if (!done && !started) finish(false, 'stalled');
      }, 5000);
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
    // 1) 安卓原生播放（最稳）→ 2) HTMLAudio（失败自动换新元素重试一次）→ 3) 系统语音
    return playNative(hit.id, hit.kind).catch(function () {
      return playFile(hit.id, hit.kind, slow).catch(function (e) {
        var reason = e && e.message;
        if (reason === 'NotAllowedError') {
          // 自动播放策略拦截：挂起，等用户下一次点击时补播
          pending = { text: text, opts: opts };
          return;
        }
        return playFile(hit.id, hit.kind, slow).catch(function (e2) {
          if (e2 && e2.message === 'NotAllowedError') {
            pending = { text: text, opts: opts };
            return;
          }
          tts(text, slow);
        });
      });
    });
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

  /* 发音自检：依次尝试 原生 → 本地 MP3，返回诊断信息（设置页展示） */
  function selfTest() {
    lastError = '';
    var id = (D.words[0] && D.words[0].id) || 'w001';
    return playNative(id, 'words').then(function () {
      return { ok: true, via: '原生音频（NativeAudio）', error: '' };
    }, function () {
      return playFile(id, 'words', false).then(function () {
        return { ok: true, via: '本地 MP3（' + src(id, 'words') + '）', error: '' };
      }, function (e) {
        var r = e && e.message || 'unknown';
        var hint = {
          NotAllowedError: '浏览器/WebView 拦截了自动播放（点一下页面任意处再试）',
          NotSupportedError: '文件格式不被当前环境支持',
          missing: '音频文件缺失',
          stalled: '加载超时'
        }[r] || '未知原因';
        return { ok: false, via: '回退系统语音', error: r + ' — ' + hint };
      });
    });
  }

  /* PWA 场景：把全部语音与配图写入 Cache Storage，实现完全离线 */
  function precacheAll(onProgress) {
    if (!('caches' in window)) return Promise.reject(new Error('no-cache-api'));
    return fetch('assets/audio/manifest.json').then(function (r) { return r.json(); }).then(function (m) {
      var urls = [];
      (m.items || []).forEach(function (it) {
        if (it.word > 0) urls.push('assets/audio/words/' + it.id + '.mp3');
        if (it.sent > 0) urls.push('assets/audio/sent/' + it.id + '.mp3');
      });
      (D.words || []).forEach(function (w) {
        if (w.img) urls.push('assets/img/' + w.id + '.jpg');
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

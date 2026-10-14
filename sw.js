/* Service Worker：应用外壳预缓存 + 语音运行时缓存（CacheFirst） */
var SHELL = 'ruvocab-shell-v4';
var AUDIO = 'ruvocab-audio-v1';

var SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/data.js',
  './js/scenes.js',
  './js/store.js',
  './js/audio.js',
  './js/app.js',
  './js/grammar.js',
  './assets/grammar.json',
  './assets/fonts/marck-script-cyrillic-400-normal.woff2',
  './assets/fonts/marck-script-latin-400-normal.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.ico'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) { return c.addAll(SHELL_FILES); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL && k !== AUDIO) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isAudio(url) {
  return url.pathname.indexOf('/assets/audio/') >= 0;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // 音频：CacheFirst，命中后永久离线可用
  if (isAudio(url)) {
    e.respondWith(
      caches.open(AUDIO).then(function (cache) {
        return cache.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (resp) {
            if (resp && resp.ok) cache.put(req, resp.clone());
            return resp;
          });
        });
      })
    );
    return;
  }

  // 同源静态资源：CacheFirst + 后台更新
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        var fetching = fetch(req).then(function (resp) {
          if (resp && resp.ok) {
            caches.open(SHELL).then(function (c) { c.put(req, resp.clone()); });
          }
          return resp;
        }).catch(function () { return hit; });
        return hit || fetching;
      })
    );
  }
});

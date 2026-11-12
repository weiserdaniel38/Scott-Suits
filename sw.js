// Home Screen app helper (Daniel, 2026-11-01).
// Kept deliberately small: it only steps in when a PAGE fails to load
// (no signal), and shows offline.html instead of Safari's error screen.
// Every other request (scripts, styles, photos, Supabase, Stripe) goes
// straight to the network untouched, so ?v= cache tags and live data work
// exactly as on the normal website. Bump VERSION if offline.html changes.
var VERSION = "offline-v2";
var OFFLINE_URL = "/offline.html";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return cache.addAll([OFFLINE_URL]);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.mode !== "navigate" || req.method !== "GET") return;
  event.respondWith(
    fetch(req).catch(function () {
      return caches.match(OFFLINE_URL);
    })
  );
});

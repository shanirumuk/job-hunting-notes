const CACHE = 'job-notebook-v69';
const ASSETS = ['/', '/index.html', '/styles.css?v=69', '/app.js?v=69', '/lib/model.js?v=69', '/lib/geography.js', '/lib/insights.js', '/lib/experience-filter.js', '/lib/listing-freshness.js', '/lib/listing-highlights.js', '/lib/qualification-capabilities.js', '/lib/profile-corrections.js', '/lib/fit-review.js', '/lib/summaries.js', '/lib/model.js', '/lib/cv-json.js', '/lib/cv-pdf.js', '/lib/job-search-profile.js', '/vendor/pdfjs/pdf.min.mjs', '/vendor/pdfjs/pdf.worker.min.mjs', '/lib/device-crypto.js', '/lib/device-store.js', '/lib/device-sync.js', '/manifest.json', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => /^job-notebook-v\d+$/.test(key) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }
  if (!ASSETS.includes(url.pathname + url.search)) return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});

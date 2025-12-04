const CACHE='bm-v17';
const ASSETS=['./','./index.html','./style.css','./manifest.webmanifest',
              './js/storage.js','./js/budget.js','./js/categories.js',
              './js/charts.js','./js/filters.js','./js/ui.js','./js/main.js'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});

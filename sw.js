/* Service worker v4
   - App shell (HTML/CSS/JS/data): NETWORK-FIRST so updates always appear.
   - Images: CACHE-FIRST so the app still works offline.
*/
const VERSION = "cma-p2-v4";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data/questions.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

function isImage(url){ return url.pathname.includes("/images/"); }

self.addEventListener("fetch", e=>{
  const req=e.request;
  if(req.method!=="GET") return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;

  if(isImage(url)){
    // cache-first for images
    e.respondWith(
      caches.match(req).then(hit=> hit || fetch(req).then(res=>{
        if(res && res.status===200){ const copy=res.clone(); caches.open(VERSION).then(c=>c.put(req,copy)); }
        return res;
      }).catch(()=>hit))
    );
    return;
  }

  // network-first for everything else (the app shell)
  e.respondWith(
    fetch(req).then(res=>{
      if(res && res.status===200 && res.type==="basic"){
        const copy=res.clone(); caches.open(VERSION).then(c=>c.put(req,copy));
      }
      return res;
    }).catch(()=> caches.match(req).then(hit=> hit || caches.match("./index.html")))
  );
});

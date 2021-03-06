const VERSION = "v81";
const logs = [];

log = (function () {
  logs.push(arguments);
  return Function.prototype.bind.call(console.log, console);
})();

log(`[SW:${VERSION}] boot`);

const contentToCache = ["./", "index.js", "style.css", "manifest.webmanifest"];

async function wait(seconds) {
  while (seconds-- > 0) {
    console.log(`[SW:${VERSION}] Sleep ${seconds} seconds more.`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

function addToCache() {
  console.log(`[SW:${VERSION}] Caching app`);
  return caches.open(VERSION).then((cache) =>
    Promise.all(
      contentToCache.map((url) =>
        fetch(`${url}?${VERSION}`).then((response) => {
          if (!response.ok) {
            console.error(`[SW:${VERSION}] Cannot fetch`, url);
            throw Error(`Cannot fetch ${url}`);
          }
          return cache.put(url, response);
        })
      )
    )
  );
}

async function retrieve({ request }) {
  let response = await caches.match(request);
  if (!response) {
    console.log(`[SW:${VERSION}] Fetch miss`, request.url);
    response = await fetch(request);
    // Don't cache responses for now.
    // const cache = await caches.open(cacheName);
    // console.log("[Service Worker] Caching new resource: " + request.url);
    // cache.put(request, response.clone());
  } else {
    console.log(`[SW:${VERSION}] Fetch hit`, request.url);
  }
  return response;
}

async function clearCaches() {
  console.log(`[SW:${VERSION}] Clear cache`);
  const keys = (await caches.keys()).filter((key) => key !== VERSION);
  return Promise.all(keys.map((key) => caches.delete(key)));
}

function boot() {
  console.log(`[SW:${VERSION}] Register Listener: install`);
  self.addEventListener("install", (e) => {
    e.waitUntil(Promise.all([addToCache(), wait(10)]));
  });

  console.log(`[SW:${VERSION}] Register Listener: fetch`);
  self.addEventListener("fetch", (e) => {
    e.respondWith(retrieve(e));
  });

  console.log(`[SW:${VERSION}] Register Listener: activate`);
  self.addEventListener("activate", (e) => {
    console.log(`[SW:${VERSION}] Activate`);
    e.waitUntil(clearCaches());
  });

  self.addEventListener("message", function (event) {
    console.log(`[SW:${VERSION}] Message:`, event);
    const port = event.ports[0];
    switch (event.data.action) {
      case "logs":
        port.postMessage({ message: "logs" });
        break;
      case "skipWaiting":
        self.skipWaiting();
        break;
      case "info":
        port.postMessage({ message: `Version ${VERSION}` });
        break;
      default:
        break;
    }
  });
}

boot();

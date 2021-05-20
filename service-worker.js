const V = "14";
const logs = [];

log = (function () {
  logs.push(arguments);
  return Function.prototype.bind.call(console.log, console);
})();

log(`[SW:${V}] boot`);

self.addEventListener("install", () => {
  log(`[SW:${V}] install`);
});

self.addEventListener("activate", () => {
  log(`[SW${V}] event`);
});

self.addEventListener("message", (event) => {
  console.log("[Service Worker] Message:", event);
  const port = event.ports[0];
  switch (event.data.action) {
    case "logs":
      port.postMessage({ message: "logs" });
      break;
    case "skipWaiting":
      self.skipWaiting();
      break;
    case "info":
      port.postMessage({ message: `Version ${V}` });
      break;
    default:
      break;
  }
});

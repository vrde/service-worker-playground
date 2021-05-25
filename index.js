async function installServiceWorker(
  path,
  options = {
    shouldReload: async () =>
      confirm("A new version is available, reload the app?"),
    doReload: () => window.location.reload(),
    scope: ".",
  }
) {
  async function maybeReload(serviceWorker) {
    if (await options.shouldReload()) {
      post({ action: "skipWaiting" }, serviceWorker);
      serviceWorker.addEventListener("statechange", async (e) => {
        console.log("SW Waiting new state: ", e.target.state);
        if (e.target.state === "activated") {
          console.log("SW activated, reload");
          options.doReload();
        }
      });
    }
  }

  let registration;
  try {
    console.log("Register Service Worker");
    registration = await navigator.serviceWorker.register(path, {
      scope: options.scope,
    });
  } catch (e) {
    console.log(e);
    throw e;
  }

  if (registration.waiting) {
    await maybeReload(registration.waiting);
  }

  lookForUpdates(maybeReload);
}

// ## A service to check for updates
//
// Checking for updates depends on the `ServiceWorkerRegistration` object. While
// using the app, the *current registration* can exist or not. This is a fail
// safe approach that polls the state of the registration and check for updates
// when a registration exists.

function lookForUpdates(maybeReload, scope = ".", pollingTime = 1000) {
  let timerId;
  let registration;

  async function onUpdateFound() {
    console.log("[Update Service] Update found");
    const newSW = this.installing;
    newSW.addEventListener("statechange", async (e) => {
      console.log("[Update Service] New SW state change:", e.target.state);
      if (e.target.state === "installed") {
        maybeReload(newSW);
      }
    });
  }

  async function checkRegistration() {
    console.log("[Update Service] Check Registration");
    registration = await navigator.serviceWorker.getRegistration(scope);
    if (registration) {
      registration.addEventListener("updatefound", onUpdateFound);
      checkUpdate();
    } else {
      timerId = window.setTimeout(checkRegistration, pollingTime);
    }
  }

  async function checkUpdate() {
    // Subscribe to updates.
    // To check for updates periodically, run the `update` method at specific intervals.
    console.log("[Update Service] Check for updates");
    try {
      await registration.update();
    } catch (e) {
      console.log("[Update Service] Error updating", e);
      registration.removeEventListener("updatefound", onUpdateFound);
      checkRegistration();
      return;
    }
    timerId = window.setTimeout(checkUpdate, pollingTime);
  }

  checkRegistration();

  return () => {
    window.clearTimeout(timerId);
  };
}

async function post(message, sw) {
  if (!sw) {
    sw = navigator.serviceWorker.controller;
  }
  if (!sw) {
    throw new Error("No controller available");
  }
  const channel = new MessageChannel();
  return new Promise((resolve, reject) => {
    channel.port1.onmessage = (event) => {
      resolve(event.data);
    };
    channel.port1.onmessageerror = (event) => {
      console.log("Message error", event);
      reject(event);
    };
    try {
      sw.postMessage(message, [channel.port2]);
    } catch (e) {
      reject(e);
    }
  });
}

installServiceWorker("./service-worker.js").catch(console.log);

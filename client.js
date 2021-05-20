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
    sw.postMessage(message, [channel.port2]);
  });
}

function log(...args) {
  const now = new Date();
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map((x) =>
    x.toString().padStart(2, 0)
  );
  const container = document.getElementById("log");
  const line = document.createElement("li");
  line.textContent = `${time.join(":")} ${args.join(" ")}`;
  container.appendChild(line);
}

function promptForUpdate(newSW) {
  if (confirm("Update Service Worker?")) {
    post({ action: "skipWaiting" }, newSW);
  }
}

async function register() {
  let registration;
  try {
    log("Get Service Worker registration");
    registration = await navigator.serviceWorker.register("service-worker.js");
  } catch (e) {
    log("Error", e);
    console.log(e);
  }

  let serviceWorker;
  if (registration.installing) {
    serviceWorker = registration.installing;
    const info = await post({ action: "info" }, serviceWorker);
    log("Installing", info.message);
  } else if (registration.waiting) {
    serviceWorker = registration.waiting;
    const info = await post({ action: "info" }, serviceWorker);
    log("Waiting", info.message);
    promptForUpdate(serviceWorker);
  } else if (registration.active) {
    serviceWorker = registration.active;
    const info = await post({ action: "info" }, serviceWorker);
    log("Active", info.message);
  }

  if (serviceWorker) {
    serviceWorker.addEventListener("statechange", async (e) => {
      try {
        const info = await post({ action: "info" }, e.target);
        log("SW state change", e.target.state, info.message);
      } catch (e) {
        log("SW state change error, probably stale worker", e);
      }
    });
  }
}

async function onUpdateFound() {
  const registration = this;
  const newSW = registration.installing;

  console.log("Update found", this);
  log("Update found");

  newSW.addEventListener("statechange", async (e) => {
    const info = await post({ action: "info" }, e.target);
    log("New SW state change", e.target.state, info.message);
  });

  await newSW.ready;
  promptForUpdate(newSW);
}

async function update() {
  const registration = await navigator.serviceWorker.getRegistration();
  log("Subscribe to updates");
  if (registration) {
    registration.addEventListener("updatefound", onUpdateFound);
  }
}

// # Service Worker API playground
//
// Hello, and welcome to the Service Worker API Playground!
// It took me a while to understand how to use the Service Worker API, and how
// to write code that would behave as expected on different browsers and
// platforms. Specifically, there are some subtle differences between Safari and
// other browsers.
//
// Before we dig into the details, let's have a quick overview of how things work.

async function boot() {
  // Let's start!
  log("Booting");

  // First, we check if we already have a registration.
  // A [Service Worker Registation][mdn:ServiceWorkerRegistration] is an object
  // that keeps track of the registration status of the service worker.
  // You can query the registration to know which service worker is installed,
  // waiting, or active in the current scope.
  // The registration can be `undefined` if nothing was registered in the
  // current scope.
  const swRegistration = await navigator.serviceWorker.getRegistration();
  if (swRegistration) {
    log("SW Registration found");
  } else {
    log("No SW Registration found");
  }

  // Another way to get the registration is to call the register method.

  const swActive = navigator.serviceWorker.controller;
  await swActive.ready;
  if (swActive) {
    try {
      const info = await post({ action: "info" });
      log("Controller found", info.message);
    } catch (e) {
      log("Error talking to controller", e);
    }
  } else {
    log("No Controller found");
  }

  await register();
  await update();
}
boot().catch(console.log);

// [hide-and-seek]: https://www.thinktecture.com/en/pwa/playing-hide-and-seek-with-my-serviceworker-instance/
// [mdn:ServiceWorkerRegistration]: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration

// # Service Worker API playground
//
// Hello, and welcome to the Service Worker API Playground!
// It took me a while to understand how to use the Service Worker API, and how
// to write code that would behave as expected on different browsers and
// platforms. Specifically, there are some subtle differences between Safari and
// other browsers.
//
// Before we dig into the details, let's have a quick overview of how things work.
//
// - `navigator.serviceWorker` is **not** a Service Worker, it's a Service
// Worker Container.
//
// ## Unexpected life-cycle behavior
//
// I've noticed the following flow on when the page is opened for the first
// time.
//
// - The service worker is installed for the first time.
// - If the service worker is updated and the page is *not* refreshed, the new
// service worker is immediately activated.
//
// If the page is reloaded, then the new service worker is first installed, and
// then eventually activated when `skipWaiting` is called.
//

async function boot() {
  // Let's start!
  log("Booting");

  // ## Get the current registration
  //
  // First, we check if we already have a registration.
  // A [Service Worker Registation][mdn:ServiceWorkerRegistration] is an object
  // that keeps track of the registration status of the service worker.
  // You can query the registration to know which service worker is installed,
  // waiting, or active in the current scope.
  // The registration can be `undefined` if nothing was registered in the
  // current scope, or on the very first run of a web page *before* the
  // installation of its Service Worker. So when you run this code for the first time,
  // `swRegistration` will be `undefined`.
  const swCurrentRegistration = await navigator.serviceWorker.getRegistration();
  if (swCurrentRegistration) {
    log("SW Registration found");
  } else {
    log("No SW Registration found");
  }

  // ## Get the controller
  //
  // We can also check who's the controller, that is the Service Worker
  // controlling the current scope. It can be `null` during a *force-refresh*
  // request (Shift + refresh) or if there is no active worker.
  //
  // Note: I think Safari returns a stale Service Worker if: 1) a new service worker
  // is waiting to get activated; and 2) the user reloaded the page.
  const swController = navigator.serviceWorker.controller;
  if (swController) {
    try {
      // In this case, Safari raises an `InvalidStateError: Service Worker state
      // is redudant` if we try to post a message to the current controller
      // (that is not the current controller... I have a hard time wrapping my
      // head around this, maybe Safari updates the Service Worker with some
      // other logic).
      const info = await post({ action: "info" }, swController);
      log("Controller found", info.message);
    } catch (e) {
      log("Error talking to controller", e);
    }
  } else {
    log("No Controller found");
  }

  // ## Create a registration
  //
  // Now it's time to install your Service Worker. Aren't you excited? I'm not
  // because dealing with Service Workers is a bloodbath. But it's too late now
  // to go back. Also, I wrote this guide specifically for you so it would be
  // nice if you continue reading it.

  // Registering a Service Worker is an idempotent operation. You can do it when
  // starting the app, and even if you already registered the same Service
  // Worker before, nothing weird will happen. I guess that's the best practice
  // actually.
  let swRegistration;
  try {
    log("Register the Service Worker");
    swRegistration = await navigator.serviceWorker.register(
      "service-worker.js"
    );
  } catch (e) {
    log("Error", e);
    console.log(e);
    throw e;
  }

  // Now the fun part: checking the state of the Service Worker using the
  // registration object.
  let serviceWorker;

  if (swRegistration.installing) {
    // `installing` is undefined, or contains the instance of the Service Worker
    // currently installing. When the page is visited for the first time, and
    // after the `register` method is called, `installing` contains the
    // Service Worker instance.
    serviceWorker = swRegistration.installing;
    const info = await post({ action: "info" }, serviceWorker);
    log("Installing", info.message);
  } else if (swRegistration.waiting) {
    // `waiting` is undefined, or contains the instance of the Service Worker
    // waiting to be activated. If the user reloads the page and there is a
    // Service Worker that is *pending* to get activated, you'll find it here.
    serviceWorker = swRegistration.waiting;
    const info = await post({ action: "info" }, serviceWorker);
    log("Waiting", info.message);
    promptForUpdate(serviceWorker);
  } else if (swRegistration.active) {
    // `active` is undefined, or contains the instance of the Service Worker
    // that controls the page. This property is the same as
    // `navigator.serviceWorker.controller`.
    serviceWorker = swRegistration.active;
    const info = await post({ action: "info" }, serviceWorker);
    log("Active", info.message);
  }

  // Might have different serviceWorker in different states
  if (serviceWorker) {
    // Now we can subscribe to the state changes of the Service Worker.
    serviceWorker.addEventListener("statechange", async (e) => {
      log("Controller SW state change:", e.target.state);
    });
  }

  // ## Update the Service Worker
  //
  // We reuse the `swRegistration` object we defined before. In case you want to
  // isolate this in a sparate function, you can use `await
  // navigator.serviceWorker.getRegistration()`
  log("Subscribe to updates");
  swRegistration.addEventListener("updatefound", async () => {
    // To access the registration we use the `swRegistration` variable in the
    // outer scope. In case we don't have access to it, we can also use `this`,
    // i.e. `const registration = this`.
    log("Update found");
    // Look how cool! To get the new Service Worker we use the `installing`
    // attribute of the registration.
    const newSW = swRegistration.installing;
    newSW.addEventListener("statechange", async (e) => {
      log("New SW state change:", e.target.state);
    });
    // We can wait until the new Service Worker is ready to prompt the user to
    // update it.
    await newSW.ready;
    promptForUpdate(newSW);
  });

  // ## Check for updates
  //
  // The browser checks for updates every time the page is reloaded. To smooth
  // the update process, we can check for updates periodically and manually.

  // To check for updates periodically, you can run the `update` method at specific intervals.
  window.setInterval(() => {
    log("Check for updates");
    swRegistration.update();
  }, 60000);

  // To check for updates manually, you can bind it to a button.
  document.getElementById("checkForUpdates").addEventListener("click", () => {
    log("Check for updates");
    swRegistration.update();
  });

  // Reload app
  document
    .getElementById("reloadApp")
    .addEventListener("click", () => window.location.reload());
}

// # Paraphernalia

// ## Boot the application
if ("serviceWorker" in navigator) {
  boot().catch(console.log);
} else {
  log("Service Worker API not supported");
}

// ## Communicate with a specific Service Worker
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

// ## Log in the document
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

// ## Show or hide the update button
function promptForUpdate(newSW) {
  const button = document.getElementById("updateServiceWorker");
  button.classList.remove("hide");
  button.addEventListener("click", async () => {
    post({ action: "skipWaiting" }, newSW);
    button.classList.add("hide");
  });
}

// [hide-and-seek]: https://www.thinktecture.com/en/pwa/playing-hide-and-seek-with-my-serviceworker-instance/
// [mdn:ServiceWorkerRegistration]: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration
// [firt:whatsNew]: https://medium.com/@firt/whats-new-on-ios-12-2-for-progressive-web-apps-75c348f8e945
// https://stackoverflow.com/questions/55581719/reactjs-pwa-not-updating-on-ios
// https://github.com/facebook/create-react-app/issues/7237

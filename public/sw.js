const CACHE_VERSION = "ose-v3";
const APP_CACHE = `${CACHE_VERSION}-app`;
const SCRIPTURE_CACHE = `${CACHE_VERSION}-scriptures`;
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/scriptures/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then(async (cache) => {
        await cacheAllSettled(cache, APP_SHELL);
        await warmAppShellAssets(cache);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![APP_CACHE, SCRIPTURE_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function warmAppShellAssets(cache) {
  try {
    const response = await fetch("/");
    if (!response.ok) {
      return;
    }

    await cache.put("/", response.clone());
    const html = await response.text();
    const assetPaths = [...html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g)].map(
      (match) => match[1],
    );

    await cacheAllSettled(cache, assetPaths);
  } catch {
    // A partial app-shell cache is still useful; failed warmups should not block SW install.
  }
}

async function cacheAllSettled(cache, paths) {
  await Promise.all(
    paths.map(async (path) => {
      try {
        await cache.add(path);
      } catch {
        // Ignore individual cache misses so one transient asset failure does not break install.
      }
    }),
  );
}

async function networkFirst(request, cacheName, fallbackPath = null) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    if (fallbackPath) {
      const fallback = await cache.match(fallbackPath);
      if (fallback) {
        return fallback;
      }
    }
    throw new Error(`No cached response for ${request.url}`);
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname === "/scriptures/manifest.json") {
    event.respondWith(networkFirst(event.request, APP_CACHE));
    return;
  }

  if (/^\/scriptures\/oshb-jps\/[^/]+\/books\//.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request, SCRIPTURE_CACHE));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, APP_CACHE, "/"));
    return;
  }

  event.respondWith(cacheFirst(event.request, APP_CACHE));
});

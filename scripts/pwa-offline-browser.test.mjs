/**
 * Chromium PWA offline behavior UAT, isolated on 127.0.0.1.
 *
 * Tests REAL public/sw.js + public/offline.html, but never loads application
 * code, Cloud, data tamu, auth, or production URLs.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";

const playwrightModule = process.env.B25_PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(playwrightModule);
const marker = "SYNTHETIC-PRIVATE-ONLY-NEVER-CACHE";
const publicFiles = {
  "/sw.js": ["public/sw.js", "text/javascript"],
  "/offline.html": ["public/offline.html", "text/html; charset=utf-8"],
  "/manifest.webmanifest": ["public/manifest.webmanifest", "application/manifest+json"],
  "/pwa/icon-192.png": ["public/pwa/icon-192.png", "image/png"],
  "/pwa/icon-512.png": ["public/pwa/icon-512.png", "image/png"],
  "/pwa/icon-maskable-512.png": ["public/pwa/icon-maskable-512.png", "image/png"],
};

function createLocalServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    res.setHeader("Cache-Control", "no-store");

    // Synthetic-only route that stands in for a sensitive operational page.
    if (req.method === "GET" && ["/", "/synthetic-private"].includes(url.pathname)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><html lang="id"><head><meta charset="utf-8">
      <link rel="manifest" href="/manifest.webmanifest">
      <title>PWA Offline Test</title></head><body><main><h1>${marker}</h1>
      <p>Fixture lokal, bukan data tamu asli.</p></main></body></html>`);
      return;
    }
    const file = publicFiles[url.pathname];
    if (req.method !== "GET" || !file) {
      res.writeHead(404);
      res.end("No such synthetic resource");
      return;
    }
    try {
      const contents = await readFile(file[0]);
      res.writeHead(200, { "Content-Type": file[1] });
      res.end(contents);
    } catch {
      res.writeHead(404);
      res.end("Fixture is missing");
    }
  });
}

async function startServer(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

await mkdir("test-results/pwa-browser", { recursive: true });
const server = createLocalServer();
const origin = await startServer(server);
const browser = await chromium.launch({ headless: true });
const viewports = [
  { name: "desktop", viewport: { width: 1280, height: 800 }, isMobile: false },
  { name: "mobile", viewport: { width: 375, height: 812 }, isMobile: true },
];

try {
  for (const { name, viewport, isMobile } of viewports) {
    const context = await browser.newContext({
      viewport, isMobile, hasTouch: isMobile, locale: "id-ID",
      serviceWorkers: "allow",
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    // Only intercept NON-LOCAL traffic: routing localhost requests via
    // route.continue() can bypass Chromium's simulated offline condition.
    // No application source, remote script, auth, or Cloud URL is loaded here.
    await page.route(/^https?:\\/\\/(?!127\\.0\\.0\\.1:\\d+\\/).+/, (route) => {
      pageErrors.push("Unexpected external request: " + route.request().url());
      return route.abort();
    });
    page.on("request", (request) => {
      if (!request.url().startsWith(origin + "/")) {
        pageErrors.push("Unexpected non-local request: " + request.url());
      }
    });

    try {
      await page.goto(origin + "/synthetic-private", { waitUntil: "domcontentloaded" });
      await page.evaluate(async () => {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
      });
      // A subsequent navigation must be controlled by the real worker.
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
      assert.equal(await page.locator("h1").innerText(), marker,
        "The synthetic private fixture must render when online");

      const initialCache = await page.evaluate(async () => {
        const keys = await caches.keys();
        const paths = [];
        for (const key of keys) {
          const cache = await caches.open(key);
          paths.push(...(await cache.keys()).map(req => new URL(req.url).pathname));
        }
        return { keys, paths };
      });
      assert.deepEqual(initialCache.keys, ["b25-offline-notice-v1"],
        "Only the expected offline cache may be created");
      assert.deepEqual(initialCache.paths, ["/offline.html"],
        "No authenticated page, navigation, asset, or API may be cached");

      // Chromium's real network goes offline. Navigation must work using only
      // the cached public notice, NOT previously visited sensitive fixture.
      await context.setOffline(true);
      await page.goto(origin + "/synthetic-private?offline=1", { waitUntil: "domcontentloaded" });
      assert.equal(await page.getByRole("heading", { name: "Koneksi internet terputus" }).count(), 1,
        "Offline navigation must show public notice");
      assert.equal(await page.getByText("Tidak ada transaksi yang disimpan secara offline.").count(), 1);
      assert.equal(await page.getByText(marker).count(), 0,
        "Previously visited synthetic private page must never be served from PWA cache");
      await page.screenshot({ path: `test-results/pwa-browser/${name}-offline.png` });

      await context.setOffline(false);
      await page.getByRole("button", { name: "Coba Lagi" }).click();
      await page.waitForLoadState("domcontentloaded");
      assert.equal(await page.getByRole("heading", { name: marker }).count(), 1,
        "After reconnecting, retry must restore online navigation");

      const afterCache = await page.evaluate(async () => {
        const entries = [];
        for (const key of await caches.keys()) {
          const cache = await caches.open(key);
          entries.push(...(await cache.keys()).map(req => new URL(req.url).pathname));
        }
        return entries;
      });
      assert.deepEqual(afterCache, ["/offline.html"],
        "Online operations may not grow the PWA cache");

      assert.deepEqual(pageErrors, [], "No JavaScript errors or external requests");
      console.log(`PASS ${name}: registered service worker, offline notice, no private cache, reconnect, zero Cloud`);
    } catch (error) {
      await page.screenshot({ path: `test-results/pwa-browser/${name}-failure.png` }).catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

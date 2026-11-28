import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import { auditPwa } from "./pwa-deployment-smoke.mjs";

const paths = {
  "/manifest.webmanifest": "public/manifest.webmanifest",
  "/sw.js": "public/sw.js",
  "/offline.html": "public/offline.html",
  "/pwa/icon-192.png": "public/pwa/icon-192.png",
  "/pwa/icon-512.png": "public/pwa/icon-512.png",
  "/pwa/icon-maskable-512.png": "public/pwa/icon-maskable-512.png",
};

async function withServer(handler) {
  const server = http.createServer(async (req,res) => {
    if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end('<html><head><link rel="manifest" href="/manifest.webmanifest"></head></html>');
    }
    const filename = paths[req.url];
    if (!filename) { res.writeHead(404); return res.end("not found"); }
    try {
      const data = await fs.readFile(filename);
      const type = filename.endsWith(".png") ? "image/png" :
        filename.endsWith(".js") ? "text/javascript" :
        filename.endsWith(".webmanifest") ? "application/manifest+json" : "text/html";
      res.writeHead(200, { "content-type": type });
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(ok => server.listen(0, "127.0.0.1", ok));
  try { await handler("http://127.0.0.1:" + server.address().port); }
  finally { await new Promise(ok => server.close(ok)); }
}

test("PWA public assets pass isolated HTTP smoke with correct MIME and icon dimensions", async () => {
  await withServer(async url => {
    const report = await auditPwa(url);
    assert.equal(report.overall, "PASS", JSON.stringify(report.findings));
    assert.equal(report.findings.length, 7);
    assert.ok(report.findings.every(f => f.status === "PASS"));
  });
});

test("HTML disguised as manifest is reported FAIL, not PASS", async () => {
  await withServer(async url => {
    const fake = async (resource, opts) => {
      const response = await fetch(resource, opts);
      if (resource.endsWith("/manifest.webmanifest"))
        return new Response("<!doctype html>fallback", {
          status: 200, headers: { "content-type": "text/html" },
        });
      return response;
    };
    const report = await auditPwa(url, { fetchImpl: fake });
    assert.equal(report.overall, "FAIL");
    assert.ok(report.findings.some(f => f.label === "Manifest PWA" && f.status === "FAIL"));
  });
});

test("private preview responds BLOCKED without attempting login", async () => {
  const fake = async () => new Response("private", { status: 403 });
  const report = await auditPwa("https://example.com", { fetchImpl: fake });
  assert.equal(report.overall, "BLOCKED");
  assert.ok(report.findings.every(f => f.status === "BLOCKED"));
});

test("non-HTTPS external URL rejected", async () => {
  await assert.rejects(auditPwa("http://example.com"), /HTTPS/);
});

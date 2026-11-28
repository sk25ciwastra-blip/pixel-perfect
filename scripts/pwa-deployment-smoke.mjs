/**
 * Read-only smoke test of publicly served PWA assets. No auth, cookies, mutation,
 * Cloud access or booking calls. Run after publishing, NOT as a proof of installation.
 *
 * Usage:
 *   node scripts/pwa-deployment-smoke.mjs https://your-deployed-host
 */
import { pathToFileURL } from "node:url";

function targetUrl(raw) {
  const url = new URL(raw);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) {
    throw new Error("URL wajib HTTPS, kecuali localhost untuk tes terisolasi.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Gunakan origin tanpa kredensial, query, atau fragment.");
  }
  return url.origin;
}

function entry(label, status, reason) {
  return { label, status, reason };
}

export async function auditPwa(rawUrl, options = {}) {
  const origin = targetUrl(rawUrl);
  const request = options.fetchImpl ?? fetch;
  const findings = [];

  async function readPublic(path, label) {
    let response;
    try {
      response = await request(origin + path, {
        method: "GET",
        redirect: "follow",
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(options.timeoutMs ?? 12000),
      });
    } catch {
      findings.push(entry(label, "BLOCKED", "Host tidak dapat dihubungi; belum dapat memverifikasi publikasi."));
      return null;
    }
    if (response.status === 401 || response.status === 403) {
      findings.push(entry(label, "BLOCKED", "Akses publik ditolak (HTTP " + response.status + ")."));
      return null;
    }
    if (!response.ok) {
      findings.push(entry(label, "FAIL", "HTTP " + response.status + " — aset belum tersedia."));
      return null;
    }
    return response;
  }

  const index = await readPublic("/", "Halaman aplikasi");
  if (index) {
    const html = await index.text();
    const valid = /<link\b[^>]*rel=["']manifest["'][^>]*href=["']\/manifest\.webmanifest["']|<link\b[^>]*href=["']\/manifest\.webmanifest["'][^>]*rel=["']manifest["']/i.test(html);
    findings.push(entry("Halaman aplikasi", valid ? "PASS" : "FAIL",
      valid ? "Tautan manifest ditemukan di HTML." : "Tautan manifest belum ditemukan dalam HTML."));
  }

  const manifestResponse = await readPublic("/manifest.webmanifest", "Manifest PWA");
  if (manifestResponse) {
    let manifest;
    try {
      manifest = JSON.parse(await manifestResponse.text());
    } catch { manifest = null; }
    const valid = manifest &&
      manifest.name === "Baturaden 25 Homestay" &&
      manifest.start_url === "/" && manifest.scope === "/" &&
      manifest.id === "/" && manifest.display === "standalone";
    findings.push(entry("Manifest PWA", valid ? "PASS" : "FAIL",
      valid ? "Brand, scope, start URL, dan standalone sesuai." : "Manifest tidak sesuai atau bukan JSON."));
    if (valid) {
      const required = [
        ["/pwa/icon-192.png", 192, "any"],
        ["/pwa/icon-512.png", 512, "any"],
        ["/pwa/icon-maskable-512.png", 512, "maskable"],
      ];
      for (const [path, size, purpose] of required) {
        const found = manifest.icons?.some(icon =>
          icon.src === path && icon.sizes === size + "x" + size &&
          icon.type === "image/png" && icon.purpose?.split(/\s+/).includes(purpose));
        if (!found) {
          findings.push(entry("Ikon " + size + " (" + purpose + ")", "FAIL",
            "Manifest belum merujuk ikon yang sesuai."));
          continue;
        }
        const img = await readPublic(path, "Ikon " + size + " (" + purpose + ")");
        if (!img) continue;
        const bytes = new Uint8Array(await img.arrayBuffer());
        const isPng = bytes.length >= 24 &&
          [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const dimensions = isPng && view.getUint32(16) === size && view.getUint32(20) === size;
        const type = img.headers.get("content-type") || "";
        const success = dimensions && type.toLowerCase().includes("image/png");
        findings.push(entry("Ikon " + size + " (" + purpose + ")", success ? "PASS" : "FAIL",
          success ? "PNG tersedia dengan ukuran tepat." : "Berkas bukan PNG sesuai ukuran/MIME."));
      }
    }
  }

  const sw = await readPublic("/sw.js", "Service worker");
  if (sw) {
    const mime = (sw.headers.get("content-type") || "").toLowerCase();
    const script = await sw.text();
    const success = /javascript/.test(mime) &&
      script.includes('OFFLINE_PATH = "/offline.html"') &&
      script.includes('fetch(request)');
    findings.push(entry("Service worker", success ? "PASS" : "FAIL",
      success ? "Berkas JavaScript tersedia." : "MIME/isi service worker tidak sesuai."));
  }

  const offline = await readPublic("/offline.html", "Halaman offline");
  if (offline) {
    const html = await offline.text();
    const success = /Koneksi internet terputus/.test(html) &&
      /Tidak ada transaksi yang disimpan secara offline/.test(html);
    findings.push(entry("Halaman offline", success ? "PASS" : "FAIL",
      success ? "Halaman pemberitahuan tersedia." : "Isi offline tidak sesuai."));
  }

  return { origin, findings, overall:
    findings.some(f => f.status === "FAIL") ? "FAIL" :
    findings.some(f => f.status === "BLOCKED") ? "BLOCKED" : "PASS" };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  const raw = process.argv[2];
  if (!raw) {
    console.error("Pemakaian: node scripts/pwa-deployment-smoke.mjs https://alamat-aplikasi");
    process.exitCode = 2;
  } else {
    try {
      const report = await auditPwa(raw);
      console.log("PWA HTTP SMOKE:", report.origin);
      for (const f of report.findings) console.log(f.status, f.label, "—", f.reason);
      console.log("HASIL:", report.overall);
      if (report.overall !== "PASS") process.exitCode = 1;
    } catch (error) {
      console.error("ERROR:", error.message);
      process.exitCode = 2;
    }
  }
}

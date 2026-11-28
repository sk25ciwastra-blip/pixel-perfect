const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');

test('manifest holds brand, stable scope, and correct PNG icon sizes',()=>{
  const m = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(m.name,'Baturaden 25 Homestay');
  assert.equal(m.id,'/');
  assert.equal(m.scope,'/');
  assert.equal(m.start_url,'/');
  assert.equal(m.display,'standalone');
  for(const [name,size] of [['icon-192.png','192x192'],['icon-512.png','512x512'],['icon-maskable-512.png','512x512']]){
    const icon=m.icons.find(i=>i.src.endsWith('/'+name));
    assert.equal(icon?.sizes,size);
    assert.equal(icon?.type,'image/png');
    const png=fs.readFileSync(path.join(root,'public/pwa',name));
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    const dimension=Number(size.split('x')[0]);
    assert.equal(png.readUInt32BE(16),dimension);
    assert.equal(png.readUInt32BE(20),dimension);
  }
});

test('service worker caches only public offline notice and never POST, API or private screens',()=>{
  const sw=read('public/sw.js');
  assert.match(sw,/request\.mode !== "navigate"/);
  assert.match(sw,/request\.method !== "GET"/);
  assert.match(sw,/fetch\(request\)/);
  assert.match(sw,/cache\.add\(OFFLINE_PATH\)/);
  assert.doesNotMatch(sw,/cache\.put\(/);
  assert.doesNotMatch(sw,/cache\.addAll\(/);
  assert.match(read('public/offline.html'),/Tidak ada transaksi yang disimpan secara offline/);
});

test('root links manifest and registers PWA without touching operational access gates',()=>{
  const rootRoute=read('src/routes/__root.tsx');
  assert.match(rootRoute,/rel: "manifest", href: "\/manifest\.webmanifest"/);
  assert.match(rootRoute,/registerOfflineSafePwa\(\)/);
  assert.match(rootRoute,/<AccessGate><Outlet \/><\/AccessGate>/);
});

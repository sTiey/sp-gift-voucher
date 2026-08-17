/**
 * dev-server.mjs — เซิร์ฟเวอร์ไฟล์นิ่ง ๆ สำหรับเปิดดูตัวอย่างระหว่างทำงาน
 * รันด้วย:  node tools/dev-server.mjs   แล้วเปิด  http://localhost:4173
 * ไม่ต้องลงอะไรเพิ่ม ใช้ Node เปล่า ๆ
 */

import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(fileURLToPath(import.meta.url), '..', '..'));
const PORT = Number(process.env.PORT || 4173);

/* ── ตัวเซฟค่าจากแผงปรับดีไซน์ (/demo/tune.html) ───────────────────────────
   เขียนทับ "ตัวเลขหลังเครื่องหมาย :" ในบล็อก @tune ของไฟล์ดีไซน์เท่านั้น
   ตั้งใจให้ทำได้แค่นี้ เพราะเป็นการให้หน้าเว็บเขียนไฟล์ต้นฉบับ:
     · แก้ได้เฉพาะบรรทัดที่ "มีอยู่แล้ว" — เพิ่ม/ลบบรรทัดไม่ได้
     · ชื่อค่าต้องขึ้นต้น --lt- และเป็นตัวเลขในช่วงที่สมเหตุสมผล
     · รับเฉพาะคำสั่งจากเครื่องตัวเอง
   ⚠️ ของเล่นสำหรับตอนพัฒนา อยู่ในไฟล์นี้ไฟล์เดียว ไม่ได้ติดไปกับตัวระบบจริง  */

const TUNE_FILE = join(ROOT, 'src', 'styles', 'designs', 'limeticket.css');
const SHAPES = new Set(['ticket', 'compact']);

const isLocal = (req) => {
  const a = req.socket.remoteAddress || '';
  return a === '::1' || a === '127.0.0.1' || a === '::ffff:127.0.0.1';
};

const readJson = (req) =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 65536) reject(new Error('ข้อมูลยาวเกินไป'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('อ่าน JSON ไม่ออก')); }
    });
    req.on('error', reject);
  });

/** ตัดศูนย์ท้ายทิ้ง: 2.60 → 2.6 · 9.0 → 9 */
const tidy = (n) => String(Number(n.toFixed(3)));

async function saveTune(payload) {
  const src = await readFile(TUNE_FILE, 'utf8');
  let out = src;
  const changed = [];
  const skipped = [];

  for (const [shape, knobs] of Object.entries(payload || {})) {
    if (!SHAPES.has(shape) || !knobs || typeof knobs !== 'object') { skipped.push(shape); continue; }
    const open = `/* @tune:${shape} */`;
    const i = out.indexOf(open);
    const j = i < 0 ? -1 : out.indexOf('/* @tune:end */', i);
    if (i < 0 || j < 0) { skipped.push(`${shape} (ไม่เจอบล็อก @tune)`); continue; }

    let block = out.slice(i, j);
    for (const [name, value] of Object.entries(knobs)) {
      if (!/^--lt-[a-z0-9-]+$/.test(name)) { skipped.push(name); continue; }
      const num = Number(value);
      if (!Number.isFinite(num) || num < -50 || num > 200) { skipped.push(name); continue; }
      /* ต้องมีบรรทัดนี้อยู่ก่อน — ไม่งั้นข้าม ไม่แอบเพิ่มบรรทัดใหม่ */
      const re = new RegExp(`(^[ \\t]*${name}:[ \\t]*)(-?[0-9.]+)([ \\t]*;)`, 'm');
      const hit = block.match(re);
      if (!hit) { skipped.push(name); continue; }
      if (hit[2] !== tidy(num)) changed.push(`${shape} ${name}: ${hit[2]} → ${tidy(num)}`);
      block = block.replace(re, `$1${tidy(num)}$3`);
    }
    out = out.slice(0, i) + block + out.slice(j);
  }

  if (out !== src) await writeFile(TUNE_FILE, out, 'utf8');
  return { changed, skipped };
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(req.url.split('?')[0]);

    if (path === '/__tune') {
      if (req.method !== 'POST' || !isLocal(req)) { res.writeHead(405).end('ไม่รับคำสั่งนี้'); return; }
      const result = await saveTune(await readJson(req));
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      console.log(`เซฟค่าดีไซน์ ${result.changed.length} ค่า`, ...result.changed.map((c) => `\n  ${c}`));
      return;
    }

    /* ต้อง "ส่งต่อ" ไม่ใช่ "เสิร์ฟทับ" ที่ราก — ไม่งั้นลิงก์แบบสัมพัทธ์ในหน้า
       (./showcase.css) จะไปหาที่รากแล้ว 404 ทั้งที่ไฟล์มีอยู่ */
    if (path === '/') {
      res.writeHead(302, { location: '/demo/index.html' }).end();
      return;
    }
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }

    const info = await stat(file).catch(() => null);
    const target = info?.isDirectory() ? join(file, 'index.html') : file;
    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': TYPES[extname(target)] || 'application/octet-stream',
      'cache-control': 'no-store', // ระหว่างพัฒนาต้องเห็นของใหม่เสมอ
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('ไม่พบไฟล์');
  }
}).listen(PORT, () => {
  console.log(`VoucherKit dev  →  http://localhost:${PORT}`);
});

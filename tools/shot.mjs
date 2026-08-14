/**
 * shot.mjs — แคปหน้าจอหน้าเว็บด้วย Chrome/Edge ที่ติดตั้งอยู่แล้วในเครื่อง
 * ---------------------------------------------------------------------------
 * ใช้ตอนอยากเห็นผลจริงว่าหน้าออกมาหน้าตายังไง โดยไม่ต้องเปิดเบราว์เซอร์เอง
 *
 *   node tools/shot.mjs <url> <ไฟล์ออก.png> [กว้าง] [สูง]
 *   node tools/shot.mjs http://localhost:4173/demo/index.html out.png 1440 3000
 *
 * ⚠️ ข้อจำกัดที่ต้องรู้: โหมดนี้ "ไม่ใช่มือถือจริง"
 *    บั๊กที่โผล่เฉพาะบน iOS/Android จริง (แถบดำใต้จอ · การกระพริบตอนเลื่อน)
 *    เครื่องมือนี้มองไม่เห็นเด็ดขาด ต้องเปิดบนเครื่องจริงเท่านั้น
 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) {
  console.error('หา Chrome หรือ Edge ในเครื่องไม่เจอ');
  process.exit(1);
}

const [url, out = 'shot.png', w = '1440', h = '2400'] = process.argv.slice(2);
if (!url) {
  console.error('ใช้: node tools/shot.mjs <url> <out.png> [width] [height]');
  process.exit(1);
}

const outPath = resolve(out);
mkdirSync(dirname(outPath), { recursive: true });
if (existsSync(outPath)) rmSync(outPath);

const profile = resolve(process.env.TEMP || '.', `vk-shot-${process.pid}`);

const args = [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${profile}`,
  `--window-size=${w},${h}`,
  '--virtual-time-budget=6000', // รอ font + script ทำงานให้เสร็จก่อนถ่าย
  `--screenshot=${outPath}`,
  url,
];

const child = spawn(browser, args, { stdio: ['ignore', 'ignore', 'pipe'] });
let err = '';
child.stderr.on('data', (d) => { err += d; });
child.on('exit', () => {
  rmSync(profile, { recursive: true, force: true });
  if (existsSync(outPath)) {
    console.log(`OK  ${outPath}  (${w}x${h})`);
  } else {
    console.error('ถ่ายไม่สำเร็จ');
    console.error(err.split('\n').filter((l) => l.trim()).slice(-6).join('\n'));
    process.exit(1);
  }
});

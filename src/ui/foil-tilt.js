/**
 * foil-tilt.js — ทำให้คูปองเอียงตามเมาส์/การหมุนเครื่อง แล้วประกายทองวิ่งตาม
 * ---------------------------------------------------------------------------
 * ใช้ไลบรารี VanillaTilt (อยู่ใน vendor/ ไม่ได้ดึงจากเน็ตตอนใช้งาน) เล็ก ~9KB ไม่พึ่งอะไรเลย
 * ใช้มันเฉพาะ "เอียงใบตามเมาส์" เท่านั้น
 *
 * สิ่งที่ไฟล์นี้ทำเพิ่ม:
 *   1. เอาองศาที่กำลังเอียงไปขยับ "การสะท้อนสภาพแวดล้อม" บนตัวเลข
 *      → ประกายวิ่งตามการเอียงจริง ไม่ใช่แอนิเมชันวนลูปที่วิ่งเองไม่สนใจอะไร
 *   2. **ไจโรสโคปเขียนเองทั้งหมด** — ของไลบรารีใช้ไม่ได้บน iOS (เหตุผลเต็มอยู่ตรงศูนย์กลางข้างล่าง)
 *      ขอสิทธิ์ให้ผ่านก่อนแล้วค่อยฟัง · หมุนแกนตามการหมุนจอ · จำท่าถือปกติของคนใช้
 *      · นับสัญญาณไว้ให้ตรวจได้ว่ามันทำงานจริงไหม
 *
 * ⚠️ ข้อจำกัดที่แก้ที่โค้ดไม่ได้ ต้องรู้ไว้:
 *   · iOS 13+ ต้องขอสิทธิ์ และ **ขอได้เฉพาะตอนผู้ใช้แตะจอ** — เรียกตอนโหลดหน้าไม่ได้
 *   · ต้องอยู่บน HTTPS — เปิดผ่าน IP วงแลน (http://192.168.x.x) ไจโรจะเงียบสนิท
 *     ไม่มี error ใด ๆ การ์ดแค่ไม่ขยับ → เทสบนมือถือต้อง deploy เอาลิงก์ https
 *   · ผู้ใช้ปิด Settings → Safari → Motion & Orientation Access ไว้ = ถูกปฏิเสธเงียบ ๆ
 *     → `gyroStatus().state` จะเป็น 'denied' ให้หน้าเว็บเอาไปบอกได้
 */

const VENDOR = new URL('../../vendor/vanilla-tilt.js', import.meta.url).href;

let pending = null;

/** โหลดไลบรารีครั้งเดียว แล้วใช้ซ้ำ (เป็นสคริปต์แบบ UMD จึงไปอยู่ที่ window) */
function loadTilt() {
  if (window.VanillaTilt) return Promise.resolve(window.VanillaTilt);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = VENDOR;
      tag.onload = () => (window.VanillaTilt ? resolve(window.VanillaTilt) : reject(new Error('โหลดแล้วแต่ไม่เจอ VanillaTilt')));
      tag.onerror = () => reject(new Error('โหลด vanilla-tilt ไม่สำเร็จ'));
      document.head.append(tag);
    });
  }
  return pending;
}

/* ══════════════════════════════════════════════════════════════════════════
   ศูนย์กลางการเอียงเครื่อง (ไจโรสโคป)
   ──────────────────────────────────────────────────────────────────────────
   ⚠️ ทำไมต้องเขียนเอง ไม่ใช้ของไลบรารี — ผลทดสอบบนเครื่องจริง 2026-08-18
      เอียงเครื่องแล้วการ์ดไม่ขยับเลย ลากนิ้วขยับปกติ · เจอสามเรื่องซ้อนกัน:

      1. ไลบรารี **สมัครฟังการเอียงตั้งแต่ตอน init()** ซึ่งคือก่อนได้สิทธิ์เสมอ
         (iOS ขอสิทธิ์ได้เฉพาะตอนผู้ใช้แตะ ซึ่งเกิดทีหลัง) แล้วมันไม่เคยกลับไปสมัครใหม่
         → ขอสิทธิ์ให้ผ่านก่อน **แล้วค่อยสมัครฟัง** ทางเดียวเท่านั้น
      2. ผลของการขอสิทธิ์ถูกทิ้ง ไม่มีใครรับ → ถูกปฏิเสธหรือเครื่องปิดเซนเซอร์ไว้
         ก็เงียบสนิทเหมือนกันหมด แยกไม่ออก → เก็บสถานะ + **นับจำนวนสัญญาณ** ไว้ให้อ่าน
      3. ไลบรารีไม่รู้จักการหมุนจอ — beta/gamma สลับความหมายเมื่อถือแนวนอน
         → หมุนแกนตามมุมจอก่อนใช้ทุกครั้ง

   ⚠️ ต้องอยู่บน HTTPS — เปิดผ่าน IP วงแลน (http://192.168.x.x) เซนเซอร์เงียบสนิท
      ไม่มี error ใด ๆ → เทสบนมือถือต้อง deploy เอาลิงก์ https
   ══════════════════════════════════════════════════════════════════════════ */

/* องศาที่เอียงจากท่าถือปกติแล้วนับว่า "สุดทาง" — แคบไปจะไวจนสั่น กว้างไปจะเอียงเท่าไหร่ก็ไม่ขยับ */
const GYRO_RANGE = 30;
/* จำนวนสัญญาณแรกที่ใช้จำ "ท่าถือปกติ" ของคนคนนั้น — คนถือมือถือเอียงเข้าหาตัวราว 30-50°
   ถ้าไม่จำท่าตั้งต้น การ์ดจะค้างสุดทางตั้งแต่ยังไม่ขยับ แล้วเอียงยังไงก็ไม่กลับ */
const GYRO_CALIBRATE = 8;

/* ══ ปรับศูนย์ตามท่าถือตลอดเวลา — แก้อาการ "ค้างเหมือนกำลังเอียงอยู่" ══
   ⚠️ ไท้เจอจริงบน iPhone 2026-08-19 — วางเครื่องราบนิ่งสนิท แต่ประกายค้างสุดขอบ
      วัดได้จริง: β0 γ0 นิ่งสนิท แต่ประกายอยู่ที่ 123% คือสุดขอบ
   ต้นเหตุ: ท่าถือตั้งต้นจำแค่ครั้งเดียวตอนเริ่ม แล้วไม่เคยอัปเดตอีกเลย
      คนใช้มือถือเปลี่ยนท่าตลอด (นั่ง นอน วางโต๊ะ หยิบขึ้นมาใหม่) ค่าอ้างอิงเดิมจึงผิดทันที
   ทางแก้: เลื่อนศูนย์ไล่ตามท่าปัจจุบันช้า ๆ ตลอดเวลา
     · ช้ามาก (ราว 11 วินาที) ตอนอยู่ในช่วงปกติ — เอียงแล้วประกายยังค้างตามที่ควร
     · เร็วขึ้น (ราว 1.7 วินาที) เมื่อค่าชนขอบ — อาการค้างจึงหายเองในไม่กี่วินาที */
/* หน่วยเป็น "ต่อวินาที" ไม่ใช่ "ต่อสัญญาณ"
   ⚠️ เครื่องส่งสัญญาณไม่เท่ากัน: iPhone 60 ครั้ง/วินาที แอนดรอยด์บางรุ่นเหลือ 10
   ถ้าคิดเป็นต่อสัญญาณ เครื่องช้าจะคลายตัวช้ากว่าหกเท่า = ค้างนานมาก
   คิดเป็นวินาทีแล้วทุกเครื่องรู้สึกเหมือนกัน */
const GYRO_FOLLOW_SLOW = 0.09;   /* ต่อวินาที — ตัวคงเวลาราว 11 วินาที */
const GYRO_FOLLOW_EDGE = 0.75;   /* ตอนค้างสุดขอบ — ราว 1.3 วินาที */

const gyro = {
  /* idle = ยังไม่ขอ · unsupported = เครื่องไม่มี · denied = ถูกปฏิเสธ/ปิดไว้
     granted = ได้สิทธิ์แล้วแต่ยังไม่มีสัญญาณ · live = มีสัญญาณเข้ามาจริง */
  state: 'idle',
  events: 0,
  nulls: 0,
  angle: null,
  subs: new Set(),
  zero: null,
  seen: 0,
  bound: null,
  source: null,
  lastAt: 0,
};

function screenAngle() {
  const a = screen.orientation?.angle;
  return typeof a === 'number' ? a : (window.orientation || 0);
}

/* ช่องดูค่าดิบสำหรับหน้าตรวจ — ต้องเกาะ "ตัวจริง" ตัวนี้ ไม่ใช่เขียนตัวฟังใหม่ซ้อน
   ไม่งั้นหน้าตรวจจะทดสอบโค้ดคนละชุดกับที่ลูกค้าใช้จริง = ผ่านไปก็ไม่ได้พิสูจน์อะไร */
const rawSubs = new Set();

/** ดูค่าดิบทุกสัญญาณที่เข้ามา (รวมสัญญาณค่าว่าง) · คืนฟังก์ชันไว้เลิกดู */
export function subscribeGyroRaw(fn) {
  rawSubs.add(fn);
  return () => rawSubs.delete(fn);
}

function emitRaw(o) {
  for (const fn of rawSubs) { try { fn(o); } catch { /* หน้าตรวจพังต้องไม่ลาก effect ตาย */ } }
}

function onOrientation(ev) {
  const at = performance.now();
  /* เครื่องที่ไม่มีเซนเซอร์ยังยิง event มาได้ แต่ค่าเป็น null ทั้งหมด — ต้องแยกให้ออก
     ไม่งั้นจะรายงานว่า "ทำงานอยู่" ทั้งที่ไม่มีอะไรเลย */
  if (ev.gamma === null || ev.beta === null || ev.gamma === undefined) {
    gyro.nulls += 1;
    emitRaw({ at, type: ev.type, empty: true });
    return;
  }
  /* ⚠️ แอนดรอยด์บางรุ่นเงียบสนิทกับ 'deviceorientation' แต่ส่ง 'deviceorientationabsolute' มาแทน
     จึงฟังทั้งสองทาง แล้ว **ยึดทางที่ส่งมาก่อนเป็นทางเดียว** ปล่อยฟังทั้งคู่ไว้
     เครื่องที่ส่งทั้งสองทางจะขยับเป็นสองเท่าและกระตุก */
  if (!gyro.source) {
    gyro.source = ev.type;
    const other = ev.type === 'deviceorientation' ? 'deviceorientationabsolute' : 'deviceorientation';
    window.removeEventListener(other, gyro.bound);
  } else if (ev.type !== gyro.source) {
    return;
  }
  gyro.events += 1;
  gyro.state = 'live';

  /* หมุนแกนให้ตรงกับสิ่งที่ตาเห็นบนจอ — ถือแนวนอนแล้ว beta/gamma สลับหน้าที่กัน */
  const th = (screenAngle() * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  const sx = ev.gamma * cos + ev.beta * sin;
  const sy = ev.beta * cos - ev.gamma * sin;

  if (gyro.seen < GYRO_CALIBRATE) {
    gyro.seen += 1;
    gyro.zero = gyro.zero
      ? { x: (gyro.zero.x + sx) / 2, y: (gyro.zero.y + sy) / 2 }
      : { x: sx, y: sy };
    emitRaw({ at, type: ev.type, empty: false, calibrating: true, beta: ev.beta, gamma: ev.gamma, screen: screenAngle(), sx, sy });
    return;
  }

  const dx = sx - gyro.zero.x;
  const dy = sy - gyro.zero.y;
  /* ค้างสุดขอบเมื่อไหร่ ไล่ศูนย์กลับเร็วขึ้น — จุดนี้แหละที่เคยค้าง */
  /* ไล่เร็วขึ้นตามระยะที่ห่างศูนย์ (กำลังสอง) — ไม่ใช่เปิด/ปิดทีเดียว
     เอียงนิดหน่อยแล้วค้างไว้ ไล่ช้า ๆ · เปลี่ยนท่าถือทั้งที ไล่กลับในราว 3-4 วินาที
     ถ้าใช้ความเร็วเดียวทั้งหมด: เร็วไปการเอียงค้างไม่อยู่ · ช้าไปก็ค้างสุดขอบเหมือนเดิม */
  const r = Math.min(1, Math.max(Math.abs(dx), Math.abs(dy)) / GYRO_RANGE);
  const dt = Math.min(0.2, gyro.lastAt ? (at - gyro.lastAt) / 1000 : 0.016);
  gyro.lastAt = at;
  const k = 1 - Math.exp(-(GYRO_FOLLOW_SLOW + (GYRO_FOLLOW_EDGE - GYRO_FOLLOW_SLOW) * r * r) * dt);
  gyro.zero.x += dx * k;
  gyro.zero.y += dy * k;

  const fx = 0.5 + dx / (GYRO_RANGE * 2);
  const fy = 0.5 + dy / (GYRO_RANGE * 2);
  gyro.angle = [Math.round(dx), Math.round(dy)];
  emitRaw({
    at, type: ev.type, empty: false,
    beta: ev.beta, gamma: ev.gamma, alpha: ev.alpha,
    screen: screenAngle(),
    sx, sy, dx, dy, zx: gyro.zero.x, zy: gyro.zero.y,
    fx: Math.min(Math.max(fx, 0), 1), fy: Math.min(Math.max(fy, 0), 1),
  });
  for (const fn of gyro.subs) fn(Math.min(Math.max(fx, 0), 1), Math.min(Math.max(fy, 0), 1));
}

function startGyro() {
  if (gyro.bound) return;
  gyro.bound = onOrientation;
  window.addEventListener('deviceorientation', gyro.bound, { passive: true });
  window.addEventListener('deviceorientationabsolute', gyro.bound, { passive: true });
  if (gyro.state === 'idle') gyro.state = 'granted';
  /* หมุนเครื่องไปแนวนอน = ท่าถือตั้งต้นเปลี่ยนไปคนละเรื่อง ต้องจำใหม่ */
  window.addEventListener('orientationchange', recalibrateGyro, { passive: true });
}

/** ลืมท่าถือเดิมแล้วจำใหม่จากสัญญาณชุดถัดไป */
export function recalibrateGyro() {
  gyro.zero = null;
  gyro.seen = 0;
}

/**
 * ขอสิทธิ์ใช้ไจโรสโคป — **ต้องเรียกจากใน event ที่ผู้ใช้แตะเท่านั้น**
 * เครื่องที่ไม่ต้องขอ (แอนดรอยด์/คอม) จะเริ่มฟังได้เลย
 *
 * ⚠️ `D.requestPermission()` ต้องถูก "เรียก" ในจังหวะเดียวกับที่ผู้ใช้แตะ
 *    เขียนเป็น async ได้ เพราะตัวฟังก์ชันวิ่งถึงบรรทัด await แบบซิงโครนัสก่อนจะหยุด
 *    แต่ห้ามเอาไปใส่ใน setTimeout หรือหลัง await อื่น — iOS จะปฏิเสธทันที
 */
export async function requestGyro() {
  const D = window.DeviceOrientationEvent;
  if (!D) { gyro.state = 'unsupported'; return false; }
  if (typeof D.requestPermission !== 'function') { startGyro(); return true; }
  try {
    const ok = (await D.requestPermission()) === 'granted';
    if (!ok) { gyro.state = 'denied'; return false; }
    startGyro();
    return true;
  } catch {
    /* โยน error เมื่อไม่ได้เรียกจากการแตะจริง ๆ — ยังขอใหม่ได้ จึงกลับไปเป็น idle */
    gyro.state = 'idle';
    return false;
  }
}

/** สถานะไจโรแบบอ่านได้ — หน้าเทสเอาไปแสดงและส่งกลับมาให้ตรวจได้ */
export function gyroStatus() {
  return {
    state: gyro.state,
    events: gyro.events,
    nulls: gyro.nulls,
    angle: gyro.angle,
    source: gyro.source,
    calibrated: gyro.seen >= GYRO_CALIBRATE,
    range: GYRO_RANGE,
    needsPermission: typeof window.DeviceOrientationEvent?.requestPermission === 'function',
    listening: Boolean(gyro.bound),
    cards: gyro.subs.size,
    secure: window.isSecureContext !== false,
  };
}

const REDUCED = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * ติดการเอียง + ประกายวิ่งให้การ์ดหนึ่งใบ
 * @param {HTMLElement} card  กล่อง .vk-card
 * @param {{max?:number, glare?:number, sweep?:[number,number]}} opt
 * @returns {Promise<null|{destroy():void}>}  null = ไม่ติด (ผู้ใช้ปิดแอนิเมชัน)
 */
export async function attachFoilTilt(card, opt = {}) {
  if (!card) return { state: 'no-card' };
  /* ⚠️ ถ้าเครื่องตั้งค่า "ลดแอนิเมชัน" ไว้ ทุกอย่างจะเงียบสนิทโดยไม่มีอะไรฟ้อง
     จึงต้องคืนสถานะออกไปให้หน้าเว็บเอาไปแสดง ไม่ใช่คืน null เฉย ๆ
     (Windows ปิดเอฟเฟกต์แอนิเมชันไว้ก็เข้าเงื่อนไขนี้ — คนตั้งไว้เยอะกว่าที่คิด) */
  if (REDUCED() && !opt.force) return { state: 'reduced-motion', destroy() {} };
  /* เครื่องสเปกต่ำ: ข้ามการเอียงไปเลย เหลือหน้าตา "ตอนพัก" ซึ่งคือแบบที่ไท้อนุมัติ
     ผิวฟอยล์ ขอบรับแสง เงา ครบเหมือนเดิมทุกอย่าง ต่างแค่ไม่ขยับตามเมาส์
     ดีกว่าปล่อยให้กระตุกจนใช้ไม่ได้ · เบราว์เซอร์เก่าที่ไม่บอกสเปกจะถือว่าแรงพอ */
  if (!opt.force && (navigator.deviceMemory <= 2 || navigator.hardwareConcurrency <= 2)) {
    return { state: 'low-end', destroy() {} };
  }

  let VanillaTilt;
  try {
    VanillaTilt = await loadTilt();
  } catch (err) {
    return { state: 'load-failed', error: err.message, destroy() {} };
  }
  const [lo, hi] = opt.sweep || [8, 92];

  VanillaTilt.init(card, {
    /* 9° มองแทบไม่ออกบนใบแบน ๆ กว้าง ๆ — ไท้อัดคลิปมาแล้วยังนึกว่าไม่ขยับเลย
       13° คือจุดที่เห็นชัดว่าเอียงจริงโดยยังไม่ดูเป็นของเล่น */
    max: opt.max ?? 13,
    speed: 480,
    scale: 1.02,
    perspective: 1100,
    glare: true,
    'max-glare': opt.glare ?? 0.16,
    /* ⚠️ ปิดไจโรของไลบรารีทิ้ง — มันสมัครฟังตั้งแต่ init() คือก่อนได้สิทธิ์เสมอ
       แล้วไม่เคยกลับไปสมัครใหม่ · เราขับเองจากศูนย์กลางข้างบนแทน ทางเดียวจบ */
    gyroscope: false,
    transition: true,
    reset: true,
  });

  /* ไลบรารีส่งตำแหน่งปัจจุบันมาให้ทุกเฟรมเป็น 0–100
     เอามาแปลงเป็นตำแหน่งแผ่นฟอยล์ → เอียงซ้ายประกายไปทางหนึ่ง เอียงขวาไปอีกทาง

     ตัวใบเอียงด้วยการ์ดจอ (แทบไม่กินแรง) แต่การเลื่อนแผ่นฟอยล์ต้องวาดตัวเลขใหม่
     จึงกันไม่ให้สั่งวาดถี่เกินจำเป็น: ขยับไม่ถึงครึ่งเปอร์เซ็นต์ = ข้ามไปเลย
     ตาคนมองไม่เห็นความต่างระดับนั้นอยู่แล้ว แต่ช่วยลดการวาดได้เยอะบนมือถือ */
  let lastX = -999;
  let lastY = -999;

  /* ⚠️ นี่คือ "การสะท้อนสภาพแวดล้อม" ไม่ใช่ "ดวงไฟวิ่ง" — ไท้ทักว่าดวงไฟหลายดวง
     เรียงกันเป็นสิ่งที่ธรรมชาติสร้างไม่ได้ ซึ่งถูกต้อง จึงเปลี่ยนมาขยับ 3 อย่างนี้แทน:

       เส้นขอบฟ้า (hz)  ตามแกนตั้ง  — เงยใบขึ้นเห็นเพดานมาก ขอบฟ้าเลื่อนลง ผิวสว่างขึ้น
       แถบไฟเพดาน (lx)  ตามแกนนอน  — เลื่อนสวนทางการเอียง เหมือนเงาสะท้อนของจริง
       ทิศขอบนูน (bx/by)            — ด้านรับแสงกับด้านตกเงาสลับข้างเมื่อแหล่งแสงย้าย

     ช่วงของขอบฟ้าแคบกว่าของแถบไฟตั้งใจ — กวาดเต็ม 0-100 แล้วจะเหลือแต่ทองซีด
     หรือทองมืดทั้งตัว ซึ่งไม่ใช่สิ่งที่เกิดขึ้นจริงในห้องปกติ */
  /* ⚠️ ไม่ได้ "ขยับดวงไฟ" แล้ว — ดวงไฟอยู่นิ่งตามความจริง
     สิ่งที่ขยับคือ **ตำแหน่งที่หยิบแผนที่ห้องมาใช้** เหมือนพลิกวัตถุจริงแล้วเห็นห้องคนละมุม
     สวนทางกับการเอียง เพราะภาพสะท้อนวิ่งสวนทางการหมุนของผิวเสมอ */
  const ENV = 145;          /* ระยะที่เลื่อนแผนที่ (% ของกล่อง) ยิ่งมากยิ่งไวต่อการเอียง */
  /* กวาดกว้างขึ้นกว่าเดิม เพื่อให้ขอบรับแสงเดินรอบตัวอักษรได้ชัดเวลาพลิก */
  /* ⚠️ ความหนาของขอบนูน — เคยดันขึ้นเป็น 4.0/2.0 ตอนตัดเงาฟุ้งออก
     ไท้ตีกลับ (2026-08-18) ว่า "นูนออกมาไกลเกินที่จะเป็นตัวอักษรปั๊มเคลือบเงา" — คืนค่าเดิม
     ฟอยล์ปั๊มบนกระดาษการ์ดนูนขึ้นมานิดเดียวจริง หนากว่านี้กลายเป็นตัวอักษรพลาสติกแปะทันที */
  const BEV_X = 2.0;        /* พิกเซล */
  const BEV_Y = 0.75;

  /* ⚠️ เบราว์เซอร์ยิง pointermove ได้เกิน 120 ครั้ง/วินาที แต่จอวาดได้แค่ 60
     เขียนสไตล์ทุกครั้งที่ยิง = คำนวณสไตล์ทิ้งไปกว่าครึ่ง
     รวบไว้แล้วเขียนทีเดียวตอนเบราว์เซอร์จะวาดจริง — ภาพที่ออกมาเหมือนกันเป๊ะ
     เพราะค่าสุดท้ายก่อนวาดคือค่าเดียวกัน แค่ไม่เสียแรงกับค่าระหว่างทางที่ไม่มีใครเห็น */
  let pending = null;
  let frame = 0;

  const flush = () => {
    frame = 0;
    if (!pending) return;
    const [cx, cy] = pending;
    pending = null;
    const x = (0.5 - cx) * ENV + 50;
    const y = (0.5 - cy) * ENV + 50;
    if (Math.abs(x - lastX) < 0.4 && Math.abs(y - lastY) < 0.4) return;
    lastX = x;
    lastY = y;
    const st = card.style;
    st.setProperty('--ft-ex', `${x.toFixed(1)}%`);
    st.setProperty('--ft-ey', `${y.toFixed(1)}%`);
    st.setProperty('--ft-px', `${((0.5 - cx) * 150).toFixed(1)}px`);
    st.setProperty('--ft-py', `${((0.5 - cy) * 150).toFixed(1)}px`);
    st.setProperty('--ft-bx', `${((cx - 0.5) * 2 * BEV_X).toFixed(2)}px`);
    /* ⚠️ ต้องเป็นบวกเสมอ = เงาทอดลงล่างเสมอ = ตัวอักษรนูนเสมอ
       ปล่อยให้ติดลบเมื่อไหร่ ตัวอักษรจะพลิกเป็นบุ๋มลงไปทันที */
    st.setProperty('--ft-by', `${(0.85 + (cy - 0.5) * 2 * BEV_Y).toFixed(2)}px`);
  };

  const setSpot = (fx, fy) => {
    pending = [Math.min(Math.max(fx, 0), 1), Math.min(Math.max(fy, 0), 1)];
    if (!frame) frame = requestAnimationFrame(flush);
  };

  /* ⚠️ ทางเดินที่ 1 — อ่านเมาส์จากใบเองตรง ๆ ไม่ผ่านไลบรารี
     เคยพลาด: พึ่ง event ของไลบรารีอย่างเดียว ซึ่งมันยิงจากลูปวาดภาพ
     ลูปนั้นหยุดเดินเมื่อแท็บ/พาเนลไม่ได้แสดงผล → ดวงแสงนิ่งสนิทโดยไม่มี error
     อ่านเองแบบนี้ทำงานทันทีที่เมาส์ขยับ ไม่ขึ้นกับจังหวะวาดภาพเลย */
  /* ⚠️ ในโหมดเต็มจอ ใบแนวยาวถูกหมุน 90° แต่เซนเซอร์กับนิ้วยังรายงานตามแกน "จอ"
     ถ้าไม่หมุนกลับ เอียงเครื่องไปซ้ายแล้วประกายจะวิ่งขึ้น-ลงแทนที่จะวิ่งซ้าย-ขวา
     opt.rotate เป็นองศาที่ตัวใบถูกหมุนอยู่ (0 หรือ 90) — เรียก setRotate() เปลี่ยนกลางคันได้ */
  let turn = opt.rotate || 0;
  const toLocal = (fx, fy) => (turn === 90 ? [fy, 1 - fx] : [fx, fy]);

  const onPointer = (ev) => {
    const r = card.getBoundingClientRect();
    if (!r.width || !r.height) return;
    setSpot(...toLocal((ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height));
  };
  const onLeave = () => {
    /* ⚠️ ตอนไจโรทำงานอยู่ ห้ามล้าง — บนมือถือ การยกนิ้วขึ้นยิง pointerleave ทุกครั้ง
       ถ้าล้างตรงนี้ ผิวจะกระพริบกลับไปท่าพักทุกครั้งที่แตะจอ ทั้งที่เครื่องยังเอียงอยู่ */
    if (gyro.state === 'live') return;
    for (const v of ['--ft-ex', '--ft-ey', '--ft-px', '--ft-py', '--ft-bx', '--ft-by']) card.style.removeProperty(v);
    lastX = lastY = -999;
  };

  /* ทางเดินที่ 2 — ค่าจากไลบรารี ใช้ตอนไลบรารีขยับใบเอง (รวมถึงที่เราป้อนให้ตอนเอียงเครื่อง) */
  const onTilt = (e) => {
    const px = e.detail?.percentageX;
    const py = e.detail?.percentageY;
    if (typeof px !== 'number' || typeof py !== 'number') return;
    setSpot(px / 100, py / 100);
  };

  /* ทางเดินที่ 3 — เอียงเครื่อง
     ⚠️ ไม่ตั้ง transform เอง แต่ **ป้อนเป็น mousemove ปลอมให้ไลบรารี** เพราะ:
        · เป็น API สาธารณะล้วน ไม่ต้องแตะข้างในไลบรารี
        · ได้ทางเดินเดียวกับเมาส์เป๊ะ ซึ่งพิสูจน์แล้วว่าทำงาน (ไท้เห็นใบเอียงตามนิ้วในคลิป)
        · ไลบรารียิง tiltChange ต่อให้เอง → ผิวฟอยล์ขยับตามโดยไม่ต้องเขียนซ้ำ
     ต้องส่ง mouseenter นำก่อนหนึ่งครั้ง เพราะไลบรารีวัดตำแหน่ง/ขนาดใบตอนนั้น */
  let entered = false;
  const onGyro = (sx, sy) => {
    const r = card.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const [fx, fy] = toLocal(sx, sy);
    if (!entered) {
      entered = true;
      card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    }
    card.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: false,
      clientX: r.left + fx * r.width,
      clientY: r.top + fy * r.height,
    }));
  };
  gyro.subs.add(onGyro);
  /* แอนดรอยด์/คอมไม่ต้องขอสิทธิ์ — เริ่มฟังได้เลย ไม่ต้องรอให้ผู้ใช้แตะก่อน
     (iOS ต้องรอ requestGyro() จากการแตะจริงเท่านั้น กฎของเครื่องเอง แก้ที่โค้ดไม่ได้) */
  if (typeof window.DeviceOrientationEvent?.requestPermission !== 'function'
      && window.DeviceOrientationEvent) {
    startGyro();
  }
  /* จอหมุน/หน้าเลื่อน = ตำแหน่งใบที่ไลบรารีจำไว้เก่าแล้ว ต้องให้มันวัดใหม่ */
  const remeasure = () => { entered = false; };
  addEventListener('resize', remeasure, { passive: true });
  addEventListener('scroll', remeasure, { passive: true });

  /* บอกล่วงหน้าว่าตัวเลขจะเปลี่ยนบ่อย → เบราว์เซอร์แยกมันเป็นชั้นของตัวเอง
     การวาดใหม่จึงจำกัดอยู่แค่ตัวเลข ไม่ลามไปวาดทั้งใบ
     ใส่ตอนติดและถอดตอนเลิกใช้ ไม่ทิ้งไว้ถาวรเพราะมันกินหน่วยความจำ */
  const paint = card.querySelector('.vk-card__value');
  if (paint) {
    /* ⚠️ ห้ามใส่ contain: paint ตรงนี้ — เงาที่ทอดออกนอกกล่องจะโดนตัดทิ้ง
       ซึ่งเปลี่ยนหน้าตาที่อนุมัติไปแล้ว · will-change อย่างเดียวพอ */
    paint.style.willChange = 'filter, background-position';
  }

  card.addEventListener('pointermove', onPointer, { passive: true });
  card.addEventListener('pointerleave', onLeave, { passive: true });
  card.addEventListener('tiltChange', onTilt);

  return {
    state: 'on',
    /** บอกว่าตอนนี้ใบถูกหมุนกี่องศา (โหมดเต็มจอสลับไปมาได้ตอนผู้ใช้หมุนเครื่อง) */
    setRotate(deg) { turn = deg || 0; lastX = lastY = -999; },
    /** ให้หน้าเว็บอ่านสถานะแสงปัจจุบันไปแสดงได้ ตอนไล่หาสาเหตุ */
    spot: () => [card.style.getPropertyValue('--ft-ex'), card.style.getPropertyValue('--ft-ey')],
    destroy() {
      gyro.subs.delete(onGyro);
      removeEventListener('resize', remeasure);
      removeEventListener('scroll', remeasure);
      card.removeEventListener('pointermove', onPointer);
      card.removeEventListener('pointerleave', onLeave);
      card.removeEventListener('tiltChange', onTilt);
      card.vanillaTilt?.destroy();
      if (paint) paint.style.willChange = '';
      if (frame) cancelAnimationFrame(frame);
      onLeave();
    },
  };
}

/**
 * foil-tilt.js — ทำให้คูปองเอียงตามเมาส์/การหมุนเครื่อง แล้วประกายทองวิ่งตาม
 * ---------------------------------------------------------------------------
 * ใช้ไลบรารี VanillaTilt (อยู่ใน vendor/ ไม่ได้ดึงจากเน็ตตอนใช้งาน)
 * เลือกตัวนี้เพราะ **มีไจโรสโคปมาในตัว** ซึ่งไลบรารีเอียงการ์ดตัวอื่นแทบไม่มี
 * และเล็ก (~9KB) ไม่พึ่งอะไรเลย
 *
 * สิ่งที่ไฟล์นี้ทำเพิ่มจากไลบรารี:
 *   1. เอาองศาที่กำลังเอียงไปขยับตำแหน่งดวงแสง (--ft-spot-x / --ft-spot-y)
 *      → ประกายวิ่งตามการเอียงจริง ไม่ใช่แอนิเมชันวนลูปที่วิ่งเองไม่สนใจอะไร
 *   2. ขอสิทธิ์ไจโรบน iOS ให้ (ไลบรารีไม่ได้ทำให้)
 *
 * ⚠️ 2 ข้อจำกัดของไจโรที่แก้ที่โค้ดไม่ได้ ต้องรู้ไว้:
 *   · iOS 13+ ต้องขอสิทธิ์ และ **ขอได้เฉพาะตอนผู้ใช้แตะจอ** — เรียกตอนโหลดหน้าไม่ได้
 *   · ต้องอยู่บน HTTPS — เปิดผ่าน IP วงแลน (http://192.168.x.x) ไจโรจะเงียบสนิท
 *     ไม่มี error ใด ๆ การ์ดแค่ไม่ขยับ → เทสบนมือถือต้อง deploy เอาลิงก์ https
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

/**
 * ขอสิทธิ์ใช้ไจโรสโคป — **ต้องเรียกจากใน event ที่ผู้ใช้แตะเท่านั้น**
 * เครื่องที่ไม่ต้องขอ (แอนดรอยด์/คอม) จะได้ true กลับไปเลย
 */
export async function requestGyro() {
  const D = window.DeviceOrientationEvent;
  if (!D || typeof D.requestPermission !== 'function') return true;
  try {
    return (await D.requestPermission()) === 'granted';
  } catch {
    return false;
  }
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
    gyroscope: true,
    gyroscopeMinAngleX: -32,
    gyroscopeMaxAngleX: 32,
    gyroscopeMinAngleY: -32,
    gyroscopeMaxAngleY: 32,
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

  /* แสงตกกระทบสวนทางกับการเอียง — เอียงขอบขวาเข้าหาตัว ดวงแสงวิ่งไปทางซ้าย
     นี่คือสิ่งที่ตาคาดหวังจากของจริง ถ้าวิ่งตามทางเดียวกันจะรู้สึกผิดทันที
     ขยับไม่ถึงครึ่งเปอร์เซ็นต์ = ข้ามไป (ตามองไม่เห็น แต่ลดการวาดใหม่ได้เยอะบนมือถือ) */
  const setSpot = (fx, fy) => {
    const x = hi - Math.min(Math.max(fx, 0), 1) * (hi - lo);
    const y = hi - Math.min(Math.max(fy, 0), 1) * (hi - lo);
    if (Math.abs(x - lastX) < 0.5 && Math.abs(y - lastY) < 0.5) return;
    lastX = x;
    lastY = y;
    card.style.setProperty('--ft-spot-x', `${x.toFixed(1)}%`);
    card.style.setProperty('--ft-spot-y', `${y.toFixed(1)}%`);
  };

  /* ⚠️ ทางเดินที่ 1 — อ่านเมาส์จากใบเองตรง ๆ ไม่ผ่านไลบรารี
     เคยพลาด: พึ่ง event ของไลบรารีอย่างเดียว ซึ่งมันยิงจากลูปวาดภาพ
     ลูปนั้นหยุดเดินเมื่อแท็บ/พาเนลไม่ได้แสดงผล → ดวงแสงนิ่งสนิทโดยไม่มี error
     อ่านเองแบบนี้ทำงานทันทีที่เมาส์ขยับ ไม่ขึ้นกับจังหวะวาดภาพเลย */
  const onPointer = (ev) => {
    const r = card.getBoundingClientRect();
    if (!r.width || !r.height) return;
    setSpot((ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    card.style.removeProperty('--ft-spot-x');
    card.style.removeProperty('--ft-spot-y');
    lastX = lastY = -999;
  };

  /* ทางเดินที่ 2 — ค่าจากไลบรารี ใช้ตอนหมุนเครื่อง (ไจโร) ซึ่งไม่มีเมาส์ให้อ่าน */
  const onTilt = (e) => {
    const px = e.detail?.percentageX;
    const py = e.detail?.percentageY;
    if (typeof px !== 'number' || typeof py !== 'number') return;
    setSpot(px / 100, py / 100);
  };

  card.addEventListener('pointermove', onPointer, { passive: true });
  card.addEventListener('pointerleave', onLeave, { passive: true });
  card.addEventListener('tiltChange', onTilt);

  return {
    state: 'on',
    /** ให้หน้าเว็บอ่านตำแหน่งดวงแสงปัจจุบันไปแสดงได้ ตอนไล่หาสาเหตุ */
    spot: () => [card.style.getPropertyValue('--ft-spot-x'), card.style.getPropertyValue('--ft-spot-y')],
    destroy() {
      card.removeEventListener('pointermove', onPointer);
      card.removeEventListener('pointerleave', onLeave);
      card.removeEventListener('tiltChange', onTilt);
      card.vanillaTilt?.destroy();
      onLeave();
    },
  };
}

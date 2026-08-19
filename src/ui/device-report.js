/**
 * device-report.js — เก็บผลการทดสอบบนเครื่องจริงแบบอัตโนมัติ
 * ---------------------------------------------------------------------------
 * มีไว้เพราะ **ทุกอย่างที่อยากรู้จากเครื่องจริง ต้องให้ไท้อธิบายเป็นคำพูด**
 * ซึ่งช้า ตกหล่น และบางอย่างคนดูไม่ออกเลย (เช่นเวลาต่อเฟรม หรือช่องความโปร่งใสของภาพ)
 * ตัวนี้เก็บให้เอง แล้วสรุปเป็นข้อความก้อนเดียวให้กดคัดลอกไปวางในแชต
 *
 * ⚠️ ไม่ส่งข้อมูลออกไปไหนเอง — เว็บนี้เป็นไฟล์นิ่งไม่มีหลังบ้าน และการส่งเองจะพ่วง
 *    เรื่องที่เก็บกับความเป็นส่วนตัวมาทันที · กดคัดลอกแล้ววางเอง เร็วกว่าและไม่มีอะไรรั่ว
 */

/* ── ข้อมูลเครื่อง ────────────────────────────────────────────────────── */

/** เดารุ่น/เบราว์เซอร์แบบหยาบ ๆ พอให้รู้ว่ากำลังคุยถึงเครื่องแบบไหน */
function guessDevice() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
      : /Windows/.test(ua) ? 'Windows'
        : /Mac/.test(ua) ? 'Mac' : 'อื่น ๆ';
  const ver = ua.match(/OS (\d+[_\d]*) like Mac/) || ua.match(/Android (\d+(\.\d+)?)/);
  const br = /CriOS/.test(ua) ? 'Chrome (บน iOS)'
    : /FxiOS/.test(ua) ? 'Firefox (บน iOS)'
      : /EdgiOS|Edg\//.test(ua) ? 'Edge'
        : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
          : /Line\//.test(ua) ? 'เบราว์เซอร์ในแอป LINE'
            : /FBAN|FBAV|Instagram/.test(ua) ? 'เบราว์เซอร์ในแอป Facebook/IG'
              : /Chrome\//.test(ua) ? 'Chrome'
                : /Safari\//.test(ua) ? 'Safari' : 'ไม่รู้จัก';
  return { os, osVersion: ver ? ver[1].replace(/_/g, '.') : null, browser: br, ua };
}

/** เบราว์เซอร์ในแอป (LINE / เฟซบุ๊ก) — ช่องทางหลักที่ลูกค้าจริงเปิดลิงก์
    มักไม่ยอมให้อ่านการเอียงเครื่องบน iOS จึงต้องแยกออกมารายงานให้ชัด
    ไม่งั้นจะอ่านผลผิดว่า "ไจโรพัง" ทั้งที่เป็นข้อจำกัดของเบราว์เซอร์นั้น */
export function isInAppBrowser() {
  return /Line\/|FBAN|FBAV|Instagram|Messenger/.test(navigator.userAgent);
}

export function deviceInfo() {
  const d = guessDevice();
  const c = navigator.connection || {};
  return {
    ...d,
    screen: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio || 1}x`,
    /* iOS ไม่บอกแรม จะได้ null — ไม่ใช่ความผิดพลาด */
    memoryGB: navigator.deviceMemory ?? null,
    cores: navigator.hardwareConcurrency ?? null,
    network: c.effectiveType || null,
    inApp: isInAppBrowser(),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    secure: window.isSecureContext !== false,
  };
}

/* ── น้ำหนักที่โหลดจริง + เวลาโหลด ────────────────────────────────────── */

export function loadInfo() {
  const nav = performance.getEntriesByType('navigation')[0];
  const res = performance.getEntriesByType('resource');
  let over = 0;
  let cached = 0;
  const heavy = [];
  for (const r of res) {
    /* transferSize = 0 แปลว่าหยิบจากแคช ไม่ได้โหลดใหม่ — ต้องแยกให้ออก
       ไม่งั้นเปิดหน้าซ้ำจะรายงานว่า "เบามาก" ทั้งที่รอบแรกหนัก */
    const size = r.transferSize || 0;
    if (size > 0) over += size; else cached += r.encodedBodySize || 0;
    if ((size || r.encodedBodySize) > 20000) {
      heavy.push({ name: r.name.split('/').pop().split('?')[0], kb: Math.round((size || r.encodedBodySize) / 1024) });
    }
  }
  heavy.sort((a, b) => b.kb - a.kb);
  return {
    downloadedKB: Math.round(over / 1024),
    fromCacheKB: Math.round(cached / 1024),
    requests: res.length,
    readyMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    loadedMs: nav ? Math.round(nav.loadEventEnd || nav.responseEnd) : null,
    heaviest: heavy.slice(0, 5),
  };
}

/* ── ความลื่นตอนเอียง ────────────────────────────────────────────────── */

/**
 * จับเวลาต่อเฟรมระหว่างที่ผู้ทดสอบกำลังเอียงเครื่อง
 * ⚠️ วัดค่ากลางกับค่าที่แย่ที่สุด ไม่ใช่ค่าเฉลี่ย — ค่าเฉลี่ยกลบอาการกระตุกจนหายหมด
 *    คนรู้สึกสะดุดจากเฟรมที่แย่ ไม่ใช่จากค่าเฉลี่ย
 */
export function frameProbe() {
  const gaps = [];
  let prev = 0;
  let id = 0;
  let running = false;
  const step = (t) => {
    if (!running) return;
    if (prev) gaps.push(t - prev);
    prev = t;
    id = requestAnimationFrame(step);
  };
  return {
    start() { if (running) return; running = true; prev = 0; gaps.length = 0; id = requestAnimationFrame(step); },
    stop() { running = false; if (id) cancelAnimationFrame(id); id = 0; },
    result() {
      if (gaps.length < 10) return null;
      const s = [...gaps].sort((a, b) => a - b);
      const at = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
      return {
        frames: s.length,
        medianMs: +at(0.5).toFixed(1),
        worst5pctMs: +at(0.95).toFixed(1),
        /* 60 เฟรม/วินาที = 16.7 ms · เกิน 34 ms คือหล่นต่ำกว่า 30 เฟรม/วินาที = ตาเห็นสะดุด */
        jankPct: +(100 * s.filter((x) => x > 34).length / s.length).toFixed(1),
      };
    },
  };
}

/* ── ตรวจว่าผิวฟอยล์ขึ้นถูกจริงไหม ────────────────────────────────────── */

const FOIL = ['foil-hammer-a.webp', 'foil-glitter-a.webp', 'foil-env-a.webp'];

/**
 * ผิวทองทั้งหมดตอนนี้พึ่ง **ช่องความโปร่งใสของไฟล์ภาพ** ล้วน ๆ
 * ถ้าเบราว์เซอร์รุ่นเก่าอ่านไฟล์ได้แต่ **ทิ้งช่องความโปร่งใส** (เคยมีจริงในแอนดรอยด์เก่า)
 * ผิวจะกลายเป็นแผ่นทึบทับตัวเลขจนหมด — หน้าตาพังแบบเดียวกับที่เจอบน iPhone รอบก่อน
 * และ **ไม่มี error ใด ๆ** เหมือนเดิม → ต้องวัดเอง ไม่ใช่รอให้คนสังเกต
 */
export async function foilCheck(base = '../assets/textures/') {
  const out = { supportsClipText: false, layers: [], ok: false };
  try {
    out.supportsClipText = CSS.supports('-webkit-background-clip', 'text') || CSS.supports('background-clip', 'text');
  } catch { /* เบราว์เซอร์เก่าไม่มี CSS.supports */ }

  for (const file of FOIL) {
    const row = { file, loaded: false, alphaMin: null, alphaMax: null };
    try {
      const img = new Image();
      img.decoding = 'sync';
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error('โหลดไม่ได้'));
        img.src = base + file;
      });
      row.loaded = img.naturalWidth > 0;
      /* ย่อลงเหลือ 64px ก่อนอ่าน — อ่านเต็ม 448px บนมือถือเก่าช้าโดยไม่จำเป็น */
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.clearRect(0, 0, 64, 64);
      cx.drawImage(img, 0, 0, 64, 64);
      const px = cx.getImageData(0, 0, 64, 64).data;
      let lo = 255;
      let hi = 0;
      for (let i = 3; i < px.length; i += 4) { if (px[i] < lo) lo = px[i]; if (px[i] > hi) hi = px[i]; }
      row.alphaMin = lo;
      row.alphaMax = hi;
    } catch (e) {
      row.error = e.message;
    }
    out.layers.push(row);
  }
  /* ผ่านก็ต่อเมื่อ: ฉลุตามตัวอักษรได้ · ทุกชั้นโหลดได้ · และ**ช่องความโปร่งใสมีค่าหลากหลายจริง**
     (ถ้าโดนทิ้ง ทุกจุดจะเป็น 255 เท่ากันหมด = min กับ max ชนกัน) */
  out.ok = out.supportsClipText
    && out.layers.every((l) => l.loaded && l.alphaMax !== null && l.alphaMax - l.alphaMin > 20);
  return out;
}

/* ── สรุปเป็นข้อความให้กดคัดลอก ───────────────────────────────────────── */

const yn = (v) => (v === true ? 'ใช่' : v === false ? 'ไม่' : '—');

export function formatReport(r) {
  const d = r.device;
  const L = [];
  L.push('===== ผลทดสอบบัตรกำนัลบนเครื่องจริง =====');
  L.push(`เวลา ${r.at}`);
  L.push('');
  L.push(`เครื่อง   ${d.os}${d.osVersion ? ' ' + d.osVersion : ''} · ${d.browser}`);
  L.push(`จอ        ${d.screen}${d.network ? ' · เน็ต ' + d.network : ''}`);
  L.push(`สเปก      แรม ${d.memoryGB ?? '—'} GB · ${d.cores ?? '—'} คอร์`);
  L.push(`ลดแอนิเมชัน ${yn(d.reducedMotion)}${d.secure ? '' : '  ⚠️ ไม่ได้เปิดผ่าน https'}`);
  L.push('');
  L.push('--- ผิวทอง ---');
  L.push(`ตรวจอัตโนมัติ  ${r.foil.ok ? 'ผ่าน' : '❌ ไม่ผ่าน'}`);
  if (!r.foil.ok) {
    L.push(`  ฉลุตามตัวอักษรได้ ${yn(r.foil.supportsClipText)}`);
    for (const l of r.foil.layers) {
      L.push(`  ${l.file}: ${l.loaded ? 'โหลดได้' : 'โหลดไม่ได้'}` +
        (l.alphaMax !== null ? ` · ความโปร่งใส ${l.alphaMin}–${l.alphaMax}` : '') +
        (l.error ? ` · ${l.error}` : ''));
    }
  }
  L.push(`คนดูแล้วเป็นสีทอง  ${yn(r.answers.gold)}`);
  L.push('');
  L.push('--- ไจโรสโคป (เอียงเครื่อง) ---');
  L.push(`สถานะ     ${r.gyro.state}${r.gyro.needsPermission ? ' (เครื่องนี้ต้องขอสิทธิ์)' : ''}`);
  L.push(`สัญญาณ    ${r.gyro.events} ครั้ง${r.gyro.nulls ? ` · ค่าว่าง ${r.gyro.nulls} ครั้ง` : ''}${r.gyro.source ? ` · ทาง ${r.gyro.source}` : ''}`);
  L.push(`คนเอียงแล้วขยับ  ${yn(r.answers.tilt)}`);
  L.push('');
  L.push('--- ความลื่น ---');
  for (const [name, f] of Object.entries(r.frames)) {
    L.push(f
      ? `${name}  กลาง ${f.medianMs} ms · แย่สุด ${f.worst5pctMs} ms · สะดุด ${f.jankPct}% (${f.frames} เฟรม)`
      : `${name}  เก็บไม่พอ`);
  }
  L.push('');
  L.push('--- น้ำหนัก ---');
  L.push(`โหลดจริง ${r.load.downloadedKB} KB${r.load.fromCacheKB ? ` · จากแคช ${r.load.fromCacheKB} KB` : ''} · ${r.load.requests} ไฟล์`);
  L.push(`พร้อมใช้ ${r.load.readyMs} ms · โหลดครบ ${r.load.loadedMs} ms`);
  for (const h of r.load.heaviest) L.push(`  ${h.kb} KB  ${h.name}`);
  if (r.answers.note) { L.push(''); L.push('--- ผู้ทดสอบเขียนเพิ่ม ---'); L.push(r.answers.note); }
  L.push('=====================================');
  return L.join('\n');
}

/**
 * คัดลอกลงคลิปบอร์ด
 * ⚠️ ต้องเรียกจากใน event ที่ผู้ใช้กดจริง ๆ ไม่งั้น iOS ปฏิเสธเงียบ ๆ
 * คืน false เมื่อคัดลอกไม่ได้ → หน้าเว็บต้องมีทางสำรองให้เลือกข้อความเองเสมอ
 */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* ตกไปใช้ทางสำรอง */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * format.js — แปลงตัวเลข/วันที่ให้เป็นข้อความไทยที่คนอ่านรู้เรื่อง
 * ---------------------------------------------------------------------------
 * รวมไว้ที่เดียวเพราะ "รูปแบบวันที่/เงิน" คือของที่ชอบเพี้ยนคนละแบบในแต่ละหน้า
 */

import { t } from './strings.th.js';

const TH_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/** 1234567 → "1,234,567" */
export function num(n) {
  if (n == null || Number.isNaN(n)) return '-';
  return Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

/** 1500 → "฿1,500"  (ใส่ป้ายเงินไว้หน้าเลขตามที่คนไทยอ่านบนป้ายราคา) */
export function money(n) {
  return `${t('common.bahtSign')}${num(n)}`;
}

/** วันที่แบบสั้น พ.ศ. → "31 ธ.ค. 69" */
export function dateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const be = d.getFullYear() + 543;
  return `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${String(be).slice(-2)}`;
}

/** วันที่ + เวลา → "31 ธ.ค. 69 · 14:05" */
export function dateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dateShort(iso)} · ${hh}:${mm}`;
}

/** "เมื่อครู่นี้" / "3 นาทีที่แล้ว" / "2 วันที่แล้ว" */
export function relative(iso, now = Date.now()) {
  if (!iso) return '';
  const diff = now - new Date(iso).getTime();
  if (diff < 60000) return t('time.justNow');
  if (diff < 3600000) return `${Math.floor(diff / 60000)} ${t('time.minutesAgoSuffix')}`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ${t('time.hoursAgoSuffix')}`;
  return `${Math.floor(diff / 86400000)} ${t('time.daysAgoSuffix')}`;
}

/**
 * แยก "ตัวเลขมูลค่า" ออกจาก "หน่วย" เพื่อให้การ์ดจัดตัวอักษรได้สวย
 * (ตัวเลขใหญ่มาก หน่วยเล็กลอยข้าง ๆ)
 * @returns {{lead:string, main:string, unit:string}}
 *   lead = สิ่งที่อยู่หน้าเลข (เช่น ฿)  ·  unit = สิ่งที่อยู่หลังเลข (เช่น %)
 */
export function valueParts(v) {
  switch (v.kind) {
    case 'percent':
      return { lead: '', main: num(v.value), unit: t('common.percent') };
    case 'amount':
      return { lead: t('common.bahtSign'), main: num(v.value), unit: '' };
    case 'fixed_price':
      return { lead: t('common.bahtSign'), main: num(v.value), unit: '' };
    case 'free_item':
      return { lead: '', main: `×${num(v.value || 1)}`, unit: '' };
    case 'free_shipping':
      return { lead: '', main: t('kind.free_shipping'), unit: '' };
    default:
      return { lead: '', main: num(v.value), unit: '' };
  }
}

/** ประโยคสรุปสิทธิ์แบบเต็ม เอาไว้ใช้ในรายการ/อีเมล → "ลด 15% สูงสุด ฿2,000" */
export function valueSentence(v) {
  const p = valueParts(v);
  const head = `${t(`kind.${v.kind}`)} ${p.lead}${p.main}${p.unit}`.trim();
  const cap = v.conditions.maxDiscount
    ? ` ${t('card.maxDiscountPrefix')} ${money(v.conditions.maxDiscount)}`
    : '';
  return head + cap;
}

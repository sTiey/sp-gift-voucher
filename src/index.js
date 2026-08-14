/**
 * index.js — ประตูหน้าบ้านของ VoucherKit
 * ---------------------------------------------------------------------------
 * import ที่เดียวได้ทุกอย่าง:
 *   import { VoucherService, LocalStore, voucherCardHtml } from './src/index.js';
 *
 * ถ้าอยากเบา ๆ จะ import เฉพาะไฟล์ที่ใช้ก็ได้ ทุกไฟล์แยกกันอิสระ
 */

/* ---- โครงข้อมูล ---- */
export {
  createVoucher, validateVoucher, voucherDefaults,
  createCampaign, campaignDefaults,
  KINDS, SEGMENTS, STATES, SKINS, LAYOUTS,
} from './core/schema.js';

/* ---- รหัสคูปอง ---- */
export {
  generateCode, generateCodes, parseCode, normalizeCode, formatCode,
  normalizePrefix, voucherUrl, ALPHABET, BODY_LENGTH,
} from './core/codes.js';

/* ---- สถานะตามเวลา ---- */
export {
  deriveStatus, isUsable, daysLeft, remainingUses, isEndingSoon,
  sortForWallet, STATUS_ORDER, CLOSED_STATUSES,
} from './core/lifecycle.js';

/* ---- ตรรกะส่วนลด ---- */
export {
  evaluate, computeDiscount, eligibleSubtotal, bestVoucher,
  contextDefaults, primaryReason, REASON_PRIORITY,
} from './core/rules.js';

/* ---- ที่เก็บ + คำสั่งใช้งาน ---- */
export {
  VoucherService, MemoryStore, LocalStore, HttpStore, RESERVE_MS,
} from './core/store.js';

/* ---- ความปลอดภัย ---- */
export {
  liveCode, verifyLiveCode, msUntilRotate, currentWindow,
  setDemoSecret, newId, LIVE_CODE_PERIOD,
} from './core/security.js';

/* ---- ข้อความ + รูปแบบ ---- */
export { t, setLocale, registerLocale, TH } from './core/strings.th.js';
export { num, money, dateShort, dateTime, relative, valueParts, valueSentence } from './core/format.js';

/* ---- QR ---- */
export { encodeQr, toSvg as qrSvg, MAX_BYTES as QR_MAX_BYTES } from './core/qr.js';

/* ---- หน้าตา ---- */
export {
  voucherCardHtml, renderVoucher, GiftVoucherElement,
  kickerLine, conditionLine, expiryLine,
} from './ui/voucher-card.js';

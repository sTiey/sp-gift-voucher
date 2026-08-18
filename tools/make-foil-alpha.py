# -*- coding: utf-8 -*-
"""
แปลงพื้นผิวฟอยล์จาก "ภาพเทา + โหมดผสมสี" → "ภาพโปร่งใสวางทับตรง ๆ"
----------------------------------------------------------------------
ทำไมต้องแปลง (2026-08-18):
  ผลทดสอบบน iPhone จริง — ตัวเลขออกมาเป็นเกล็ดสีเงิน ไม่ใช่ทอง
  หลักฐาน: ขอบนูน (วาดด้วยเงา) ยังเป็นทอง แต่เนื้อใน (หลายชั้นซ้อนแล้วผสมสี) เป็นเงิน
  → Safari **ไม่ใช้ `background-blend-mode` เมื่อใช้คู่กับการฉลุตามรูปตัวอักษร**
    ชั้นบนสุด (เกล็ดสีเทา) จึงทาทับพื้นทองจนหมด · ไม่มี error ไม่มีคำเตือน
    และ `CSS.supports` ก็ตอบว่ารองรับ — ดักล่วงหน้าไม่ได้เลย

🔑 ทำไมแปลงเป็น "ขาว/ดำโปร่งใส" ตรง ๆ ไม่ได้:
   overlay ทำงานแยกช่องสีและรักษาความอิ่มสีไว้ · พื้นทองมีช่องน้ำเงินต่ำมาก (0.08)
   แต่ช่องแดงสูง (0.56) — ค่าพื้นผิวเดียวกันต้องใช้ความทึบต่างกันสิบเท่าในสองช่องนี้
   ใช้สีขาวทับด้วยความทึบเดียว = ทองซีดทันที

🔑 ทำไมไม่ให้ทุกจุดมีสีของตัวเอง (ซึ่งแม่นที่สุด):
   ลองแล้ว — แม่นขึ้นจริง แต่ไฟล์พุ่งจาก 145 KB เป็น **375 KB** เพราะต้องเก็บสี่ช่องสัญญาณ
   ที่มีสัญญาณรบกวนพอ ๆ กันทั้งหมด · ขัดกับข้อกำหนดของไท้เรื่องความเบาโดยตรง

🔑 ทางที่เลือก — **สองสีคงที่ ความทึบแปรตามพื้นผิว**:
   ด้านสว่างใช้สีเดียว ด้านเงาใช้อีกสีเดียว → ช่องสีมีแค่สองค่า บีบอัดได้เกือบหมด
   เหลือข้อมูลจริงแค่ช่องความทึบช่องเดียว = ไฟล์เล็กพอ ๆ กับภาพเทาเดิม
   ส่วนสีทั้งสองไม่ได้เดา — **หามาจากการฟิตกับไล่เฉดทองจริงแบบกำลังสองน้อยสุด**

ออก 3 ไฟล์ RGBA:  foil-hammer-a.webp · foil-glitter-a.webp · foil-env-a.webp
"""
import os

import numpy as np
from PIL import Image

TEX = 'D:/Gift vocher/assets/textures/'

# ไล่เฉดทองพื้น — ต้องตรงกับ --ft-foil-base ใน foilticket.css
BASE_HEX = ['fce6a2', 'ebc76c', 'd5aa49', 'b18522', '936a17', 'ae8227']
BASE = np.array([[int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] for h in BASE_HEX])


def overlay(b, s):
    return np.where(b <= 0.5, 2 * b * s, 1 - 2 * (1 - b) * (1 - s))


def soft_light(b, s):
    d = np.where(b <= 0.25, ((16 * b - 12) * b + 4) * b, np.sqrt(b))
    return np.where(s <= 0.5, b - (1 - 2 * s) * b * (1 - b), b + (2 * s - 1) * (d - b))


def best_free(s, blend):
    """สี+ความทึบที่ดีที่สุดโดยไม่จำกัดสี — ใช้เพื่อ 'หา' ว่าสีคงที่ควรเป็นอะไร"""
    target = blend(BASE, s)
    best = None
    for a in np.arange(0.01, 1.0, 0.01):
        c = np.clip(((target - BASE * (1 - a)) / a).mean(axis=0), 0, 1)
        err = (((BASE * (1 - a) + a * c) - target) ** 2).mean()
        if best is None or err < best[2]:
            best = (c, a, err)
    return best


def alpha_for(s, blend, c):
    """สีถูกล็อกไว้แล้ว เหลือหาความทึบที่ดีที่สุด — มีสูตรปิด ไม่ต้องไล่ค่า"""
    target = blend(BASE, s)
    d = c - BASE
    num = ((target - BASE) * d).sum()
    den = (d * d).sum()
    a = 0.0 if den == 0 else num / den
    a = float(np.clip(a, 0, 1))
    err = float(np.sqrt((((BASE + a * d) - target) ** 2).mean()))
    return a, err


# กวาดหาจุดที่ดีที่สุดมาแล้ว (ตารางเต็มอยู่ใน docs/plan-mobile.md):
#   กระเบื้อง 448 → 256   ไฟล์เล็กลง 3 เท่า และ**ยังถูกย่อลงตอนแสดงผลอยู่ดี** (256→1 68px) จึงไม่เบลอ
#   ความทึบ 48 ระดับ  เล็กลงอีก 30% โดยขั้นความทึบละเอียดกว่า 1/255 อยู่ดี
TILE = int(os.environ.get('FOIL_TILE', '256'))
ALPHA_LEVELS = 48
# ตัวคูณความทึบ — หามาจากการวัดภาพที่เรนเดอร์จริง ไม่ใช่การคำนวณอย่างเดียว
# การฟิตด้วยสองสีคงที่จะกดความต่างของผิวลงเสมอ (วัดได้ −20%) → ต้องคูณกลับขึ้น
GAIN = float(os.environ.get('FOIL_GAIN', '3.8'))
# สีที่การฟิตเลือกเองจะออกมาเกือบขาว ซึ่งดึงความอิ่มของทองลง (วัดได้ −18%)
# จึงบังคับสีได้ แล้วให้การฟิตหาแค่ความทึบ
FORCE_LIGHT = os.environ.get('FOIL_LIGHT', 'FFD158')
FORCE_DARK = os.environ.get('FOIL_DARK', '6B4A10')


def convert(name, blend, out_name, gain=None, light=None, dark=None):
    im = Image.open(TEX + name).convert('L')
    if im.size[0] != TILE:
        im = im.resize((TILE, TILE), Image.LANCZOS)
    lum = np.array(im).astype(float) / 255
    idx = np.clip((lum * 255).round().astype(int), 0, 255)
    hist = np.bincount(idx.ravel(), minlength=256).astype(float)
    hist /= hist.sum()

    # 1) หาสีอิสระของทุกระดับ แล้วเฉลี่ยแยกฝั่งสว่าง/ฝั่งเงา ถ่วงน้ำหนักด้วยจำนวนพิกเซลจริง
    free = [best_free(i / 255, blend) for i in range(256)]
    lo = np.arange(0, 128)
    hi = np.arange(128, 256)
    wl, wh = hist[lo], hist[hi]
    c_dark = np.average([free[i][0] for i in lo], axis=0, weights=wl + 1e-12)
    c_light = np.average([free[i][0] for i in hi], axis=0, weights=wh + 1e-12)

    L = light or FORCE_LIGHT
    D = dark or FORCE_DARK
    if L:
        c_light = np.array([int(L[i:i+2], 16) / 255 for i in (0, 2, 4)])
    if D:
        c_dark = np.array([int(D[i:i+2], 16) / 255 for i in (0, 2, 4)])

    # 2) ล็อกสองสีนั้น แล้วหาความทึบของแต่ละระดับใหม่
    lut_a = np.zeros(256)
    lut_c = np.zeros((256, 3))
    errs = np.zeros(256)
    for i in range(256):
        c = c_dark if i < 128 else c_light
        lut_a[i], errs[i] = alpha_for(i / 255, blend, c)
        lut_c[i] = c

    lut_a = np.clip(lut_a * (GAIN if gain is None else gain), 0, 1)
    if ALPHA_LEVELS:
        step = 1.0 / ALPHA_LEVELS
        lut_a = np.round(lut_a / step) * step

    rgba = np.zeros((TILE, TILE, 4), dtype=np.uint8)
    rgba[..., :3] = (lut_c[idx] * 255).round().astype(np.uint8)
    rgba[..., 3] = (lut_a[idx] * 255).round().astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(TEX + out_name, lossless=True, quality=100)

    w_err = float((errs * hist).sum())
    print('%-18s -> %-20s  \u0e1c\u0e34\u0e14 %.1f/255   %5.1f KB   \u0e2a\u0e35\u0e40\u0e07\u0e32 #%02X%02X%02X  \u0e2a\u0e35\u0e2a\u0e27\u0e48\u0e32\u0e07 #%02X%02X%02X'
          % (name, out_name, w_err * 255, os.path.getsize(TEX + out_name) / 1024,
             *(c_dark * 255).round().astype(int), *(c_light * 255).round().astype(int)))


# ชั้นแผนที่ห้องเป็นการปรับกว้าง ๆ ไม่ใช่เม็ดผิว — คูณแรงเท่าอีกสองแล้วโซนที่แสงตกจะหายเนียน
convert('foil-env.webp', soft_light, 'foil-env-a.webp', gain=1.2)
convert('foil-hammer.webp', overlay, 'foil-hammer-a.webp')
# เกล็ดต้องไปได้ถึงขาวเกือบล้วน — ประกายจริงคือจุดขาวจ้า ไม่ใช่จุดทองสว่าง
# ถ้าจำกัดสีสว่างไว้ที่สีทอง เกล็ดจะกลายเป็นเม็ดทรายแทนที่จะเป็นประกาย
convert('foil-glitter.webp', overlay, 'foil-glitter-a.webp', light='FFF7E4')

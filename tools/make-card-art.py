# -*- coding: utf-8 -*-
"""
ย่อรูปสินค้าให้เป็นภาพพื้นหลังของใบคูปอง — assets/products/bg/<slug>.webp
----------------------------------------------------------------------
ไท้สั่ง (2026-08-18): "เอารูปสินค้ามาใส่เป็นพื้นหลัง ... ก่อนจะทำให้ย่อขนาดรูป
                       ให้เบาที่สุดก่อนนะ ... เราเอาไปใช้กับมือถือเป็นหลัก"

🔑 ทำไมย่อได้เยอะขนาดนี้โดยไม่เสียงาน:
   ภาพนี้ไม่ได้ถูกใช้เป็น "ภาพสินค้าให้ดู" แต่เป็น **พื้นหลังที่ถูกม่านครีมคลุมไว้**
   แล้วยังมีเนื้อกระดาษปูทับอีกชั้น — รายละเอียดระดับเส้นผมจึงไม่มีใครเห็น
   สิ่งที่ยังต้องเหลือคือ **โครงเส้นของเหล็กดัด** ซึ่งเป็นเส้นหนาคอนทราสต์สูง
   อยู่รอดการบีบได้สบาย

🔑 ทำไมไม่เบลอเพื่อให้ไฟล์เล็กลงอีก:
   เบลอแล้วเส้นเหล็กจะละลายหายไปด้วย เหลือแค่ปื้นสีอ่อน ๆ ที่ไม่บอกอะไร
   จุดขายของรูปคือลายเหล็ก ไม่ใช่บรรยากาศ

⚠️ ตัวเลขที่วัดมาแล้ว (balcony-wide.jpg ต้นฉบับ 122 KB):
      กว้าง 420 คุณภาพ 50 →  8.4 KB      กว้าง 560 คุณภาพ 50 → 12.1 KB
      กว้าง 700 คุณภาพ 50 → 16.6 KB      กว้าง 560 คุณภาพ 74 → 16.0 KB
   เลือก 560/52 เพราะ **บนใบจริงภาพถูกแสดงกว้างราว 490 จุดภาพ** (สูงเต็มใบแล้วครอบ)
   ใหญ่กว่านั้นคือจ่ายไบต์ให้พิกเซลที่ไม่มีใครได้เห็น
"""
import io
import os
import glob

from PIL import Image, ImageEnhance

SRC = 'D:/Gift vocher/assets/products/'
OUT = SRC + 'bg/'
WIDTH = 560
QUALITY = 52

os.makedirs(OUT, exist_ok=True)

total_in = total_out = 0
for path in sorted(glob.glob(SRC + '*-wide.jpg')):
    slug = os.path.basename(path).replace('-wide.jpg', '')
    im = Image.open(path).convert('RGB')
    h = round(WIDTH * im.size[1] / im.size[0])
    small = im.resize((WIDTH, h), Image.LANCZOS)
    # ลดความอิ่มสีลง — ต้นไม้สีเขียวในรูปจะตีกับชุดสีครีม-ทอง-น้ำเงินของใบ
    # และเพิ่มคอนทราสต์ — จุดที่ต้องเห็นคือเส้นเหล็กดำ ไม่ใช่พื้นหลังสว่าง
    small = ImageEnhance.Color(small).enhance(0.5)
    small = ImageEnhance.Contrast(small).enhance(1.18)
    dst = OUT + slug + '.webp'
    small.save(dst, 'WEBP', quality=QUALITY, method=6)
    a, b = os.path.getsize(path), os.path.getsize(dst)
    total_in += a
    total_out += b
    print('%-10s %4dx%-4d  %6.1f KB  ->  %sx%s  %5.1f KB   (%.0f%% smaller)'
          % (slug, im.size[0], im.size[1], a / 1024, WIDTH, h, b / 1024, 100 * (1 - b / a)))

print('-' * 68)
print('รวม %.0f KB -> %.0f KB   (เล็กลง %.0f%%)  ต่อใบโหลดจริงแค่รูปเดียว'
      % (total_in / 1024, total_out / 1024, 100 * (1 - total_out / total_in)))

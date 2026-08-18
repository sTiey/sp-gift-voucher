# -*- coding: utf-8 -*-
"""
สร้าง "ผิวฟอยล์ทอง" เป็นภาพเทาเล็ก ๆ ปูซ้ำได้ไร้รอยต่อ
----------------------------------------------------------------------
ทำไมต้องเป็นภาพ ไม่ใช่ฟิลเตอร์: ฟิลเตอร์สร้างลาย (feTurbulence) กินซีพียูหนัก
และคำนวณใหม่ทุกครั้งที่การ์ดขยับ ส่วนภาพปูซ้ำเบราว์เซอร์วางครั้งเดียวแล้วจบ
การ์ดเอียงกี่ครั้งก็ไม่คิดใหม่ — ถูกที่สุดสำหรับมือถือ

วิธีทำให้ไร้รอยต่อ: กรองสัญญาณรบกวนด้วย FFT
ผลลัพธ์จากโดเมนความถี่เป็นคาบโดยธรรมชาติ ขอบซ้าย-ขวา/บน-ล่างจึงต่อกันสนิทเสมอ
"""
import numpy as np
from PIL import Image

SIZE = 256
rng = np.random.default_rng(20260817)


def band(noise, lo, hi):
    """เก็บเฉพาะความถี่ในช่วงที่ต้องการ — คุมว่าจะได้เกล็ดหยาบหรือละเอียด"""
    f = np.fft.fft2(noise)
    fy = np.fft.fftfreq(SIZE)[:, None]
    fx = np.fft.fftfreq(SIZE)[None, :]
    r = np.sqrt(fx ** 2 + fy ** 2) * SIZE
    mask = ((r >= lo) & (r <= hi)).astype(float)
    out = np.real(np.fft.ifft2(f * mask))
    s = out.std()
    return out / s if s > 1e-9 else out


white = rng.normal(size=(SIZE, SIZE))

# ⚠️ รอบแรกใส่เกล็ดใหญ่เยอะไป → ออกมาเป็นลายด่างเหมือนเชื้อรา ไม่ใช่ผิวฟอยล์
#    ผิวโลหะจริงที่ตัวอักษรสูงราว 140px ควรเห็นเม็ดขนาด 1-3px เท่านั้น
#    จึงต้องดันน้ำหนักไปที่ความถี่สูง และลดเกล็ดใหญ่ให้เหลือแค่พอมีทิศทาง
crease = band(white, 8, 18)
grain = band(white, 26, 58)
speck = band(white, 64, 120)

# ยับแบบสันคม: กลับค่าสัมบูรณ์ ทำให้เกิด "สัน" เหมือนรอยพับฟอยล์จริง
ridge = 1.0 - np.abs(crease / (np.abs(crease).max() + 1e-9))
ridge = (ridge - ridge.mean()) / (ridge.std() + 1e-9)

mix = 0.22 * ridge + 0.55 * grain + 0.52 * speck
mix = (mix - mix.mean()) / (mix.std() + 1e-9)

# แปลงเป็นภาพเทารอบ ๆ 128 — โหมดผสมแบบ overlay ใช้ 128 = "ไม่เปลี่ยนอะไร"
# ประวัติการปรับ: ±34 แรงไปจนดูเป็นลายด่าง · ±17 จางไปจนแทบไม่เห็นผิว
# ±27 = ไท้ขอ "ชัดขึ้นอีกนิด" — เห็นเนื้อฟอยล์ชัดแต่ยังไม่กลืนสีทอง
img = np.clip(128 + mix * 21, 0, 255).astype(np.uint8)

out = Image.fromarray(img, mode='L')
out.save('D:/Gift vocher/assets/textures/foil-grain.webp', format='WEBP', quality=82, method=6)

# ตรวจว่าต่อกันสนิทจริง: ขอบซ้าย-ขวาและบน-ล่างต้องต่างกันไม่เกินระดับสัญญาณรบกวนปกติ
a = img.astype(int)
seam_x = np.abs(a[:, 0] - a[:, -1]).mean()
seam_y = np.abs(a[0, :] - a[-1, :]).mean()
inner_x = np.abs(a[:, 10] - a[:, 11]).mean()
# ⚠️ คอนโซลเครื่องนี้เป็น cp874 พิมพ์ไทยแล้วสคริปต์พัง — ข้อความรายงานต้องเป็น ASCII
print(f'seam-x {seam_x:.1f} | seam-y {seam_y:.1f} | normal-neighbour {inner_x:.1f}')
print(f'mean {a.mean():.1f} (want ~128) | min {a.min()} max {a.max()}')

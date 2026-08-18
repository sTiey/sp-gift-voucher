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


def streaks(noise, fx_lo, fx_hi, fy_max):
    """ริ้วขนแมวของสแตนเลสขัด — เก็บเฉพาะความถี่ "ตามแนวนอน" แต่บีบแนวตั้งให้ต่ำ
    ผลคือลายเปลี่ยนเร็วเมื่อเลื่อนซ้าย-ขวา แต่แทบไม่เปลี่ยนเมื่อเลื่อนขึ้น-ลง
    = เส้นยาวตามแนวตั้ง ซึ่งคือรอยขัดจริงบนแผ่นสแตนเลส
    ⚠️ นี่คือสิ่งที่ทำให้แสงยืดออกเป็นฝ้ากว้าง แทนที่จะเป็นจุดกลม
       ผิวที่กระจายเท่ากันทุกทิศให้แสงเป็นจุด ผิวที่มีทิศทางให้แสงเป็นแถบ"""
    f = np.fft.fft2(noise)
    fy = np.abs(np.fft.fftfreq(SIZE)[:, None]) * SIZE
    fx = np.abs(np.fft.fftfreq(SIZE)[None, :]) * SIZE
    mask = (fx >= fx_lo) & (fx <= fx_hi) & (fy <= fy_max)
    out = np.real(np.fft.ifft2(f * mask))
    sd = out.std()
    return out / sd if sd > 1e-9 else out


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
# ริ้วขัดแนวตั้ง 2 ความถี่ — หยาบเล็กน้อยกับละเอียดจัด ซ้อนกันแบบผิวขัดจริง
# ⚠️ เริ่มที่ 18 = เส้นห่างราว 4px บนจอ ตาอ่านเป็น "ลายไม้" ไม่ใช่โลหะ
#    สแตนเลสขัดจริงเส้นถี่จนแทบไม่เห็นเป็นเส้น เหลือแค่ความรู้สึกซาติน
brush = streaks(rng.normal(size=(SIZE, SIZE)), 46, 112, 2.5)
brush_fine = streaks(rng.normal(size=(SIZE, SIZE)), 96, 127, 4.0)

ridge = 1.0 - np.abs(crease / (np.abs(crease).max() + 1e-9))
ridge = (ridge - ridge.mean()) / (ridge.std() + 1e-9)

# ริ้วขัดต้องเป็นตัวเอกของผิว ไม่ใช่เม็ดกระจายทุกทิศ — นั่นคือสิ่งที่ทำให้อ่านว่า
# "สแตนเลสขัด" ไม่ใช่ "ทองพ่นทราย" · เม็ดกระจายเหลือไว้แค่พอมีเนื้อ
mix = 0.16 * ridge + 0.26 * grain + 0.24 * speck + 0.85 * brush + 0.62 * brush_fine
mix = (mix - mix.mean()) / (mix.std() + 1e-9)

img = np.clip(128 + mix * 17, 0, 255).astype(np.uint8)

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

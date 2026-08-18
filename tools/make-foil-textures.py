# -*- coding: utf-8 -*-
"""
สร้างพื้นผิวฟอยล์ทองทั้งชุด — ฟอยล์ทุบ/ยับ + กลิตเตอร์
----------------------------------------------------------------------
(เขียนใหม่ทั้งหมด แทน make-foil-grain.py + make-foil-env.py ที่ทำผิวขัดขนแมว
 ซึ่งไม่ใช่สิ่งที่เจ้าของงานต้องการ)

ออก 3 ไฟล์:
  foil-hammer.webp   ฟอยล์ทุบ — หลุมและสันแบบแผ่นทองยับ
  foil-glitter.webp  กลิตเตอร์ — เกล็ดสะท้อนแสงเล็ก ๆ กระจาย
  foil-env.webp      แผนที่ห้องที่ผิวสะท้อน (โซนสว่าง-มืด)

🔑 หลักที่ทำให้ "ฟอยล์ทุบ" ดูจริง:
   ห้ามวาดลายด้วยมือ ต้องสร้าง **สนามความสูง** ของผิวก่อน (ตรงไหนนูน ตรงไหนบุ๋ม)
   แล้วคำนวณว่าแสงตกกระทบทำมุมเท่าไหร่กับผิวตรงนั้น
   ผลที่ได้คือขอบสว่างกับเงาที่ **จับคู่กันคนละฝั่งของหลุมเดียวกันเสมอ**
   ซึ่งเป็นสิ่งที่ตาใช้ตัดสินว่าเป็นผิวสามมิติจริง ไม่ใช่ลายที่พิมพ์ทับลงไป

ทุกภาพปูซ้ำไร้รอยต่อ เพราะกรองในโดเมนความถี่ (ผลลัพธ์เป็นคาบโดยธรรมชาติ)
และการหาความชันใช้การเลื่อนแบบวนขอบ จึงไม่ทำให้ขอบเสีย
"""
import numpy as np
from PIL import Image

OUT = 'D:/Gift vocher/assets/textures/'
# ⚠️ เคยเข้าใจผิดว่า "อยากได้ลายละเอียดขึ้น = ต้องขยายกระเบื้อง" → ไฟล์พุ่งไป 367KB
#    จริง ๆ ความละเอียดที่ตาเห็นขึ้นกับ **ขนาดที่เอาไปแสดง** ไม่ใช่ขนาดไฟล์
#    กระเบื้อง 448 ย่อลงแสดงที่ 168px = บีบ 2.7 เท่า ได้ลายละเอียดกว่า 640 ที่แสดงเต็ม
#    และไฟล์เล็กกว่าครึ่ง · ตัวที่เคยผูกให้ขยายไม่ได้คือ "ระยะเลื่อนตอนพลิก"
#    ซึ่งย้ายไปใช้หน่วยพิกเซลแทนเปอร์เซ็นต์แล้ว จึงไม่ผูกกับขนาดกระเบื้องอีก
SIZE = 448
rng = np.random.default_rng(20260818)


def band(noise, lo, hi):
    f = np.fft.fft2(noise)
    fy = np.fft.fftfreq(SIZE)[:, None]
    fx = np.fft.fftfreq(SIZE)[None, :]
    r = np.sqrt(fx ** 2 + fy ** 2) * SIZE
    out = np.real(np.fft.ifft2(f * ((r >= lo) & (r <= hi))))
    sd = out.std()
    return out / sd if sd > 1e-9 else out


def norm(a):
    return (a - a.mean()) / (a.std() + 1e-9)


def seam(a, name):
    a = a.astype(float)
    sx = np.abs(a[:, 0] - a[:, -1]).mean()
    sy = np.abs(a[0, :] - a[-1, :]).mean()
    nb = np.abs(a[:, 10] - a[:, 11]).mean()
    ok = 'OK' if max(sx, sy) <= nb * 1.6 else 'CHECK'
    print('%-9s seam-x %.1f seam-y %.1f neighbour %.1f  %s' % (name, sx, sy, nb, ok))


# ── 1. ฟอยล์ทุบ ────────────────────────────────────────────────────────────
w = rng.normal(size=(SIZE, SIZE))
# หลุมใหญ่ = รอยทุบ · หลุมกลาง = รอยยับซ้อน · ละเอียด = ผิวหยาบของแผ่น
# ⚠️ เคยใช้ 5-13 ซึ่งให้หลุมกว้างราว 30-77px บนภาพ = ก้อนใหญ่เหมือนกระดาษยับ
#    ฟอยล์ทุบจริงรอยถี่กว่านั้นมาก · ดันขึ้นทั้งสามชั้นให้เหลือรอยละเอียด 2-17px
height = 1.0 * band(w, 58, 118) + 0.7 * band(w, 130, 190) + 0.36 * band(w, 200, 220)
height = norm(height)
# ทำให้ยอดแหลมและก้นแบน เหมือนโลหะที่ถูกทุบจริง (ไม่ใช่คลื่นไซน์นุ่ม ๆ)
height = np.sign(height) * np.abs(height) ** 0.78

# ความชันของผิว = ทิศที่ผิวหันไป · เลื่อนแบบวนขอบเพื่อไม่ให้ขอบภาพเสีย
gx = np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)
gy = np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)
S = 7.0
nx, ny, nz = -gx * S, -gy * S, np.ones_like(height)
ln = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
L = np.array([0.45, -0.55, 0.70])
L = L / np.linalg.norm(L)
diff = (nx * L[0] + ny * L[1] + nz * L[2]) / ln
spec = np.clip(diff, 0, 1) ** 15          # ไฮไลต์แคบ ๆ ตรงสันที่หันเข้าหาแสงพอดี
shade = norm(diff) * 0.7 + spec * 3.1
# ⚠️ ไท้ขอให้ "เป็นเงา" มากขึ้น = ต่างระหว่างมืดกับสว่างต้องแรงขึ้น ไม่ใช่สว่างขึ้นเฉย ๆ
hammer = np.clip(128 + norm(shade) * 46, 0, 255).astype(np.uint8)
seam(hammer, 'hammer')
Image.fromarray(hammer, 'L').save(OUT + 'foil-hammer.webp', 'WEBP', quality=52, method=6)

# ── 2. กลิตเตอร์ ───────────────────────────────────────────────────────────
g = np.full((SIZE, SIZE), 128.0)
# ⚠️ เกล็ดต้องเห็นชัด — เพิ่มจำนวนและดันความสว่างขึ้น
n_small = 15000
ys = rng.integers(0, SIZE, n_small)
xs = rng.integers(0, SIZE, n_small)
g[ys, xs] = rng.uniform(215, 255, n_small)
# เกล็ดใหญ่กว่าเล็กน้อย 2x2 — ขยายด้วยการเลื่อนแบบวนขอบ จึงไม่ทำขอบภาพเสีย
n_big = 2600
yb = rng.integers(0, SIZE, n_big)
xb = rng.integers(0, SIZE, n_big)
for dy in (0, 1):
    for dx in (0, 1):
        g[(yb + dy) % SIZE, (xb + dx) % SIZE] = rng.uniform(235, 255, n_big)
# เกล็ดจมเงาบ้าง เพื่อให้เห็นเป็น "เกล็ด" ไม่ใช่แค่จุดขาว
n_dark = 4500
g[rng.integers(0, SIZE, n_dark), rng.integers(0, SIZE, n_dark)] = rng.uniform(40, 84, n_dark)
glitter = np.clip(g, 0, 255).astype(np.uint8)
seam(glitter, 'glitter')
Image.fromarray(glitter, 'L').save(OUT + 'foil-glitter.webp', 'WEBP', quality=58, method=6)

# ── 3. แผนที่ห้อง (โซนสว่าง-มืดกว้าง ๆ) ────────────────────────────────────
e = norm(1.0 * band(rng.normal(size=(SIZE, SIZE)), 2, 6)
         + 0.6 * band(rng.normal(size=(SIZE, SIZE)), 7, 18))
yy = np.arange(SIZE)[:, None] / SIZE
e = norm(e + 0.3 * np.sin(2 * np.pi * yy) * np.ones((1, SIZE)))
env = np.clip(128 + np.where(e > 0, e * 36, e * 17), 0, 255).astype(np.uint8)
seam(env, 'env')
Image.fromarray(env, 'L').save(OUT + 'foil-env.webp', 'WEBP', quality=52, method=6)

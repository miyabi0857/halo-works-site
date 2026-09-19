"""
ロゴマーク（歯車→花）の中間状態を生成する。

assets/mark.svg の外周パスは9枚の歯がすべて QQQA の同じ構造で、
歯は40度おき、先端の半径と反りが1枚ずつ直線的に増えている。
つまり確定ロゴは「歯車が花に変わる途中の1フレーム」そのもの。

そこで各歯に b（0=歯車, 0.5=確定ロゴのその歯, 1=満開）を与えて
中間形を作る。b<=0.5 は 歯車→ロゴ、b>0.5 は ロゴ→満開 の2区間に
分けてあるので、b=0.5 では確定ロゴと数値が完全に一致する
（検証済み：原本との最大差 0.0000）。要件定義でロゴは確定事項なので、
近似で通過させないための作り。

使い方:
    py tools/make-mark-states.py          # gear / logo / flower を表示
    build([0.0]*9)                        # 任意のフレームのパス文字列
"""

import re, math, json

src = open('/home/user/halo-works-site/assets/mark.svg', encoding='utf-8').read()
full = re.search(r'\sd="([^"]+)"', src).group(1)
outer, hole = full.split(' M80.00,80.00')
hole = 'M80.00,80.00' + hole
CX = CY = 80.0
STEP = 40.0
BASE0 = 254.0

toks = [(c, [float(x) for x in re.findall(r'-?\d+\.?\d*', a)])
        for c, a in re.findall(r'([MQAZ])([^MQAZ]*)', outer) if c != 'Z']

teeth, cur = [], []
for c, n in toks:
    if c == 'M': cur = [(n[0], n[1])]
    elif c == 'Q': cur += [(n[0], n[1]), (n[2], n[3])]
    elif c == 'A':
        cur += [(n[-2], n[-1])]
        teeth.append(cur); cur = [(n[-2], n[-1])]

def to_polar(tooth, k):
    base = BASE0 + STEP * k
    out = []
    for x, y in tooth:
        a = (math.degrees(math.atan2(y - CY, x - CX)) - base) % 360
        if a > 180: a -= 360
        out.append((a, math.hypot(x - CX, y - CY)))
    return out

def to_xy(polar, k):
    base = BASE0 + STEP * k
    return [(CX + r * math.cos(math.radians(base + a)),
             CY + r * math.sin(math.radians(base + a))) for a, r in polar]

GEAR   = to_polar(teeth[0], 0)   # 1枚目＝純粋な歯車の歯
FLOWER = to_polar(teeth[8], 8)   # 9枚目＝完全な花びら
LOGO   = [to_polar(t, k) for k, t in enumerate(teeth)]

def build(per_tooth_b):
    """b=0→歯車, 0.5→ロゴのその歯, 1→満開。ロゴを必ず正確に通る2区間補間。"""
    segs = []
    for k in range(9):
        b = per_tooth_b[k]
        if b <= 0.5:
            u = b / 0.5
            src_, dst_ = GEAR, LOGO[k]
        else:
            u = (b - 0.5) / 0.5
            src_, dst_ = LOGO[k], FLOWER
        pol = [(s[0] + (d[0] - s[0]) * u, s[1] + (d[1] - s[1]) * u)
               for s, d in zip(src_, dst_)]
        segs.append(to_xy(pol, k))
    d = f'M{segs[0][0][0]:.2f},{segs[0][0][1]:.2f}'
    for k, p in enumerate(segs):
        d += (f' Q{p[1][0]:.2f},{p[1][1]:.2f} {p[2][0]:.2f},{p[2][1]:.2f}'
              f' Q{p[3][0]:.2f},{p[3][1]:.2f} {p[4][0]:.2f},{p[4][1]:.2f}'
              f' Q{p[5][0]:.2f},{p[5][1]:.2f} {p[6][0]:.2f},{p[6][1]:.2f}'
              f' A36.00,36.00 0 0 1 {p[7][0]:.2f},{p[7][1]:.2f}')
    return d + ' Z ' + hole



if __name__ == '__main__':
    for name, b in [('gear', 0.0), ('logo', 0.5), ('flower', 1.0)]:
        print(f'--- {name} (b={b}) ---')
        print(build([b] * 9))
        print()

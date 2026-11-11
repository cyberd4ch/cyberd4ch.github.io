#!/usr/bin/env python3
"""Compose og-card.png (1280x640) from the real brand vectors: wordmark + orbit-d mark."""
import math
import random
import subprocess
import os

W, H = 1280, 640
CREAM = "#f7f6f3"
INK = "#0f0e0d"
MUTED = "#7a7470"
BORDER = "#ddd9d4"
MISSION = "#fc3d21"

# ---- deterministic starfield (skip the text block zone) --------------------
random.seed(7)
stars = []
while len(stars) < 110:
    x = random.uniform(30, W - 30)
    y = random.uniform(30, H - 30)
    if 60 <= x <= 700 and 150 <= y <= 520:  # keep the copy zone clean
        continue
    r = random.choice([1.2, 1.6, 2.2])
    o = round(random.uniform(0.18, 0.5), 2)
    stars.append((x, y, r, o))
star_els = "\n".join(
    f'    <circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{MUTED}" opacity="{o}"/>'
    for x, y, r, o in stars
)

# ---- orbit-d mark, scaled 1.68x, centered at (955, 320) --------------------
S = 1.68
tx, ty = 955 - 128 * S, 320 - 135 * S
# satellite born in the one o'clock gap (30 deg from top, clockwise)
sat_x = 128 + 84 * math.sin(math.radians(30))
sat_y = 135 - 84 * math.cos(math.radians(30))

mark = f'''  <g transform="translate({tx:.1f} {ty:.1f}) scale({S})" fill="none" stroke="{INK}" stroke-width="20">
    <circle cx="128" cy="135" r="44"/>
    <path d="M 205.1 101.7 A 84 84 0 1 1 123 51.1"/>
    <path d="M 172 179 L 172 27"/>
  </g>
  <circle cx="{tx + sat_x * S:.1f}" cy="{ty + sat_y * S:.1f}" r="{11 * S:.1f}" fill="{MISSION}"/>'''

# ---- worm wordmark, scaled 0.76x, at (90, 225) ------------------------------
WS = 0.76
wtw, wth = 90, 225
wordmark = f'''  <g transform="translate({wtw} {wth}) scale({WS})" fill="none" stroke="{INK}" stroke-width="16">
    <path d="M 79.76 121.37 A 29 29 0 1 0 79.76 154.63"/>
    <path d="M 114 110 L 136 166"/>
    <path d="M 158 110 L 136 166 L 136 198"/>
    <path d="M 192 58 L 192 166"/>
    <path d="M 192 110 A 29 29 0 0 1 192 166"/>
    <path d="M 264 138 L 321 138"/>
    <path d="M 321 138 A 29 29 0 1 0 315.76 154.63"/>
    <path d="M 350 110 L 350 166"/>
    <path d="M 350 132 Q 350 110 372 110 L 382 110"/>
    <path d="M 490 110 A 29 29 0 0 0 490 166"/>
    <path d="M 490 58 L 490 166"/>
    <path d="M 561 114 A 25 25 0 0 0 561 162"/>
    <path d="M 561 110 L 561 166"/>
    <path d="M 647.76 121.37 A 29 29 0 1 0 647.76 154.63"/>
    <path d="M 682 58 L 682 166"/>
    <path d="M 682 132 Q 682 110 708 110 L 708 166"/>
  </g>
  <!-- beacon period, in mission red -->
  <circle cx="{wtw + 418 * WS:.1f}" cy="{wth + 164 * WS:.1f}" r="{10 * WS:.1f}" fill="{MISSION}"/>'''

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <rect width="{W}" height="{H}" fill="{CREAM}"/>
{star_els}
  <rect x="24" y="24" width="{W - 48}" height="{H - 48}" fill="none" stroke="{BORDER}" stroke-width="2"/>
  <text x="90" y="200" font-family="IBM Plex Mono" font-weight="600" font-size="22" letter-spacing="6" fill="{MUTED}">// MISSION CONTROL</text>
{wordmark}
  <text x="90" y="472" font-family="IBM Plex Mono" font-weight="600" font-size="26" letter-spacing="1" fill="{INK}">telecom engineer × cybersecurity expert</text>
  <text x="90" y="556" font-family="IBM Plex Mono" font-weight="600" font-size="22" letter-spacing="4" fill="{MUTED}">cyberdach.dev</text>
{mark}
</svg>'''

out_svg = "/tmp/opencode/og/og-card.svg"
os.makedirs(os.path.dirname(out_svg), exist_ok=True)
with open(out_svg, "w") as f:
    f.write(svg)

out_png = os.path.join(os.path.dirname(os.path.abspath(__file__)), "og-card.png")
subprocess.run(["rsvg-convert", "-w", str(W), "-h", str(H), "-o", out_png, out_svg], check=True)
print("wrote", out_png, os.path.getsize(out_png), "bytes")

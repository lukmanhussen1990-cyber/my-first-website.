#!/usr/bin/env python3
"""Build assets/logo.svg: the character in a Heisenberg pork-pie hat.

Crown, telescope top, band and bow come from the design panel's "classic"
candidate (design/candidates/classic-r7-f.svg). The brim is generated here
from a centreline + width profile so it is exactly symmetric and chunky
enough to survive motion blur and the 70% zoom-out, with round upturned tips.
See design/CONTRACT.md for the group/palette contract.
"""
import math, os

CX = 500.0

def brim_path(n=90):
    # centreline y(u) for u in [-1, 1] across the brim, width w(u)
    half = 322.0                      # half-span of the brim centreline
    def y(u): return 389 - 50 * u * u - 24 * u ** 8
    def w(u): return 50 - 20 * u * u
    def pt(u): return (CX + half * u, y(u))
    def normal(u):
        e = 1e-4
        (x0, y0), (x1, y1) = pt(u - e), pt(u + e)
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy)
        return (dy / L, -dx / L)      # points "up" (negative y) for dx > 0
    us = [-1 + 2 * i / n for i in range(n + 1)]
    top = []
    bot = []
    for u in us:
        (x, yy), (nx, ny) = pt(u), normal(u)
        h = w(u) / 2
        top.append((x + nx * h, yy + ny * h))
        bot.append((x - nx * h, yy - ny * h))
    def cap(u, sign):
        # semicircle around the tip, from top edge to bottom edge
        (x, yy), (nx, ny) = pt(u), normal(u)
        h = w(u) / 2
        tx, ty = -ny * sign, nx * sign        # outward tangent
        pts = []
        for k in range(1, 16):
            a = math.pi * k / 16
            c, s = math.cos(a), math.sin(a)
            pts.append((x + (nx * c + tx * s) * h, yy + (ny * c + ty * s) * h))
        return pts
    # top edge L->R, right cap top->bottom, bottom edge R->L, left cap bottom->top
    ring = top + cap(1, 1) + bot[::-1] + cap(-1, -1)[::-1]
    d = 'M' + ' L'.join(f'{x:.1f} {yy:.1f}' for x, yy in ring) + 'Z'
    return d

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    brim = brim_path()
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
<defs>
<linearGradient id="hatGrad" gradientUnits="userSpaceOnUse" x1="0" y1="153" x2="0" y2="414"><stop offset="0" stop-color="#7e6b91"/><stop offset="0.4" stop-color="#9a86ab"/><stop offset="1" stop-color="#e9d6fa"/></linearGradient>
<linearGradient id="brimGrad" gradientUnits="userSpaceOnUse" x1="0" y1="268" x2="0" y2="416"><stop offset="0" stop-color="#b9a5cb"/><stop offset="0.55" stop-color="#d6c2e8"/><stop offset="1" stop-color="#ecdafc"/></linearGradient>
<linearGradient id="dishGrad" gradientUnits="userSpaceOnUse" x1="0" y1="166" x2="0" y2="182"><stop offset="0" stop-color="#86739b"/><stop offset="1" stop-color="#9884ab"/></linearGradient>
<linearGradient id="lidGrad" gradientUnits="userSpaceOnUse" x1="0" y1="158" x2="0" y2="187"><stop offset="0" stop-color="#ab98bd"/><stop offset="1" stop-color="#a390b6"/></linearGradient>
<linearGradient id="bandGrad" gradientUnits="userSpaceOnUse" x1="0" y1="287" x2="0" y2="361"><stop offset="0" stop-color="#4b3d5c"/><stop offset="1" stop-color="#5d4d70"/></linearGradient>
<linearGradient id="bowGrad" gradientUnits="userSpaceOnUse" x1="0" y1="302" x2="0" y2="350"><stop offset="0" stop-color="#76658b"/><stop offset="1" stop-color="#806f95"/></linearGradient>
<linearGradient id="headGrad" gradientUnits="userSpaceOnUse" x1="0" y1="330" x2="0" y2="654"><stop offset="0" stop-color="#3a333f"/><stop offset="1" stop-color="#2e2a33"/></linearGradient>
<linearGradient id="smileGrad" gradientUnits="userSpaceOnUse" x1="0" y1="553" x2="0" y2="640"><stop offset="0" stop-color="#bdb6c6"/><stop offset="0.5" stop-color="#e6e1ec"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
</defs>
<g id="head"><path d="M500 294C381.8 294 286 374.6 286 474C286 582 371.6 654 500 654C628.4 654 714 582 714 474C714 374.6 618.2 294 500 294Z" fill="url(#headGrad)"/></g>
<g id="hat">
<path d="M500 372C375.4 372 274.4 363 274.4 352C284.8 295.5 305.6 235.4 305.6 192.2C305.6 155.2 383.4 158.7 500 158.7C616.6 158.7 694.4 155.2 694.4 192.2C694.4 235.4 715.2 295.5 725.6 352C725.6 363 624.6 372 500 372Z" fill="url(#hatGrad)"/>
<ellipse cx="500" cy="172.7" rx="189" ry="14" fill="url(#lidGrad)"/>
<ellipse cx="500" cy="174.3" rx="146.9" ry="8.1" fill="url(#dishGrad)"/>
<path d="M500 372C375.4 372 274.4 363 274.4 352C278 330.4 281.5 308.8 285.1 287.2C285.1 295.6 381.3 302.3 500 302.3C618.7 302.3 714.9 295.6 714.9 287.2C718.5 308.8 722 330.4 725.6 352C725.6 363 624.6 372 500 372Z" fill="url(#bandGrad)"/>
<path d="M669.7 313.4C662.3 299.4 648.6 293.8 645.5 306.4C642.3 319.1 642.3 333.1 645.5 345.7C648.6 358.4 662.3 352.8 669.7 338.7ZM680.2 313.4C687.6 299.4 701.3 293.8 704.4 306.4C707.6 319.1 707.6 333.1 704.4 345.7C701.3 358.4 687.6 352.8 680.2 338.7Z" fill="url(#bowGrad)"/>
<rect x="667.6" y="309.2" width="14.7" height="33.7" rx="4.2" fill="#8a79a0"/>
<path d="{brim}" fill="url(#brimGrad)"/>
</g>
<g id="eye-left"><circle cx="432" cy="505" r="28" fill="#fdf1fd"/></g>
<g id="eye-right"><path d="M568 460C568 487.9 583.6 505 609 505C583.6 505 568 522.1 568 550C568 522.1 552.4 505 527 505C552.4 505 568 487.9 568 460Z" fill="#fdf1fd"/></g>
<g id="smile"><path d="M500 640C438 640 400 603 378 553C412 591 442 617 500 617C558 617 588 591 622 553C600 603 562 640 500 640Z" fill="url(#smileGrad)"/></g>
</svg>
'''
    out = os.path.join(root, 'assets', 'logo.svg')
    with open(out, 'w') as f:
        f.write(svg)
    print('wrote', out)

if __name__ == '__main__':
    main()

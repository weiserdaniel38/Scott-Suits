# Draws the Semi-Notch and Semi-Peak lapel icons (Lapel Style step) as SVG in the
# same line style as jacket-collar-new-notch/peak.jpg. Render each SVG at 960px and
# downscale to 480px JPG -> assets/jacket-collar-new-semi*-v2.jpg.
import sys, json
CX=240
def m(p): return (2*CX-p[0], p[1])
def P(pts): return " ".join(f"{x:.1f},{y:.1f}" for x,y in pts)
def side(g, mirror=False):
    f=(lambda p:m(p)) if mirror else (lambda p:p)
    s=[]
    W='stroke="#111" stroke-width="3.4" fill="none" stroke-linejoin="miter" stroke-linecap="round"'
    T='stroke="#333" stroke-width="1.5" fill="none" stroke-linecap="round"'
    # shoulder line
    a,b=f(g['sh0']),f(g['sh1'])
    s.append(f'<path d="M{a[0]},{a[1]} Q{(a[0]+b[0])/2},{(a[1]+b[1])/2+3} {b[0]},{b[1]}" {W}/>')
    # collar: neck -> shoulder join -> tip -> inner corner -> gorge end
    s.append(f'<polyline points="{P([f(p) for p in [g["neck"],g["sh1"],g["ctip"],g["cin"],g["gorge"]]])}" {W}/>')
    # lapel: notch point -> lapel tip -> bottom
    s.append(f'<polyline points="{P([f(p) for p in [g["lnotch"],g["ltip"],g["bottom"]]])}" {W}/>')
    if g.get('lnotch')!=g.get('cin'):
        s.append(f'<polyline points="{P([f(g["cin"]),f(g["lnotch"])])}" {W}/>')
    # inner stitch line
    s.append(f'<polyline points="{P([f(p) for p in g["stitch"]])}" {T}/>')
    # shirt side
    n=f(g['neck']); b1=f((172,62)); bt=f((235,440))
    s.append(f'<path d="M{n[0]},{n[1]} Q{b1[0]},{b1[1]-14} {b1[0]},{b1[1]} L{bt[0]},{bt[1]}" {W}/>')
    return s
def svg(g):
    W='stroke="#111" stroke-width="3.4" fill="none" stroke-linecap="round"'
    body=[]
    body+=side(g); body+=side(g,True)
    body.append(f'<path d="M179,30 Q240,18 301,30" {W}/>')
    body.append(f'<path d="M172,62 Q240,50 308,62" {W}/>')
    body.append(f'<line x1="240" y1="56" x2="240" y2="425" {W}/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480"><rect width="480" height="480" fill="#fff"/>{"".join(body)}</svg>'
base=dict(neck=(179,30), sh0=(52,111), sh1=(139,78), bottom=(238,448))
peak=dict(base, ctip=(115,121), cin=(139,133), gorge=(174,99), lnotch=(139,133), ltip=(77,116), stitch=[(92,124),(232,430)])
# semi-peak: tip shorter, more horizontal, small gap under collar
semipeak=dict(base, ctip=(115,121), cin=(139,133), gorge=(174,99), lnotch=(135,140), ltip=(90,123), stitch=[(103,131),(232,430)])
notch=dict(base, ctip=(115,121), cin=(139,133), gorge=(174,99), lnotch=(132,141), ltip=(104,154), stitch=[(118,162),(232,430)])
# semi-notch: notch gap narrower, lapel tip lifted toward collar tip
seminotch=dict(base, ctip=(115,121), cin=(139,133), gorge=(174,99), lnotch=(135,141), ltip=(105,136), stitch=[(117,145),(232,430)])
for k,v in dict(peak=peak,semipeak=semipeak,notch=notch,seminotch=seminotch).items():
    open(k+'.svg','w').write(svg(v))

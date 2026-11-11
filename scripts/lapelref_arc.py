# Arc lapel reference for the suit picture generator, same look as jacket-lapelref-diamond.jpg
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, sys
S=3; W=900*S
def bez(p0,p1,p2,p3,n=60):
    t=np.linspace(0,1,n)[:,None]; P=[np.array(p) for p in (p0,p1,p2,p3)]
    return [tuple(x) for x in ((1-t)**3*P[0]+3*(1-t)**2*t*P[1]+3*(1-t)*t**2*P[2]+t**3*P[3])]
def sc(pts): return [(x*S,y*S) for x,y in pts]
def mir(pts): return [(900-x,y) for x,y in pts]
BG=(243,243,243); BODY=(98,104,115); LAP=(112,118,128); LINE=(38,38,44); SHIRT=(250,250,250)
im=Image.new('RGB',(W,W),BG); d=ImageDraw.Draw(im)
# jacket body with shoulders
d.polygon(sc([(0,250),(370,98),(530,98),(900,250),(900,900),(0,900)]),fill=BODY)
# shirt V
d.polygon(sc([(408,100),(492,100),(450,700)]),fill=SHIRT)
outer=[(372,98)]+bez((372,98),(300,150),(256,240),(256,340))[1:]+[(256+2*k/40,340+260*k/40) for k in range(1,41)]+bez((258,600),(262,760),(370,812),(450,812))[1:]
inner=[(450,812),(450,700),(408,100),(372,98)]
left=outer+inner[1:]
for poly in (left,mir(left)):
    d.polygon(sc(poly),fill=LAP)
# outlines
for o in (outer,mir(outer)): d.line(sc(o),fill=LINE,width=7*S,joint='curve')
for a,b in [((408,100),(450,700)),((492,100),(450,700)),((450,700),(450,900))]: d.line(sc([a,b]),fill=LINE,width=3*S)
# dashed pick stitch ~16px inside the outer edge
def offset(pts,dist,side):
    out=[]
    for i,(x,y) in enumerate(pts):
        a=np.array(pts[max(i-1,0)]); b=np.array(pts[min(i+1,len(pts)-1)]); t=b-a; t=t/ (np.linalg.norm(t)+1e-9)
        n=np.array([-t[1],t[0]])*side; out.append((x+n[0]*dist,y+n[1]*dist))
    return out
for o,side in ((outer,-1),(mir(outer),1)):
    st=offset(o[2:-6],16,side); acc=0; draw=True
    for p,q in zip(st,st[1:]):
        seg=np.hypot(q[0]-p[0],q[1]-p[1]); acc+=seg
        if draw: d.line(sc([p,q]),fill=(170,176,186),width=3*S)
        if acc>14: acc=0; draw=not draw
# collar band at the neck
d.polygon(sc([(398,76),(502,76),(522,98),(378,98)]),fill=LAP,outline=LINE,width=4*S)
# one covered button at the bottom of the arc
d.ellipse(sc([(436,822),(464,850)]),fill=(40,40,46))
im=im.resize((900,900),Image.LANCZOS)
im.save(sys.argv[1],quality=92)

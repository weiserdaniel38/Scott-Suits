"""Builds the photo jacket used by the Interactive Jacket (jacket-studio.js).

Source: scripts/source/jacket-photo-source.png (Daniel's mockup, 2026-10-18).
Writes, cropped to the jacket (800x952, source pixels x110-910, y196-1148):
  assets/jacket-photo-front.webp        the photo with the mockup's markers
                                        and labels painted out and its backdrop
                                        replaced by a soft glow that fades
                                        into the page color
  assets/jacket-photo-shade-front.webp  shading of the cloth: top half = how
                                        much darker than the average each
                                        pixel is (0-1), bottom half = how much
                                        brighter (0-1); alpha = where the cloth is
  assets/jacket-photo-shade-front-{peak,diamond,shawl}.webp
                                        the same with the lapels redrawn in
                                        that style (the photo has notch lapels)
  assets/jacket-photo-shade-back.webp   the same for the back / inside views,
                                        made from the front with the opening
                                        closed and the body smoothed

The site paints any fabric tile with these, so every fabric shows on the
same jacket. Pockets, buttons and buttonholes are painted out of the photo
and drawn by jacket-studio.js from the customer's choices.
Run: python3 scripts/make_jacket_photo.py (needs numpy + Pillow).
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os, sys
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.dirname(HERE)
im=Image.open(os.path.join(HERE,'source','jacket-photo-source.png')).convert('RGB')
a=np.asarray(im).astype(np.float32)
H,W=a.shape[:2]
AX=1017
L=a.mean(2)
red=(a[...,0]-a[...,2])>18

def poly_cov(pts):
    S=4
    m=Image.new('L',(W*S,H*S),0); ImageDraw.Draw(m).polygon([(x*S,y*S) for x,y in pts],fill=255)
    return np.asarray(m.resize((W,H),Image.BOX)).astype(np.float32)/255
def shape_mask(circles=(),rects=(),polys=()):
    m=Image.new('L',(W,H),0); d=ImageDraw.Draw(m)
    for (x,y,r) in circles: d.ellipse((x-r,y-r,x+r,y+r),fill=1)
    for (x0,y0,x1,y1) in rects: d.rounded_rectangle((x0,y0,x1,y1),9,fill=1)
    for p in polys: d.polygon(p,fill=1)
    return np.asarray(m)>0

def lbl(x0,y0,x1,y1,p=8): return (x0-p,y0-p,x1+p,y1+p+2)
R=37
shoulder_bg=[(600,240),(657,280),(722,307),(772,322),(790,326),(806,350),(840,350),(840,240)]
# lapel edge line (663,362)->(565,600): domain right/below = 'chest'
lapel_chest=[(663,362),(565,600),(760,600),(760,362)]
front_left_top=[(440,680),(508,680),(501,780),(440,780)]
front_left_bot=[(440,815),(506,815),(507,880),(440,880)]
sleeve_bg=[(100,880),(141,880),(141,1060),(100,1060)]
gap=[(265,965),(274,965),(267,1024),(265,1024)]
body_right_of_gap=[(274,965),(400,965),(400,1030),(267,1030),(267,1024)]
rsleeve_bg=[(882,960),(930,960),(930,1030),(882,1030)]
rflap_bg=[(725,790),(760,790),(760,890),(742,890),(739,868)]
lflap_bg=[(250,790),(285,790),(285,890),(250,890)]
holes=[
 dict(m=shape_mask([(311,413,R)],[lbl(323,435,397,468)])),
 dict(m=shape_mask([(630,325,R)],[lbl(662,309,771,342)]), dom=[('bg',shoulder_bg)], mirror={'fab'}),
 dict(m=shape_mask([(599,436,R)],[lbl(611,458,681,491),(596,452,726,530)]), dom=[('chest',lapel_chest)]),
 dict(m=shape_mask([(519,730,R)],[lbl(545,734,676,768)]), dom=[('L',front_left_top)]),
 dict(m=shape_mask([(499,845,16)]), dom=[('L',front_left_bot)]),
 dict(m=shape_mask([(338,841,R)],[lbl(349,863,435,896),(285,794,400,880)]), dom=[('bg',lflap_bg)]),
 dict(m=shape_mask([],[(626,798,741,884)]), dom=[('bg',rflap_bg)]),
 dict(m=shape_mask([(172,968,R)],[lbl(199,980,335,1013),(133,920,152,1010)]), dom=[('bg',sleeve_bg),('gap',gap),('body',body_right_of_gap)]),
 dict(m=shape_mask([(878,994,9)]), dom=[('bg',rsleeve_bg)]),
 # Where the photo's flaps stuck out past the body into the gap by the arms.
 dict(m=shape_mask(polys=[[(266,792),(302,792),(302,879),(266,879)]]), dom=[('bg',[(240,770),(320,770),(320,910),(240,910)])], flat=True),
 dict(m=shape_mask(polys=[[(725,797),(743,797),(757,881),(741,881)]]), dom=[('bg',[(700,770),(790,770),(790,910),(700,910)])], flat=True),
]
out=a.copy()
allhole=np.zeros((H,W),bool)
def diffuse(v,known,domain_px,hole,iters):
    # v: (h,w,3); weights: pixels usable = domain_px & (known|hole)
    w=(domain_px&(known|hole)).astype(np.float32)
    v=v.copy()
    mean=v[known].mean(0) if known.any() else np.zeros(3)
    v[hole]=mean
    v*=w[...,None]
    for _ in range(iters):
        p=np.pad(v,((1,1),(1,1),(0,0)))
        pw=np.pad(w,1)
        s=p[:-2,1:-1]+p[2:,1:-1]+p[1:-1,:-2]+p[1:-1,2:]
        sw=pw[:-2,1:-1]+pw[2:,1:-1]+pw[1:-1,:-2]+pw[1:-1,2:]
        nv=s/np.maximum(sw,1e-6)[...,None]
        v[hole]=nv[hole]
    return v
for h in holes:
    m=h['m']; allhole|=m
    ys,xs=np.where(m); y0,y1,x0,x1=max(ys.min()-30,0),ys.max()+31,max(xs.min()-30,0),xs.max()+31
    sub=out[y0:y1,x0:x1]; hm=m[y0:y1,x0:x1]; Ls=L[y0:y1,x0:x1]; rs=red[y0:y1,x0:x1]
    # coverage per domain (antialiased); 'fab' gets what's left
    covs={}
    rest=np.ones(hm.shape,np.float32)
    for name,poly in h.get('dom',[]):
        c=poly_cov(poly)[y0:y1,x0:x1]*rest
        covs[name]=covs.get(name,0)+c; rest=rest-c
    covs['fab']=rest
    if h.get('flat'):
        # The flap stuck out over the gap between arm and body. Rebuild the
        # gap row by row from its edges just above and below the hole, with
        # plain backdrop in it and cloth (mirrored from beside the hole) on
        # either side.
        bgc=np.median(sub[~hm&(Ls>200)],0)
        rows=np.where(hm.any(1))[0]; ra,rb=rows[0]-2,rows[-1]+2
        def run(r):
            xs_=np.where(Ls[r]>180)[0]
            cx=np.where(hm[rows[len(rows)//2]])[0].mean()
            xs_=xs_[np.abs(xs_-cx)<40]
            return xs_.min(),xs_.max()
        (la,lb),(ua,ub)=run(ra),run(rb)
        for r in rows:
            f=(r-ra)/(rb-ra); g0=la+(ua-la)*f; g1=lb+(ub-lb)*f
            cols=np.where(hm[r])[0]; c0,c1=cols.min(),cols.max()
            for c in cols:
                if g0<=c<=g1: sub[r,c]=bgc
                elif c<g0: sub[r,c]=sub[r,max(2*c0-c-1,0)]
                else: sub[r,c]=sub[r,min(2*c1-c+1,sub.shape[1]-1)]
        out[y0:y1,x0:x1]=sub
        continue
    res=np.zeros_like(sub)
    for name,cov in covs.items():
        dp=cov>0.5
        light = name in ('bg','gap')
        good = (Ls>150) if light else ((Ls<135)&~rs)
        known=dp&~hm&good
        hole=hm&(cov>0)
        dpx=dp|hole
        if name in h.get('mirror',()):
            # find the best mirror axis/offset on the ring around the hole
            from PIL import ImageFilter
            ring=known&~hm
            Lo=out.mean(2)
            hp=Lo-np.asarray(Image.fromarray(Lo.astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))).astype(np.float32)
            best=None
            for ax in range(995,1040):
                for dy in range(-12,13):
                    xs_=np.clip(ax-np.arange(x0,x1),0,W-1)
                    m2=hp[y0+dy:y1+dy][:,xs_]
                    e=np.abs(hp[y0:y1,x0:x1]-m2)[ring].mean()
                    if best is None or e<best[0]: best=(e,ax,dy)
            print('mirror',best)
            _,ax,dy=best
            xs_=np.clip(ax-np.arange(x0,x1),0,W-1)
            mir=out[y0+dy:y1+dy][:,xs_]
            # seamless: diffuse the difference from the boundary
            diff=sub-mir
            dv=diffuse(diff,known,dpx,hole,1500)
            v=mir+dv
        else:
            v=diffuse(sub,known,dpx,hole,1500)
        res+=v*cov[...,None]
    res=np.where(hm[...,None],res,sub)
    out[y0:y1,x0:x1]=res
clean_img=Image.fromarray(np.clip(out,0,255).astype(np.uint8))

CROP=(110,196,910,1148)
im=clean_img.crop(CROP)
a=np.asarray(im).astype(np.float32)
L=a.mean(2)
tie=(a[...,0]-a[...,2])
alpha=np.clip((140-L)/45,0,1)*np.clip((22-tie)/8,0,1)
# In the shirt-and-tie V, only blue-ish dark pixels are cloth (the tie's
# shadows are dark too, but warm).
_vm=Image.new('L',(im.width,im.height),0)
ImageDraw.Draw(_vm).polygon([(x-CROP[0],y-CROP[1]) for x,y in [(440,226),(588,226),(582,496),(542,636),(506,652),(470,626),(440,496)]],fill=255)
_vm=np.asarray(_vm.filter(ImageFilter.GaussianBlur(2))).astype(np.float32)/255
blue=a[...,2]-a[...,0]
alpha=alpha*(1-_vm*(1-np.clip((blue-3)/7,0,1)))
# clean tiny specks with a small open/close via min/max filters
al=Image.fromarray((alpha*255).astype(np.uint8))
al=al.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
alpha=np.asarray(al).astype(np.float32)/255
Lref=np.median(L[alpha>0.9])
GAMMA=0.8
MED=5
Lu=Image.fromarray(np.clip(L*3,0,255).astype(np.uint8))  # stretch dark range before 8-bit filtering
Ls=np.asarray(Lu.filter(ImageFilter.MedianFilter(MED)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32)/3
# The shirt showed in a small wedge between the fronts below the bottom
# button; fill it with the trousers' shading (the suit's own cloth) instead.
_w=np.zeros(alpha.shape,bool); _w[704:770,384:418]=True; _w&=alpha<0.95
Ls[_w]=np.median(Ls[772:780,390:412]); alpha=np.where(_w,1.0,alpha)
r=np.maximum(Ls,1)/Lref
r=r**GAMMA
M1=np.clip(r,0,1)*255; M2=np.clip(r-1,0,1)*255
print('Lref',Lref,'r pct',np.percentile(r[alpha>0.9],[1,10,50,90,99]))
A=alpha*255
top=np.dstack([M1,M1,M1,A]); bot=np.dstack([M2,M2,M2,A])
Image.fromarray(np.concatenate([top,bot],0).astype(np.uint8),'RGBA').save(os.path.join(ROOT,'assets','jacket-photo-shade-front.webp'),quality=92,method=6)

# ---- Lapel styles -----------------------------------------------------------
# The photo has notch lapels. For peak, diamond and shawl lapels the shading
# is redrawn around the gorge: the notch is filled in with smooth cloth
# shading and the new lapel edge is drawn as a seam with a soft shadow on the
# body side. Points are for the viewer's right lapel (crop pixels); the left
# one is mirrored across x = 401.5.
MX=803
def mir(pts): return [(MX-x,y) for x,y in pts]
SS=4
def aa_mask(draw_fn):
    H,W=Ls.shape
    m=Image.new('L',(W*SS,H*SS),0); draw_fn(ImageDraw.Draw(m))
    return np.asarray(m.resize((W,H),Image.LANCZOS)).astype(np.float32)/255
def S(pts): return [(x*SS,y*SS) for x,y in pts]
def fill_zone(v,zone):
    ys,xs=np.where(zone); y0,y1,x0,x1=ys.min()-3,ys.max()+4,xs.min()-3,xs.max()+4
    sub=v[y0:y1,x0:x1].copy(); hz=zone[y0:y1,x0:x1]
    sub[hz]=sub[~hz].mean()
    for _ in range(1500):
        p=np.pad(sub,1,mode='edge')
        nv=(p[:-2,1:-1]+p[2:,1:-1]+p[1:-1,:-2]+p[1:-1,2:])/4
        sub[hz]=nv[hz]
    v[y0:y1,x0:x1]=sub
def cubic(p0,c1,c2,p3,n=40):
    out=[]
    for t in np.linspace(0,1,n):
        a,b,c,d=(1-t)**3,3*(1-t)**2*t,3*(1-t)*t*t,t**3
        out.append((a*p0[0]+b*c1[0]+c*c2[0]+d*p3[0],a*p0[1]+b*c1[1]+c*c2[1]+d*p3[1]))
    return out
# The photo's own lapel lines, wiped where a style changes them: the collar
# piece with its gorge seam, the notch, and the lapel's outer edge.
COLLAR=[(476,88),(522,76),(556,116),(527,135),(492,108)]
NOTCH=[(522,127),(558,142),(563,152),(553,161),(523,137)]
OLD_EDGE=[(559,150),(525,245),(490,332),(455,385),(402,465),(392,500)]
# The shapes follow the lapel descriptions the AI suit preview uses
# (supabase/functions/generate-suit-image, OPTION_LOOKS "Lapel Style").
LAPEL={
  # Upper edge sweeps up into a sharp point aimed at the shoulder, with only
  # a narrow gap below the collar.
  'peak': dict(polys=[[(523,131),(551,121),(579,99),(584,107),(562,161),(552,161),(555,148)]], lines=[],
               edges=[([(556,158),(576,104)],(1.6,1.0)),([(576,104),(531,127)],None)],
               gap=[(526,128.5),(549,117.5),(554,119.5),(531,128)]),
  # Collar and lapel in one piece from the neck: a straight edge out to one
  # sharp point level with the chest pocket's top, then a longer straight
  # edge back in to the top button (a tall kite).
  'diamond': dict(polys=[COLLAR,NOTCH], lines=[(OLD_EDGE,18)],
                  edges=[([(515,74),(552,205),(392,500)],(1.6,1.2))]),
  # One smooth rounded edge from the neck to the top button.
  'shawl': dict(polys=[COLLAR,NOTCH], lines=[(OLD_EDGE,18)],
                edges=[(cubic((515,74),(566,112),(566,250),(392,500)),(1.6,1.2))]),
}
def soft(m,r): return np.asarray(Image.fromarray((np.clip(m,0,1)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32)/255
def lapel_variant(base,style):
    v=base.copy()
    d=LAPEL[style]
    def zdraw(g):
        for f in (lambda q:q, mir):
            for z in d['polys']: g.polygon(S(f(z)),fill=255)
            for pts,w in d['lines']: g.line(S(f(pts)),fill=255,width=int(w*SS),joint='curve')
    zone=aa_mask(zdraw)>0.3
    fill_zone(v,zone)
    for f,sx in ((lambda q:q,1),(mir,-1)):
        if d.get('gap'):
            v*=1-0.45*soft(aa_mask(lambda g:g.polygon(S(f(d['gap'])),fill=255)),0.6)
        for pts,sh in d['edges']:
            P=f(pts)
            if sh:
                m=aa_mask(lambda g:g.line(S([(x+sx*sh[0],y+sh[1]) for x,y in P]),fill=255,width=int(3.2*SS),joint='curve'))
                v*=1-0.3*soft(m,1.8)
                hi=aa_mask(lambda g:g.line(S([(x-sx*1.3,y) for x,y in P]),fill=255,width=int(1.0*SS),joint='curve'))
                v*=1+0.1*hi
            v*=1-0.5*aa_mask(lambda g:g.line(S(P),fill=255,width=int(1.3*SS),joint='curve'))
    return v
for style in LAPEL:
    vs=lapel_variant(Ls,style)
    rv=(np.maximum(vs,1)/Lref)**GAMMA
    t2=np.dstack([np.clip(rv,0,1)*255]*3+[A]); b2=np.dstack([np.clip(rv-1,0,1)*255]*3+[A])
    Image.fromarray(np.concatenate([t2,b2],0).astype(np.uint8),'RGBA').save(os.path.join(ROOT,'assets','jacket-photo-shade-front-'+style+'.webp'),quality=92,method=6)
# Replace the photo's backdrop (warm cream; the shirt is neutral white) with
# a clean soft glow that fades to exactly the page color (#ECE4DD) at the
# edges, so the picture has no visible edge on the page.
H,W=L.shape
PAGE=np.array([236,228,221],np.float32)
GLOW=np.array([245,240,233],np.float32)
yy,xx=np.mgrid[0:H,0:W]
rr=np.sqrt(((xx-400)/430.0)**2+((yy-430)/520.0)**2)
t=np.clip(rr,0,1); t=t*t*(3-2*t)
field=GLOW[None,None,:]*(1-t[...,None])+PAGE[None,None,:]*t[...,None]
warm=a[...,0]-a[...,2]
wbg=np.clip((warm-4)/4,0,1)*np.clip((L-195)/20,0,1)
wbg=np.asarray(Image.fromarray((wbg*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32)/255
out_rgb=a*(1-wbg[...,None])+field*wbg[...,None]
base=np.dstack([np.clip(out_rgb,0,255),np.full((H,W),255,np.float32)]).astype(np.uint8)
Image.fromarray(base,'RGBA').save(os.path.join(ROOT,'assets','jacket-photo-front.webp'),quality=95,method=6,use_sharp_yuv=True)

# ---------------- back / inside silhouette + shading ----------------
from PIL import ImageDraw
OX,OY=CROP[0],CROP[1]
def P(pts): return [(x-OX,y-OY) for x,y in pts]
def polymask(pts,blur=0):
    m=Image.new('L',(W,H),0); ImageDraw.Draw(m).polygon(P(pts),fill=255)
    if blur: m=m.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(m).astype(np.float32)/255
torso=[(250,330),(268,450),(280,700),(284,1060),(298,1128),(722,1128),(736,1060),(742,700),(752,450),(770,330),(700,292),(600,232),(420,232),(318,292)]
center=[(432,236),(588,236),(604,520),(640,1000),(700,1127),(320,1127),(380,1000),(414,520)]
cm=polymask(center)>0.5
alpha_b=np.maximum(alpha, polymask(center))
tm=polymask(torso)
# fill L in the torso where it isn't fabric (shirt, tie, trousers gap), at 1/4 res
small=lambda x: np.asarray(Image.fromarray(x.astype(np.float32),'F').resize((W//4,H//4),Image.BILINEAR))
Ls_=small(L); al_=small(alpha); tm_=small(tm)
hole=(tm_>0.3)&(al_<0.9)
known=(al_>0.9)
v=Ls_.copy(); v[hole]=np.median(Ls_[known])
wgt=(known|hole).astype(np.float32)
v=v*wgt
for _ in range(2500):
    p=np.pad(v,1); pw=np.pad(wgt,1)
    s=p[:-2,1:-1]+p[2:,1:-1]+p[1:-1,:-2]+p[1:-1,2:]
    sw=pw[:-2,1:-1]+pw[2:,1:-1]+pw[1:-1,:-2]+pw[1:-1,2:]
    nv=s/np.maximum(sw,1e-6); v[hole]=nv[hole]
big=np.asarray(Image.fromarray(v,'F').resize((W,H),Image.BILINEAR))
filled=np.where(alpha>0.9, L, big)
blurred=np.asarray(Image.fromarray(np.clip(filled*3,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(34))).astype(np.float32)/3
tmb=polymask(torso,6)
Lb=filled*(1-tmb)+blurred*tmb
Lb=np.where(alpha_b>0, Lb, Lref)
rb=(np.maximum(Lb,1)/Lref)**GAMMA
# sleeves keep their crisp (median-smoothed) shading from the front
rs_=np.where(tmb>0.5, rb, r)
M1=np.clip(rs_,0,1)*255; M2=np.clip(rs_-1,0,1)*255; A=alpha_b*255
top=np.dstack([M1,M1,M1,A]); bot=np.dstack([M2,M2,M2,A])
Image.fromarray(np.concatenate([top,bot],0).astype(np.uint8),'RGBA').save(os.path.join(ROOT,'assets','jacket-photo-shade-back.webp'),quality=92,method=6)

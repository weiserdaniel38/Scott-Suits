#!/usr/bin/env python3
"""The jacket's lower and chest pockets, lifted off Daniel's pocket photos.

Daniel 2026-11-22 (Scott_Suits_Pocket_Options.pdf): the same jacket once per
lower pocket option, and "Keep exactly as is": the pockets in the Your Suit
picture are the ones in his photos, same shape, size and place.

Each photo (assets/reference/jacket-pockets-<name>.webp, its brightness
only) is turned into the same grain-free light map as the jacket fronts
(scripts/make_jacket_photo_front2.py). The pocket's own light and shadow is
that map against the cloth without the pocket: plain cloth carried across
the pocket along the jacket's outline. What is left is 1 where nothing
changes, below 1 in the pocket's shadows and seams, above 1 where it catches
the light.

Out: assets/jacket-pocket-lower-<option>.webp (2 x 2 cells: viewer's left
pocket | right pocket; shadow on top as black by alpha, light under it as
white by alpha, the light at three times its strength) and the
POCKET_PHOTOS numbers for jacket-studio.js, printed and written to
<check folder>/pocket_meta.json.

The chest pockets (welt, curved welt, slit, patch) come off the same photos
the same way, hung from the lapel's edge: assets/jacket-pocket-chest-<style>.webp
(shadow on top, light under it) and the CHEST_PHOTOS numbers
(<check folder>/pocket_chest_meta.json). --chest makes only those.

    python3 scripts/make_jacket_pockets.py [check folder] [--chest]

Needs Pillow and numpy.
"""
import sys, os, glob, json
_args = sys.argv[1:]; sys.argv = sys.argv[:1]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_jacket_photo_front2 import shade_map, blur, inpaint, u8
from PIL import Image, ImageFilter, ImageDraw
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'reference', 'jacket-pockets-')
CLEAN = os.path.join(ROOT, 'assets', 'reference', 'jacket-front-sb-notch.webp')
OUT = os.path.join(ROOT, 'assets', 'jacket-pocket-lower-')
S, OY = 0.681, 19.0          # photo px to picture units (SB_CLEAN in make_jacket_photo_front2.py)
# photo -> file name; the catalog's option names are in jacket-studio.js (POCKET_PHOTOS)
SLUG = {'00-flap-flapticket-chestwelt': 'flap-ticketflap', '01-flap-chestboat': 'flap', '02-flap-slitticket-chestslit': 'flap-ticketslit',
        '03-jetted-chestpatch': 'slit', '04-jetted-slitticket-chestboat': 'slit-ticketslit', '05-singlewelt-chestslit': 'welt',
        '06-slantedjetted-chestpatch': 'slantslit', '07-slantedflap': 'slantflap', '08-slantedflap-slantedslitticket': 'slantflap-ticketslit',
        '09-slantedflap-slantedflapticket': 'slantflap-ticketflap', '10-pointedflap': 'pointflap', '11-pointedflap-button': 'pointflap-button',
        '12-patch': 'patch', '13-patch-slitticket': 'patch-ticketslit', '14-slopedpatch': 'slopedpatch', '15-slopedpatch-slitticket': 'slopedpatch-ticketslit'}
# The button on the pointed flap (photo px: x, y, radius painted out): the
# picture draws the customer's own button there.
HOLES = {('11-pointedflap-button', 'L'): [(335, 950, 20)], ('11-pointedflap-button', 'R'): [(785, 951, 22)]}
NOM = {'L': (364.0, -0.011), 'R': (754.0, 0.010)}       # the front darts: x at row 700, lean
ZONES = {'L': (196, 770, 480, 1328), 'R': (640, 770, 932, 1328)}
RIM = 10; D0 = 16; DMAX = 350; DIN = 50


def mx(m, n): return np.asarray(u8(m.astype(np.float32)).filter(ImageFilter.MaxFilter(n))) > 127
def mn(m, n): return np.asarray(u8(m.astype(np.float32)).filter(ImageFilter.MinFilter(n))) > 127

def blur1(a,s,ax):
    n=int(np.ceil(3*s)); k=np.exp(-0.5*(np.arange(-n,n+1)/s)**2); k/=k.sum()
    pad=[(0,0),(0,0)]; pad[ax]=(n,n); q=np.pad(a,pad,mode='edge'); m=a.shape[ax]
    return sum(k[i]*np.take(q,np.arange(i,i+m),axis=ax) for i in range(2*n+1)).astype(np.float32)

def dart_line(R,side):
    x0,k=NOM[side]
    hh=1-R/np.maximum(blur1(R,4,1),1e-3)
    resp=blur1(np.maximum(hh,0),8,0)
    pts=[]
    for y in range(600,1300,4):
        c=x0+k*(y-700); a=int(c-6); seg=resp[y,a:a+13]; i=int(seg.argmax())
        if seg[i]>0.012: pts.append((y,a+i))
    if len(pts)>=12:
        ys=np.array([p[0] for p in pts]); xs=np.array([p[1] for p in pts]); f=np.polyfit(ys,xs,1)
    else: f=np.array([k,x0-k*700])
    return f,resp,len(pts)

def no_dart(R,f,resp,y0,y1):
    out=R.copy()
    for y in range(y0,y1):
        c=int(round(np.polyval(f,y)))
        w=float(np.clip((resp[y,c-2:c+3].max()-0.008)/0.008,0,1))
        if w<=0: continue
        a,b=R[y,c-5],R[y,c+5]
        for i,x in enumerate(range(c-4,c+5)):
            t=(i+1)/10.0; out[y,x]=R[y,x]*(1-w)+w*(a*(1-t)+b*t)
    return out

def body_mask(al):
    """The body between the sleeves: per row the cloth run through the middle."""
    c=al>0.5; H,W=c.shape; B=np.zeros(c.shape,bool); last=None
    for y in range(H-1,-1,-1):
        row=c[y]
        if not row[540:580].any(): continue
        x=540+int(np.argmax(row[540:580])); l=x
        while l>0 and row[l-1]: l-=1
        r=x
        while r<W-1 and row[r+1]: r+=1
        if last is not None:            # where the sleeves join the body, keep the body's own width
            l=max(l,last[0]-3); r=min(r,last[1]+3)
        B[y,l:r+1]=True; last=(l,r)
    return B

def comps(m):
    """Connected components of a boolean mask (list of boolean masks)."""
    work=Image.fromarray((m*255).astype(np.uint8)).copy(); out=[]
    while True:
        arr=np.asarray(work)
        if arr.max()<255: break
        y,x=np.unravel_index(int(arr.argmax()),arr.shape)
        ImageDraw.floodfill(work,(int(x),int(y)),100,thresh=0)
        arr=np.asarray(work).copy(); c=arr==100; out.append(c)
        arr[c]=0; work=Image.fromarray(arr).copy()
    return out

def theil(xs,ys):
    xs=np.asarray(xs,float); ys=np.asarray(ys,float)
    if len(xs)<8: return 0.0
    i=np.arange(len(xs)); sl=[]
    for d in (8,12,16,20):
        if len(xs)>d: sl+=list((ys[d:]-ys[:-d])/(xs[d:]-xs[:-d]))
    return float(np.median(sl)) if sl else 0.0

def straighten(img,edge,sgn):
    H,W=img.shape; xs=np.arange(W); dd=np.arange(-D0,DMAX); out=np.empty((H,len(dd)),np.float32)
    for y in range(H): out[y]=np.interp(edge[y]+sgn*dd,xs,img[y])
    return out

def unstraighten(S,edge,sgn,W):
    H,D=S.shape; out=np.empty((H,W),np.float32); xs=np.arange(W); dd=np.arange(-D0,DMAX)
    for y in range(H): out[y]=np.interp((xs-edge[y])*sgn,dd,S[y])
    return out

def medfilt(a,n):
    p=np.pad(a,n//2,mode='edge'); return np.array([np.median(p[i:i+n]) for i in range(len(a))])

def shape_of(Fs):
    """Top and bottom of a pocket per column of the straightened picture
    (column = distance from the outline + D0), from its features inside."""
    H,D=Fs.shape; dd=np.arange(D)-D0
    has=Fs.sum(0)>=2
    ds=[d for d in range(DIN,DMAX) if has[d+D0]]
    if len(ds)<30: return None
    dend=max(ds)
    top=np.array([np.argmax(Fs[:,d+D0]) for d in ds],float); bot=np.array([H-1-np.argmax(Fs[::-1,d+D0]) for d in ds],float)
    ds=np.array(ds,float)
    best=None; rng=np.random.RandomState(1); idx=np.arange(len(ds))
    for _ in range(1500):
        i,j=rng.choice(idx,2,replace=False)
        if abs(ds[i]-ds[j])<25: continue
        k=(top[j]-top[i])/(ds[j]-ds[i])
        if abs(k)>0.8: continue
        res=top-(top[i]+k*(ds-ds[i])); sc=(np.abs(res)<2.5).sum()-3*(res<-5).sum()
        if best is None or sc>best[0]: best=(sc,k,top[i]-k*ds[i])
    _,k,a=best
    ok=np.abs(top-(a+k*ds))<2.5
    k,a=np.polyfit(ds[ok],top[ok],1)
    T=a+k*dd                                     # the top edge: a straight line
    for d,t in zip(ds,top):
        if abs(t-(a+k*d))<10: T[int(d)+D0]=t
    # columns where only the top edge was found do not count for the bottom
    hgt=bot-(a+k*ds); v=hgt>0.4*np.median(hgt)
    dv=ds[v]; bv=medfilt(bot[v],9)
    B=np.full(D,np.nan)
    full=np.arange(int(dv.min())+D0,int(dend)+D0+1); B[full]=np.interp(full,dv+D0,bv)
    m=dv<=dv.min()+60
    kb=theil(dv[m],bv[m]) if m.sum()>20 else 0.0
    c1=int(dv.min())+D0
    b0=np.median(B[c1:c1+8])
    B[:c1]=b0+kb*(np.arange(c1)-c1-3.5)
    return dict(T=T,B=B,dend=int(dend),k=float(k),kb=float(kb))

def zone_mask(shape,sh,mt,mb,mi):
    H,D=shape; m=np.zeros(shape,bool)
    for c in range(0,sh['dend']+D0+mi+1):
        if c>=D: break
        cc=min(c,sh['dend']+D0)
        t=sh['T'][cc]-mt; b=sh['B'][cc]+mb
        m[max(0,int(round(t))):min(H,int(round(b))+1),c]=True
    return m

def body_of(al):
    """The body between the sleeves; a shiny button does not break it."""
    c=al>0.5; c=mn(mx(c,7),7); c=mn(mx(c,7),7) if False else c
    return body_mask(c.astype(np.float32))

def lower(n,side,R,al,thr=0.045,zone=None,holes=(),split=None,body=None):
    X0,Y0,X1,Y1=zone or ZONES[side]
    f,resp,npts=dart_line(R,side)
    Rn=no_dart(R,f,resp,Y0-40,Y1+20)
    if body is None: body=body_of(al)
    wx,wy=X0-80,Y0-80; sl=(slice(wy,Y1+60),slice(wx,X1+80))
    Rn=Rn[sl].copy(); al=al[sl]; body=body[sl]
    H,W=Rn.shape
    for hx,hy,hr in holes:                    # a button on the flap: painted out, from the flap's own cloth
        yy,xx=np.mgrid[0:H,0:W]; rr=(xx-(hx-wx))**2+(yy-(hy-wy))**2
        hm=rr<=hr*hr; ring=(rr>(hr+1)**2)&(rr<=(hr+10)**2)
        src=ring&(Rn>0.8*np.median(Rn[ring]))&(yy<hy-wy+hr-2)
        Rn=inpaint(Rn,hm,src)
    x0,y0,x1,y1=X0-wx,Y0-wy,X1-wx,Y1-wy
    sgn=1 if side=='L' else -1
    edge=np.array([(np.where(body[y])[0][0] if side=='L' else np.where(body[y])[0][-1]) if body[y].any() else -1 for y in range(H)],np.float32)
    good=edge>=0; edge=np.interp(np.arange(H),np.where(good)[0],edge[good])
    # The outline runs smoothly: where a cuff or the hem's corner pulls the
    # mask away from it, it is carried on along its own slope.
    def track(e,start,step):
        e=e.copy(); y=start+step
        while 0<=y<len(e):
            past=e[y-step*30:y:step] if step>0 else e[y+1:y+31][::-1]
            past=np.asarray(past if step>0 else past)
            hist=e[max(0,y-30):y] if step>0 else e[y+1:y+31][::-1]
            sl_=(hist[-1]-hist[0])/max(1,len(hist)-1) if len(hist)>4 else 0.0
            pred=e[y-step]+sl_
            if abs(e[y]-pred)>3: e[y]=pred
            y+=step
        return e
    st=(y0+y1)//2
    while st>y0 and abs(edge[st]-np.median(edge[st-10:st+11]))>2: st-=5
    edge=track(track(edge,st,1),st,-1)
    edge=np.convolve(np.pad(edge,7,mode='edge'),np.ones(15)/15,'valid')
    xs_=np.arange(W); dist=(xs_[None,:]-edge[:,None])*sgn
    solid=mn(body&(al>0.97),3)
    hp=Rn/np.maximum(blur(Rn,10),1e-3)
    Z=np.zeros(Rn.shape,bool); Z[y0:y1,x0:x1]=True
    F=(np.abs(hp-1)>thr)&mn(body,25)&(dist>=DIN-6)&Z
    F&=mx(blur(F.astype(np.float32),5)>0.12,9)        # specks go
    cs=[]
    big=np.zeros(F.shape,bool)
    for c in comps(mx(F,9)):
        ys,xs=np.where(c)
        if c.sum()>900 and xs.max()-xs.min()>55: big|=c
    near_big=mx(big,81)
    for c in comps(mx(F,9)):
        if c.sum()>300 and (c&near_big).any(): big|=c
    F&=big
    if split is not None:                      # nothing joins a ticket pocket to the pocket under it
        yy=np.arange(H)[:,None]+wy; vv=yy-(split[0]+split[1]*(dist-98))
        F&=~((vv>-11)&(vv<-4))
    for c in comps(mx(F,3)):
        if (c&F).sum()>40: cs.append(c&F)
    if not cs: return None
    # Pieces: the pocket, and a ticket pocket above it where there is one
    # (everything above the line the other side's pocket starts at).
    groups=[cs]
    if split is not None:
        ysp,ksp=split; tk=[];mainp=[]
        dimg=dist
        for c in cs:
            ys,xs=np.where(c); v=np.median(ys+wy-(ysp+ksp*(dimg[ys,xs]-98)))
            (tk if v<-7 else mainp).append(c)
        groups=[g for g in (tk,mainp) if g]
    pieces=[]
    for g in groups:
        Fg=np.zeros(F.shape,bool)
        for c in g: Fg|=c
        sh=shape_of(straighten(Fg.astype(np.float32),edge,sgn)>0.5)
        if sh is not None: pieces.append(sh)
    if not pieces: return None
    Ss=straighten(Rn,edge,sgn); sol=straighten(solid.astype(np.float32),edge,sgn)>0.99
    Mall=np.zeros(Ss.shape,bool); out=[]
    for sh in pieces: Mall|=zone_mask(Ss.shape,sh,12,20,18)
    dd=np.arange(Ss.shape[1])-D0
    plain=sol&~Mall&(dd[None,:]>=RIM)
    base=blur(inpaint(Ss,~plain,plain),3)
    Pall=Ss/np.maximum(base,1e-3)
    for sh in pieces:
        Mz=zone_mask(Ss.shape,sh,9,17,15)
        wM=np.clip(blur(Mz.astype(np.float32),2.5)*1.25-0.125,0,1)
        Ps=1+(Pall-1)*wM
        As=zone_mask(Ss.shape,sh,0,0,0).astype(np.float32)
        # the last px to the outline and past it: as it is RIM px inside, along the top edge
        # Beside the outline only the pocket's own dark lines count (the
        # side's shading and the outline's rim are the jacket's, not the pocket's).
        dk=np.maximum(blur1(Ps,9,0)-Ps,0); cl=1-dk*np.clip((dk-0.05)/0.08,0,1)
        wr=np.clip((dd[None,:]-RIM)/16.0,0,1); wr=wr*wr*(3-2*wr)
        wT=np.clip(blur(zone_mask(Ss.shape,sh,3,6,15).astype(np.float32),1.5),0,1)
        cl=1+(cl-1)*wT
        Ps=cl+(Ps-cl)*wr
        k=sh['k']; c0=RIM+D0
        for c in range(0,c0):
            s=int(round(k*(c0-c)))
            Ps[:,c]=np.roll(Ps[:,c0],-s); As[:,c]=np.roll(As[:,c0],-s)
        P=unstraighten(Ps,edge,sgn,W); A=unstraighten(blur(As,1.2),edge,sgn,W)
        far=(dist>DMAX-2)|(dist<-D0+1); P[far]=1; A[far]=0
        ch=(np.abs(P-1)>0.015)|(A>0.05)
        ys,xs=np.where(ch); bx=(max(0,xs.min()-3),max(0,ys.min()-3),min(W,xs.max()+4),min(H,ys.max()+4))
        ym=(bx[1]+bx[3])//2
        out.append(dict(box=(int(bx[0]+wx),int(bx[1]+wy),int(bx[2]+wx),int(bx[3]+wy)),P=P[bx[1]:bx[3],bx[0]:bx[2]].astype(np.float32),A=A[bx[1]:bx[3],bx[0]:bx[2]].astype(np.float32),
                        edge=float(edge[ym]+wx),ymid=int(ym+wy),tband=float(sh['T'][98+D0]+wy),k=sh['k'],kb=sh['kb'],dend=sh['dend']))
    return out


def runs(row):
    xs = np.where(row)[0]; out = []; s = p = xs[0]
    for x in xs[1:]:
        if x != p + 1: out.append((s, p)); s = x
        p = x
    out.append((s, p)); return [r for r in out if r[1] - r[0] > 8]


def body_rows(a):
    """The body's two edges on a few rows (sleeve | body | sleeve) and the hem's row."""
    pts = []
    for y in range(880, 1221, 20):
        r = runs(a[y] < 150)
        if len(r) == 3: pts.append((y, r[1][0], r[1][1]))
    hem = np.where((a[:, 300:800] < 150).any(1))[0][-1]
    return pts, hem


def register(a, clean_rows, clean_hem):
    """Photo px to the clean notch photo's px: x' = sx * x + bx, y' = sx * y + by."""
    pts, hem = body_rows(a); cd = dict((y, (l, r)) for y, l, r in clean_rows)
    X = []; Y = []
    for y, l, r in pts:
        if y in cd: X += [l, r]; Y += [cd[y][0], cd[y][1]]
    sx, bx = np.polyfit(X, Y, 1)
    return float(sx), float(bx), float(clean_hem - sx * hem)


# ---- Chest pockets ---------------------------------------------------------
# One photo per chest pocket style, and the same jacket without a chest
# pocket (PLAIN): the pocket is the photo against that one, in a picture
# straightened along the lapel's edge, with what is left of the difference
# between the two photos smoothed out across the pocket.
CHEST = {'welt': ('00-flap-flapticket-chestwelt', (690, 370, 880, 450)), 'boat': ('04-jetted-slitticket-chestboat', (690, 360, 890, 460)),
         'slit': ('05-singlewelt-chestslit', (690, 375, 880, 430)), 'patch': ('03-jetted-chestpatch', (690, 370, 880, 590))}
PLAIN = '07-slantedflap'
CY0, CY1 = 300, 660; DA = 40; DB = 300; RIMC = 10
COUT = os.path.join(ROOT, 'assets', 'jacket-pocket-chest-')


def lapel_edge(R, y0=330, y1=640, xa=600, xb=830):
    """The lapel's edge beside the chest pocket: x per row (a smooth curve)."""
    Hx = R / blur1(R, 5, 1) - 1
    ys = np.arange(y0, y1); xs = np.array([xa + int(np.argmin(Hx[y, xa:xb])) for y in ys], float)
    best = None; rng = np.random.RandomState(2)
    for _ in range(3000):
        i, j = rng.choice(len(ys), 2, replace=False)
        if abs(ys[i] - ys[j]) < 60: continue
        k = (xs[j] - xs[i]) / (ys[j] - ys[i]); sc = (np.abs(xs - (xs[i] + k * (ys - ys[i]))) < 6).sum()
        if best is None or sc > best[0]: best = (sc, k, xs[i] - k * ys[i])
    _, k, b = best; ok = np.abs(xs - (k * ys + b)) < 6
    c = np.polyfit(ys[ok], xs[ok], 2); ok = np.abs(xs - np.polyval(c, ys)) < 3
    return np.polyfit(ys[ok], xs[ok], 2)


def seam_line(R):
    """The armhole seam on the pocket's other side."""
    Hx = R / blur1(R, 4, 1) - 1; ys = np.arange(330, 640); xs = []
    for y in ys:
        p = int(round(906 - 0.157 * (y - 340))); xs.append(p - 12 + int(np.argmin(Hx[y, p - 12:p + 13])))
    xs = np.array(xs, float); c = np.polyfit(ys, xs, 2)
    for _ in range(3):
        ok = np.abs(xs - np.polyval(c, ys)) < 3; c = np.polyfit(ys[ok], xs[ok], 2)
    return c


def cstraight(img, edge):
    xs = np.arange(img.shape[1]); dd = np.arange(-DA, DB)
    return np.stack([np.interp(edge[i] + dd, xs, img[i]) for i in range(img.shape[0])]).astype(np.float32)


def cunstraight(Sx, edge, W):
    xs = np.arange(W); dd = np.arange(-DA, DB)
    return np.stack([np.interp(xs - edge[i], dd, Sx[i]) for i in range(Sx.shape[0])]).astype(np.float32)


def colfill(Ss, plain):
    out = Ss.copy(); r = np.arange(Ss.shape[0])
    for q in range(Ss.shape[1]):
        p = plain[:, q]
        if p.sum() > 3: out[:, q] = np.where(p, Ss[:, q], np.interp(r, r[p], Ss[p, q]))
    return out


def chest_prep(R):
    f, resp, _ = dart_line(R, 'R'); R = no_dart(R, f, resp, 470, 720)
    ys = np.arange(CY0, CY1)
    return R[CY0:CY1], np.polyval(lapel_edge(R), ys).astype(np.float32), np.polyval(seam_line(R), ys).astype(np.float32)


def chest(kind, R, al, Rp, thr=0.03):
    n, (bx0, by0, bx1, by1) = CHEST[kind]
    Rw, edge, seam = chest_prep(R); Pw, pedge, _ = chest_prep(Rp)
    aw = al[CY0:CY1]; H, W = Rw.shape
    xs = np.arange(W); dist = xs[None, :] - edge[:, None]
    Z = np.zeros(Rw.shape, bool); Z[by0 - CY0:by1 - CY0, bx0:bx1] = True
    hp = Rw / np.maximum(blur(Rw, 3), 1e-3)
    F = (np.abs(hp - 1) > thr) & (dist >= 10) & Z & (xs[None, :] < seam[:, None] - 16)      # the pocket's own thin lines
    F &= mx(blur(F.astype(np.float32), 3) > 0.10, 5)
    keep = np.zeros(F.shape, bool)
    for cc in comps(mx(F, 7)):
        if (cc & F).sum() > 80: keep |= cc
    F &= keep
    Fs = cstraight(F.astype(np.float32), edge) > 0.5
    D = Fs.shape[1]; cols = np.where(Fs.sum(0) >= 2)[0]
    top = np.array([np.argmax(Fs[:, q]) for q in cols], float); bot = np.array([H - 1 - np.argmax(Fs[::-1, q]) for q in cols], float)
    full = np.arange(cols.min(), cols.max() + 1)
    T = np.full(D, np.nan); B = np.full(D, np.nan)
    T[full] = np.interp(full, cols, medfilt(top, 7)); B[full] = np.interp(full, cols, medfilt(bot, 7))
    c1 = int(cols.min()); m = slice(c1, c1 + 40)
    kt = theil(np.arange(c1, c1 + 40), T[m]); kb = theil(np.arange(c1, c1 + 40), B[m])
    if kind == 'patch': kb = kt
    i = np.arange(c1); T[:c1] = np.median(T[c1:c1 + 6]) + kt * (i - c1 - 2.5); B[:c1] = np.median(B[c1:c1 + 6]) + kb * (i - c1 - 2.5)
    c2 = int(cols.max()); T[c2 + 1:] = T[c2]; B[c2 + 1:] = B[c2]

    def zone(mt, mb, mo):
        z = np.zeros((H, D), bool)
        for q in range(0, min(D, c2 + mo + 1)):
            z[max(0, int(round(T[q] - mt))):min(H, int(round(B[q] + mb)) + 1), q] = True
        return z
    Ss = cstraight(Rw, edge) / np.maximum(cstraight(Pw, pedge), 1e-3)
    sol = cstraight((aw > 0.97).astype(np.float32), edge) > 0.99
    dd = np.arange(D) - DA
    lf = cstraight((xs[None, :] < seam[:, None] - 5).astype(np.float32), edge) > 0.99
    lf2 = cstraight((xs[None, :] < seam[:, None] - 9).astype(np.float32), edge) > 0.99
    plain = sol & ~zone(11, 11, 12) & (dd[None, :] >= RIMC - 2) & lf2
    pp = inpaint(Ss, ~plain, plain); cf = colfill(Ss, plain)
    wb = np.clip((dd - 20) / 30.0, 0, 1)[None, :]
    base = blur(cf + (pp - cf) * wb, 3)
    wM = np.clip(blur((zone(8, 8, 9) & lf).astype(np.float32), 2.5) * 1.25 - 0.125, 0, 1)
    Ps = 1 + (Ss / np.maximum(base, 1e-3) - 1) * wM
    c0 = RIMC + DA
    if kind == 'patch':                    # the patch ends at the lapel's edge
        Ps = 1 + (Ps - 1) * np.clip((dd - 4) / 6.0, 0, 1)[None, :]
    else:                                  # the others run on under the lapel, along their own top edge
        r = np.arange(H, dtype=float)
        for q in range(0, c0): Ps[:, q] = np.interp(r + kt * (c0 - q), r, Ps[:, c0])
    P = cunstraight(Ps, edge, W)
    P[(dist > DB - 2) | (dist < -DA + 1)] = 1
    yy, xx = np.where(np.abs(P - 1) > 0.015); box = (xx.min() - 3, yy.min() - 3, xx.max() + 4, yy.max() + 4)
    ym = (box[1] + box[3]) // 2
    return dict(P=P[box[1]:box[3], box[0]:box[2]], box=(int(box[0]), int(box[1] + CY0), int(box[2]), int(box[3] + CY0)), edge=float(edge[ym]), ymid=int(ym + CY0))


def chest_main(check, crows, chem):
    def load(n):
        L = np.asarray(Image.open(SRC + n + '.webp').convert('L')).astype(np.float32)
        al = np.clip((150 - blur(L, 1.0)) / 50, 0, 1)
        return L, al, shade_map(L, al, float(np.median(L[al > 0.99]))).astype(np.float32)
    Rp = load(PLAIN)[2]; meta = {}
    for kind in CHEST:
        L, al, R = load(CHEST[kind][0])
        sx, bx, by = register(L, crows, chem); K = S * sx
        r = chest(kind, R, al, Rp); P = r['P']; h, w = P.shape; X0, Y0, X1, Y1 = r['box']
        im = np.zeros((2 * h, w, 4), np.uint8); im[h:, :, :3] = 255
        D = 1 - np.minimum(P, 1); U = 0.6 * (1 - np.exp(-np.maximum(P - 1, 0) / 0.6))
        im[:h, :, 3] = np.clip(D * 255 + 0.5, 0, 255).astype(np.uint8); im[h:, :, 3] = np.clip(U * 3 * 255 + 0.5, 0, 255).astype(np.uint8)
        Image.fromarray(im, 'RGBA').save(COUT + kind + '.webp', lossless=True, quality=100, method=6, exact=True)
        meta[kind] = {'src': './assets/jacket-pocket-chest-%s.webp?v=1' % kind, 'w': w, 'h': h, 'k': round(K, 4), 'x': round((X0 - r['edge']) * K, 1),
                      'y': round((sx * Y0 + by) * S + OY, 1), 'ay': round((sx * r['ymid'] + by) * S + OY, 1)}
        print('chest', kind, json.dumps(meta[kind], separators=(',', ':')), 'edge at ay (picture x):', round((sx * r['edge'] + bx - 556.3) * S + 400, 1), flush=True)
        if check: Image.fromarray((np.clip((P - 0.4) / 1.0, 0, 1) * 255).astype(np.uint8)).save(os.path.join(check, 'pocket-chest-%s.png' % kind))
    if check: json.dump(meta, open(os.path.join(check, 'pocket_chest_meta.json'), 'w'))


def main():
    check = next((a for a in _args if not a.startswith('--')), None)
    clean = np.asarray(Image.open(CLEAN).convert('L')).astype(np.float32)
    crows, chem = body_rows(clean)
    chest_main(check, crows, chem)
    if '--chest' in _args: return
    meta = {}
    for n in sorted(SLUG):
        L = np.asarray(Image.open(SRC + n + '.webp').convert('L')).astype(np.float32)
        sx, bx, by = register(L, crows, chem); K = S * sx
        al = np.clip((150 - blur(L, 1.0)) / 50, 0, 1)
        R = shade_map(L, al, float(np.median(L[al > 0.99]))).astype(np.float32)
        body = body_of(al); res = {}
        for side in 'RL':
            sp = (res['R'][0]['tband'], res['R'][0]['k']) if (side == 'L' and 'ticket' in n) else None
            res[side] = lower(n, side, R, al, holes=HOLES.get((n, side), ()), split=sp, body=body)
        sides = {}
        for side in 'LR':
            ps = res[side]
            X0 = min(p['box'][0] for p in ps); Y0 = min(p['box'][1] for p in ps); X1 = max(p['box'][2] for p in ps); Y1 = max(p['box'][3] for p in ps)
            P = np.ones((Y1 - Y0, X1 - X0), np.float32)
            for p in ps:                       # a ticket pocket and the pocket under it share one picture
                x0, y0, x1, y1 = p['box']; sl = (slice(y0 - Y0, y1 - Y0), slice(x0 - X0, x1 - X0))
                cur = P[sl]; P[sl] = np.where(np.abs(p['P'] - 1) > np.abs(cur - 1), p['P'], cur)
            mainp = max(ps, key=lambda p: p['box'][3])      # the pocket itself (the lower piece) hangs the pair
            sides[side] = dict(P=P, box=(X0, Y0, X1, Y1), edge=mainp['edge'], ymid=mainp['ymid'], dend=max(p['dend'] for p in ps))
        cw = max(s['P'].shape[1] for s in sides.values()); ch = max(s['P'].shape[0] for s in sides.values())
        im = np.zeros((2 * ch, 2 * cw, 4), np.uint8); im[ch:, :, :3] = 255
        m = {'src': './assets/jacket-pocket-lower-%s.webp?v=1' % SLUG[n], 'cw': cw, 'ch': ch, 'k': round(K, 4)}
        for i, side in enumerate('LR'):
            s = sides[side]; P = s['P']; h, w = P.shape; X0, Y0, X1, Y1 = s['box']
            D = 1 - np.minimum(P, 1); hi = np.maximum(P - 1, 0); U = 0.6 * (1 - np.exp(-hi / 0.6))
            im[:h, i * cw:i * cw + w, 3] = np.clip(D * 255 + 0.5, 0, 255).astype(np.uint8)
            im[ch:ch + h, i * cw:i * cw + w, 3] = np.clip(U * 3 * 255 + 0.5, 0, 255).astype(np.uint8)
            m[side] = {'w': w, 'h': h, 'x': round(((X0 if side == 'L' else X1) - s['edge']) * K, 1), 'y': round((sx * Y0 + by) * S + OY, 1),
                       'ay': round((sx * s['ymid'] + by) * S + OY, 1), 'in': round(s['dend'] * K, 1)}
            for hx, hy, hr in HOLES.get((n, side), ()):
                m[side]['btn'] = [round((hx - s['edge']) * K, 1), round((sx * hy + by) * S + OY, 1)]
        Image.fromarray(im, 'RGBA').save(OUT + SLUG[n] + '.webp', lossless=True, quality=100, method=6, exact=True)
        meta[n] = m; print(n, json.dumps(m, separators=(',', ':')), flush=True)
        if check:
            for side in 'LR':
                v = np.clip((sides[side]['P'] - 0.4) / 1.0, 0, 1) * 255
                Image.fromarray(v.astype(np.uint8)).save(os.path.join(check, 'pocket-%s-%s.png' % (SLUG[n], side)))
    if check: json.dump(meta, open(os.path.join(check, 'pocket_meta.json'), 'w'))


if __name__ == '__main__':
    main()

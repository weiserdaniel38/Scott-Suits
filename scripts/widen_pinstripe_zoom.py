# Makes assets/fabric-zoom-wide-<code>.avif for every Pinstripe fabric in catalog.js:
# the real zoom photo, lighting evened out, repeated seamlessly at its own stripe
# spacing so the close-up shows 2x the cloth width. Run from the repo root:
#   python3 scripts/widen_pinstripe_zoom.py <outdir> 2 [code,code]  then re-save at quality 58
# Reads the ORIGINAL fabric-zoom-<code>.avif, so point catalog.js at the originals first.
import re, sys, json, numpy as np
from PIL import Image, ImageFilter
OUT=sys.argv[1]; FACT=float(sys.argv[2]) if len(sys.argv)>2 else 2.0
only=sys.argv[3].split(',') if len(sys.argv)>3 else None
src=open('catalog.js').read()
ps=re.findall(r'\{ name: "([^"]+)", displayName: "([^"]+)", img: "([^"]+)"[^}]*pattern: "Pinstripe"',src)
zm=dict(re.findall(r'"([^"]+)": \{ sprite: "([^"]+)"',src))
def blur(a,s): return np.asarray(Image.fromarray(np.clip(a,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(s)),float)
def hp(a): return a-blur(a,25)
def ncc(A,B): return (A*B).mean()/np.sqrt((A*A).mean()*(B*B).mean()+1e-9)
F=24; M=120
def calm(prof,lag,n):
  sm=np.convolve(prof,np.ones(21)/21,'same')
  return min(range(30,n-lag-30),key=lambda x: sm[x]+sm[x+lag])
report={}
for n,dn,_ in ps:
  code=zm[n].split('fabric-zoom-')[1].split('.avif')[0]
  if only and code not in only: continue
  a=np.asarray(Image.open(zm[n][2:]).convert('RGB'),float)
  Lr=a.mean(2); a=np.clip(a*(Lr.mean()/np.maximum(blur(Lr,140),1))[:,:,None],0,255)
  H,W=Lr.shape; g=hp(a.mean(2))
  prof=g.mean(0)
  best=max(((ncc(prof[:W-d],prof[d:]),d) for d in range(500,1120)))
  ch,dx=best
  T=int(1200*FACT); TW=T+2*M+400
  x0=calm(np.abs(g).mean(0),dx,W)
  per=a[:,x0:x0+dx+F]
  reps=int(np.ceil(TW/dx))+1
  w1=np.zeros((H,reps*dx+F,3)); w=np.linspace(0,1,F)[None,:,None]
  for k in range(reps):
    s=k*dx; seg=per.copy()
    if k: seg[:,:F]=w1[:,s:s+F]*(1-w)+seg[:,:F]*w
    w1[:,s:s+dx+F]=seg
  w1=w1[:,:TW]
  g2=hp(w1.mean(2))
  # vertical period with sideways shift (stripes lean a little)
  g4=g2[::4,::4]; m4=M//4
  bestv=(-9,0,0)
  for d in range(125,280):
    for sx in range(-10,11):
      A=g4[:g4.shape[0]-d, m4:-m4]; B=g4[d:, m4+sx:g4.shape[1]-m4+sx]
      c=ncc(A,B)
      if c>bestv[0]: bestv=(c,d*4,sx*4)
  _,d0,s0=bestv; bestv=(-9,0,0)
  for d in range(d0-4,d0+5):
    for sx in range(s0-4,s0+5):
      A=g2[:H-d, M:-M]; B=g2[d:, M+sx:TW-M+sx]
      c=ncc(A,B)
      if c>bestv[0]: bestv=(c,d,sx)
  cv,dy,sx=bestv
  y0=calm(np.abs(g2).mean(1),dy,H)
  per=w1[y0:y0+dy+F]
  reps=int(np.ceil(T/dy))+1
  out=np.zeros((reps*dy+F,TW,3)); wv=np.linspace(0,1,F)[:,None,None]
  for k in range(reps):
    s=k*dy; seg=np.roll(per,k*sx,axis=1)  # I(y+dy,x+sx)~I(y,x)
    if k: seg[:F]=out[s:s+F]*(1-wv)+seg[:F]*wv
    out[s:s+dy+F]=seg
  cx=(TW-T)//2
  out=out[:T,cx:cx+T]
  img=Image.fromarray(np.clip(out,0,255).astype(np.uint8)).resize((1200,1200),Image.LANCZOS)
  img.save(f'{OUT}/fabric-zoom-wide-{code}.avif',quality=72)
  img.resize((300,300)).save(f'{OUT}/prev-{code}.jpg',quality=85)
  report[n]=dict(dn=dn,code=code,dx=int(dx),ch=round(float(ch),2),dy=int(dy),sx=int(sx),cv=round(float(cv),2))
  print(report[n],flush=True)
json.dump(report,open(f'{OUT}/report.json','w'),indent=1)

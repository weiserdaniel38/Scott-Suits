"""Builds the "Start Designing" curtain reveal (assets/curtain/) from Daniel's
scott_suits_natural_curtain_reveal.mov (2026-10-27).

The source video ends on a baked-in phone screenshot of "What are we
building?", so instead of playing it as-is we cut a matte: a pixel counts as
revealed once it matches the final frame for the rest of the clip. The output
frames put the colour on the left half and the matte (white = curtain) on the
right half; main.js draws them through WebGL so the real page shows through.

  mkdir work/fr && ffmpeg -i reveal.mov work/fr/%03d.png
  python3 scripts/curtain_reveal_matte.py work
  ffmpeg -framerate 30 -i work/out/%03d.png -c:v libx264 -preset veryslow -crf 24 \
    -pix_fmt yuv420p -movflags +faststart -an assets/curtain/curtain-reveal.mp4
  ffmpeg -framerate 30 -i work/out/%03d.png -c:v libvpx-vp9 -crf 34 -b:v 0 \
    -pix_fmt yuv420p -an assets/curtain/curtain-reveal.webm
  ffmpeg -i work/fr/001.png -q:v 4 assets/curtain/curtain-poster.jpg
"""
import sys,glob,os,numpy as np
from PIL import Image, ImageFilter
d=sys.argv[1]; N=58; BAND=96
allf=sorted(glob.glob(d+'/fr/*.png'))
def load(p):
    a=np.asarray(Image.open(p).convert('RGB')).astype(np.int16).copy()
    a[:BAND]=a[BAND]; return a
fr=[load(p) for p in allf[:N]]
last=load(allf[-1])
def morph(m,fn,k): return np.asarray(Image.fromarray(m.astype(np.uint8)*255).filter(fn(k)))>127
rev=np.ones(last.shape[:2],bool); masks=[None]*N
for t in range(N-1,-1,-1):
    diff=np.abs(fr[t]-last).max(axis=2)
    rev=rev&(diff<10)
    masks[t]=rev.copy()
os.makedirs(d+'/out',exist_ok=True)
for f in glob.glob(d+'/out/*.png'): os.remove(f)
cov=[]
for t in range(N):
    r=masks[t]
    r=morph(morph(r,ImageFilter.MinFilter,9),ImageFilter.MaxFilter,9)   # drop small revealed specks
    r=morph(morph(r,ImageFilter.MaxFilter,9),ImageFilter.MinFilter,9)   # drop small opaque specks
    if t<=19: r[:]=False
    if t==N-1: r[:]=True
    A=np.asarray(Image.fromarray(((~r)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)))
    cov.append(round(float(A.mean()/255),3))
    c=fr[t].astype(np.uint8)
    out=np.zeros((c.shape[0],c.shape[1]*2,3),np.uint8)
    out[:,:c.shape[1]]=c; out[:,c.shape[1]:]=A[:,:,None]
    Image.fromarray(out).save(d+'/out/%03d.png'%t)
print(cov)

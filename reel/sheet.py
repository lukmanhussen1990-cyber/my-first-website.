import sys,glob,os
from PIL import Image, ImageDraw
d=sys.argv[1]; fs=sorted(glob.glob(os.path.join(d,'f*.jpg'))); cols=int(sys.argv[3]) if len(sys.argv)>3 else 6
w,h=270,480; rows=(len(fs)+cols-1)//cols
s=Image.new('RGB',(cols*w,rows*h),'black'); dr=ImageDraw.Draw(s)
for i,f in enumerate(fs):
    s.paste(Image.open(f).resize((w,h)),((i%cols)*w,(i//cols)*h)); fr=int(os.path.basename(f)[1:5]); dr.text(((i%cols)*w+4,(i//cols)*h+4),f"{fr} {fr/60:.2f}s",fill='yellow')
s.save(sys.argv[2],quality=88)

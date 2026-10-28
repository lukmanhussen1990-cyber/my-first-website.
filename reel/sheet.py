import sys, glob
from PIL import Image
d=sys.argv[1]; fs=sorted(glob.glob(d+'/t_*.png'))
n=int(sys.argv[2]) if len(sys.argv)>2 else 4
ims=[Image.open(f).resize((432,768)) for f in fs]
rows=(len(ims)+n-1)//n
sheet=Image.new('RGB',(432*n,768*rows))
for i,im in enumerate(ims): sheet.paste(im,(432*(i%n),768*(i//n)))
sheet.save(d+'/sheet.png')

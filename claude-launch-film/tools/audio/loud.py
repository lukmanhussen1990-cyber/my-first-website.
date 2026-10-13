import sys,os,json,numpy as np, scipy.signal as ss
sys.path.insert(0,os.path.dirname(__file__)); from common import *
v,a,m=stems()
sos=ss.butter(4,[100,5000],btype='band',fs=SR,output='sos')
def act_db(x):
    x=ss.sosfiltfilt(sos,x.mean(1)); fr=int(0.02*SR); e=np.array([np.mean(x[k:k+fr]**2) for k in range(0,len(x)-fr,fr//2)])
    sel=e>e.max()*10**(-20/10); return 10*np.log10(e[sel].mean()), sel.sum()*0.01
def gain_for(name,kw):
    j=json.load(open(f'{D}/gen/{name}.json')); s,e=j['span']
    newv,_=build_vocal(name,name[:2],**kw)
    lo,do=act_db(v[int(s*SR):int(e*SR)]); ln,dn=act_db(newv[int(s*SR):int(e*SR)])
    return lo-ln, lo, ln, do, dn
if __name__=='__main__':
    for n in sys.argv[1:]:
        kw={'align_onset':True} if n[:2]!='o2' else {}
        g,lo,ln,do,dn=gain_for(n,kw); print(n,'orig',round(lo,1),'new',round(ln,1),'gain',round(g,1),'active dur',round(do,2),round(dn,2))

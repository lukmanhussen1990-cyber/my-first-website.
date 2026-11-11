import json, numpy as np, wave
w=wave.open("audio/vo16.wav"); a=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(np.float32)/32768
sr=16000; hop=sr//100
env=np.array([np.sqrt(np.mean(a[i:i+hop]**2)) for i in range(0,len(a)-hop,hop)])
env=np.clip(env/np.percentile(env,97),0,1)
words=json.load(open("audio/words.json"))
# who, clipA, clipB, timeline start
L=[("son",0.00,3.30,0.40),("dad",3.40,5.55,4.20),("nar",5.75,8.05,7.00),("od",8.25,9.20,9.95),
   ("dad",9.25,10.70,11.00),("son",10.78,11.80,14.00),("od",11.88,12.83,16.55),("dad",12.90,16.25,17.60),
   ("box",16.33,17.25,21.15),("son",17.32,18.95,22.25),("nar",19.10,20.85,24.35)]
SCRIPT=["Hey Dad! Come to my first boxing match… it's TOMORROW!","I wouldn't miss it for the world… champ.","He would, in fact, want to miss it.","Which kid's yours?","Oh, you'll know him when you see him.","HEY DADDY!! 👋","…That's your kid?","No. The big one. With the gloves. Him. That's my boy.","Who are you?","DADDY, DID YOU SEE MY TWIRL?!","He did not see the twirl."]
lines=[]
for who,a0,b0,st in L:
    ws=[dict(w=x["w"],t=round(st+(x["s"]-a0)+0.04,3)) for x in words if a0-0.12<=x["s"]<b0-0.12]
    toks=SCRIPT[len(lines)].split()
    if len(toks)==len(ws)+1: ws.append(dict(w="",t=ws[-1]["t"]+0.15))
    assert len(toks)==len(ws),(toks,ws)
    for k,tk in zip(ws,toks): k["w"]=tk
    lines.append(dict(who=who,a=a0,b=b0,start=st,end=round(st+b0-a0,3),words=ws))
json.dump(lines,open("lines.json","w"),indent=1)
open("web/data.js","w").write("window.DATA="+json.dumps(dict(lines=lines,env=[round(float(v),3) for v in env]))+";")
for l in lines: print(l["who"],l["start"],l["end"]," ".join(f'{w["w"]}@{w["t"]}' for w in l["words"]))

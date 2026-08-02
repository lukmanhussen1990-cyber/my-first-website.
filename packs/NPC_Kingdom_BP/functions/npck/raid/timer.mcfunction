execute if score #level npck.sys matches 2.. unless score #raidactive npck.sys matches 1 run scoreboard players add #raidt npck.sys 1
execute if score #raidactive npck.sys matches 1 run function npck/raid/check
execute unless score #raidactive npck.sys matches 1 if score #raidt npck.sys matches 200.. run function npck/raid/start
execute if score #raidt npck.sys matches 170 run tellraw @a[r=96] {"rawtext":[{"text":"\u00a7e[Scouts] \u00a7fDust on the horizon... an attack may be coming."}]}

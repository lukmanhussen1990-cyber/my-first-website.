execute if score #raidactive npck.sys matches 1 run tellraw @a[r=24] {"rawtext":[{"text":"\u00a7c[War] \u00a7fYour kingdom is already under attack!"}]}
execute unless score #raidactive npck.sys matches 1 run function npck/raid/declare_go

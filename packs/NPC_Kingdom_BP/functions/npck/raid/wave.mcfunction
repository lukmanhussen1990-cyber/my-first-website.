summon npck:bandit ~ ~3 ~
summon npck:bandit ~3 ~3 ~2
summon npck:bandit ~-3 ~3 ~-2
execute if score #level npck.sys matches 3.. run function npck/raid/wave3
execute if score #level npck.sys matches 4.. run function npck/raid/wave4
execute if score #level npck.sys matches 5 run function npck/raid/wave5
execute if score #bossdue npck.sys matches 0 if score #level npck.sys matches 3.. run function npck/raid/boss

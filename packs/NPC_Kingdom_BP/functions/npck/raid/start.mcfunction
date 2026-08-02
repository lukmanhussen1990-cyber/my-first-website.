scoreboard players set #raidt npck.sys 0
scoreboard players set #raidlen npck.sys 0
scoreboard players set #raidactive npck.sys 1
scoreboard players add #wave npck.sys 1
scoreboard players operation #dir npck.sys = #wave npck.sys
scoreboard players operation #dir npck.sys %= #c4 npck.sys
scoreboard players operation #bossdue npck.sys = #wave npck.sys
scoreboard players operation #bossdue npck.sys %= #c3 npck.sys
titleraw @a title {"rawtext":[{"text":"\u00a74\u00a7lTHE KINGDOM IS UNDER ATTACK!"}]}
tellraw @a {"rawtext":[{"text":"\u00a74\u00a7l[WAR] \u00a7r\u00a7cEnemy army approaching!"}]}
playsound mob.wither.spawn @a[r=96] ~ ~ ~ 0.7
execute if score #dir npck.sys matches 0 run tellraw @a {"rawtext":[{"text":"\u00a7c[WAR] \u00a7fDefend the northern gate!"}]}
execute if score #dir npck.sys matches 1 run tellraw @a {"rawtext":[{"text":"\u00a7c[WAR] \u00a7fDefend the eastern gate!"}]}
execute if score #dir npck.sys matches 2 run tellraw @a {"rawtext":[{"text":"\u00a7c[WAR] \u00a7fDefend the southern gate!"}]}
execute if score #dir npck.sys matches 3 run tellraw @a {"rawtext":[{"text":"\u00a7c[WAR] \u00a7fDefend the western gate!"}]}
execute as @e[family=npck_soldier,r=96] run scoreboard players set @s npck.order 4
execute as @e[family=npck_soldier,r=96] at @s run function npck/orders/apply_silent
execute as @e[family=npck_worker,r=96] run scoreboard players set @s npck.order 6
execute as @e[family=npck_worker,r=96] at @s run function npck/orders/apply_silent
execute if score #dir npck.sys matches 0 positioned ~ ~ ~-44 run function npck/raid/wave
execute if score #dir npck.sys matches 1 positioned ~44 ~ ~ run function npck/raid/wave
execute if score #dir npck.sys matches 2 positioned ~ ~ ~44 run function npck/raid/wave
execute if score #dir npck.sys matches 3 positioned ~-44 ~ ~ run function npck/raid/wave

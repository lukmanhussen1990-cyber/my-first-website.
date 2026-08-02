tellraw @a {"rawtext":[{"text":"\u00a74\u00a7l[WAR] \u00a7r\u00a7eYou have declared war on the enemy camp!"}]}
titleraw @a title {"rawtext":[{"text":"\u00a76\u00a7lWAR DECLARED"}]}
playsound mob.wither.spawn @a ~ ~ ~ 0.8
scoreboard players set #raidactive npck.sys 1
scoreboard players set #raidlen npck.sys 0
scoreboard players add #wave npck.sys 1
execute positioned ~ ~-1 ~70 run function npck/struct/bandit_camp
execute positioned ~ ~ ~70 run function npck/raid/camp_force
tellraw @a {"rawtext":[{"text":"\u00a7e[War] \u00a7fAn enemy camp stands \u00a7c70 blocks south\u00a7f. Lead your army!"}]}
execute as @e[family=npck_soldier,r=96] run scoreboard players set @s npck.order 1
execute as @e[family=npck_soldier,r=96] at @s run function npck/orders/apply_silent

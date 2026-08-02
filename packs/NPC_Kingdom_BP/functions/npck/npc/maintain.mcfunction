# stragglers, lava and stuck pathing - all resolved from the core
execute as @e[family=npck,r=200,rm=90,scores={npck.order=!1}] at @s run tag @s add npck_recall
execute as @e[family=npck,r=200] at @s if block ~ ~ ~ lava run tag @s add npck_recall
execute as @e[family=npck,r=200] at @s if block ~ ~ ~ flowing_lava run tag @s add npck_recall
execute as @e[family=npck,r=200] at @s if block ~ ~ ~ fire run tag @s add npck_recall
tp @e[family=npck,tag=npck_recall] ~ ~1 ~
effect @e[family=npck,tag=npck_recall] fire_resistance 6 0 true
tag @e[family=npck,tag=npck_recall] remove npck_recall
execute as @e[family=npck_recruited,r=96] unless score @s npck.rec matches 1 run function npck/npc/recruited
# soldiers react to danger without being told
execute as @e[family=npck_soldier,r=80,scores={npck.order=0}] at @s if entity @e[family=npck_enemy,r=16] run function npck/npc/alert
execute as @e[family=npck_soldier,r=80,scores={npck.order=0}] at @s if entity @e[family=monster,r=16] run function npck/npc/alert
execute as @e[family=npck_soldier,r=80,scores={npck.order=4},tag=npck_alerted] at @s unless entity @e[family=npck_enemy,r=28] unless entity @e[family=monster,r=28] run function npck/npc/stand_down

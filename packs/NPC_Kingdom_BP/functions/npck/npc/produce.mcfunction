scoreboard players set #jobt npck.sys 0
execute as @e[family=npck_farmer,r=72,scores={npck.order=0}] run scoreboard players add Food npck.res 3
execute as @e[family=npck_farmer,r=72,scores={npck.order=7}] run scoreboard players add Food npck.res 6
execute as @e[family=npck_lumberjack,r=72,scores={npck.order=0}] run scoreboard players add Wood npck.res 3
execute as @e[family=npck_lumberjack,r=72,scores={npck.order=7}] run scoreboard players add Wood npck.res 6
execute as @e[family=npck_miner,r=72,scores={npck.order=0}] run scoreboard players add Stone npck.res 3
execute as @e[family=npck_miner,r=72,scores={npck.order=7}] run scoreboard players add Stone npck.res 6
execute as @e[family=npck_miner,r=72,scores={npck.order=0}] run scoreboard players add Iron npck.res 1
execute as @e[family=npck_miner,r=72,scores={npck.order=7}] run scoreboard players add Iron npck.res 2
execute as @e[family=npck_builder,r=72,scores={npck.order=0}] run scoreboard players add Stone npck.res 1
execute as @e[family=npck_builder,r=72,scores={npck.order=7}] run scoreboard players add Stone npck.res 2
execute as @e[family=npck_blacksmith,r=72,scores={npck.order=0}] run scoreboard players add Iron npck.res 2
execute as @e[family=npck_blacksmith,r=72,scores={npck.order=7}] run scoreboard players add Iron npck.res 4
execute as @e[family=npck_merchant,r=72,scores={npck.order=0}] run scoreboard players add Emeralds npck.res 1
execute as @e[family=npck_merchant,r=72,scores={npck.order=7}] run scoreboard players add Emeralds npck.res 2
execute as @e[family=npck_advisor,r=72,scores={npck.order=0}] run scoreboard players add Gold npck.res 1
execute as @e[family=npck_advisor,r=72,scores={npck.order=7}] run scoreboard players add Gold npck.res 2
execute as @e[family=npck_lumberjack,r=72,scores={npck.order=!12}] at @s run function npck/npc/chop
execute as @e[family=npck_miner,r=72,scores={npck.order=!12}] at @s run function npck/npc/mine
execute as @e[family=npck_farmer,r=72,scores={npck.order=!12}] at @s run function npck/npc/farm
execute as @e[family=npck_builder,r=72,scores={npck.order=9}] run function npck/kingdom/repair_step
scoreboard players add #prodmsg npck.sys 1
execute if score #prodmsg npck.sys matches 12.. run function npck/npc/report

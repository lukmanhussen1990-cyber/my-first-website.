tellraw @a[r=96] {"rawtext":[{"text":"\u00a79[Kingdom] \u00a7fNight falls. The workers return to their homes."}]}
execute as @e[family=npck_worker,r=96,scores={npck.order=0}] run scoreboard players set @s npck.order 12
execute as @e[family=npck_worker,r=96,scores={npck.order=7}] run scoreboard players set @s npck.order 12
execute as @e[family=npck_civilian,r=96,scores={npck.order=0}] run scoreboard players set @s npck.order 12
execute as @e[family=npck_support,r=96,scores={npck.order=0}] run scoreboard players set @s npck.order 12
execute as @e[family=npck,scores={npck.order=12}] run event entity @s npck:order_sleep
tp @e[family=npck,r=96,rm=24,scores={npck.order=12}] ~ ~1 ~
execute as @e[family=npck_soldier,r=96,scores={npck.order=0}] run scoreboard players set @s npck.order 3
execute as @e[family=npck_soldier,scores={npck.order=3}] run event entity @s npck:order_patrol

scoreboard players set #clock npck.sys 0
# housekeeping that does not need the core's position
execute as @e[family=npck] unless score @s npck.order matches 0.. run function npck/npc/register
execute as @a at @s run tp @e[family=npck_recruited,scores={npck.order=1},rm=40] ~ ~1 ~
execute as @a at @s run tp @e[family=npck,scores={npck.order=1},rm=20] ~ ~1 ~
execute if score #celebt npck.sys matches 1.. run scoreboard players remove #celebt npck.sys 1
execute if score #celebt npck.sys matches 0 run function npck/kingdom/celebrate_end
execute as @e[type=npck:kingdom_core,tag=npck_init] at @s run function npck/sys/pulse

scoreboard players add #jobt npck.sys 1
execute if score #jobt npck.sys matches 5.. run function npck/npc/produce
execute as @e[family=npck_healer,r=80] at @s run function npck/npc/heal

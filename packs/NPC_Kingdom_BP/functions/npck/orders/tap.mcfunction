# the marker spawned on the NPC that was tapped; it is the nearest one
scoreboard players add @e[family=npck,c=1] npck.order 1
execute as @e[family=npck,c=1] run function npck/orders/wrap
execute as @e[family=npck,c=1] at @s run function npck/orders/apply

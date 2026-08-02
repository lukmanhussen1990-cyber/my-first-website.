scoreboard players set #celebt npck.sys -1
execute as @e[family=npck,scores={npck.order=11}] run scoreboard players set @s npck.order 0
execute as @e[family=npck,scores={npck.order=0}] at @s run function npck/orders/apply_silent
tellraw @a[r=64] {"rawtext":[{"text":"\u00a77[Kingdom] \u00a7fThe festivities end. Back to work!"}]}

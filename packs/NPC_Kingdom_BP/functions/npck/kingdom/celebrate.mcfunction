tellraw @a {"rawtext":[{"text":"\u00a76\u00a7l[KINGDOM] \u00a7r\u00a7eLet the celebration begin!"}]}
playsound firework.launch @a[r=64] ~ ~ ~
summon minecraft:fireworks_rocket ~2 ~2 ~2
summon minecraft:fireworks_rocket ~-2 ~2 ~-2
particle minecraft:totem_particle ~ ~2 ~
execute as @e[family=npck,r=64] run scoreboard players set @s npck.order 11
execute as @e[family=npck,r=64] at @s run function npck/orders/apply_silent
scoreboard players set #celebt npck.sys 15

scoreboard players operation #ord npck.sys = @e[family=npck,c=1] npck.order
execute as @e[family=npck,r=32] run scoreboard players operation @s npck.order = #ord npck.sys
execute as @e[family=npck,r=32] at @s run function npck/orders/apply_silent
playsound note.bell @a[r=32] ~ ~ ~
particle minecraft:villager_happy ~ ~1 ~
tellraw @a[r=32] {"rawtext":[{"text":"\u00a76[Kingdom] \u00a7fThe banner is raised - every citizen in range obeys the order."}]}

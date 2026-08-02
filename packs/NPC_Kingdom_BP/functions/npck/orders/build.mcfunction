execute as @e[family=npck,r=32] run scoreboard players set @s npck.order 8
execute as @e[family=npck,r=32] at @s run function npck/orders/apply_silent
execute at @s run playsound note.bell @a[r=16] ~ ~ ~
tellraw @a[r=32] {"rawtext":[{"text":"\u00a76[Kingdom] \u00a7fOrder issued to all nearby citizens: \u00a7eBuild"}]}

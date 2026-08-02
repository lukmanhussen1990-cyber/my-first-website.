tellraw @a[r=96] {"rawtext":[{"text":"\u00a7e[Kingdom] \u00a7fDawn breaks. \"Back to work for the kingdom!\""}]}
execute as @e[family=npck,scores={npck.order=12}] run scoreboard players set @s npck.order 0
execute as @e[family=npck,scores={npck.order=0}] run event entity @s npck:order_work
playsound random.orb @a[r=48] ~ ~ ~

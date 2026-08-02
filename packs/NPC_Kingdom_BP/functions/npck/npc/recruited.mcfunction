scoreboard players set @s npck.rec 1
execute at @s run particle minecraft:heart_particle ~ ~2 ~
execute at @s run playsound random.levelup @a[r=16] ~ ~ ~
tellraw @a[r=24] {"rawtext":[{"text":"\u00a7a[Kingdom] \u00a7fA citizen has sworn loyalty to the crown."}]}

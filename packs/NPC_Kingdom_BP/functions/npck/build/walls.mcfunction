scoreboard players add #buildq npck.sys 1
function npck/place/walls
tellraw @a[r=80] {"rawtext":[{"text":"\u00a76[Kingdom] \u00a7fThe builders have completed the \u00a7eDefensive Walls\u00a7f."}]}
playsound random.anvil_use @a[r=64] ~ ~ ~
execute as @e[family=npck_builder,r=48] at @s run particle minecraft:villager_happy ~ ~2 ~

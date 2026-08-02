tellraw @a[r=48] {"rawtext":[{"text":"\u00a7c[Kingdom] \u00a7fYour realm already has a Kingdom Core. Only one may stand."}]}
particle minecraft:large_explosion ~ ~1 ~
playsound random.fizz @a[r=16] ~ ~ ~
give @p[r=16] npck:kingdom_core 1
kill @s

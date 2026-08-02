scoreboard players remove Wood npck.res 320
scoreboard players remove Stone npck.res 256
scoreboard players remove Food npck.res 192
scoreboard players remove Iron npck.res 64
scoreboard players remove Gold npck.res 24
scoreboard players remove Emeralds npck.res 8
scoreboard players set #level npck.sys 4
titleraw @a title {"rawtext":[{"text":"\u00a76\u00a7lCITY"}]}
tellraw @a {"rawtext":[{"text":"\u00a76\u00a7l[KINGDOM] \u00a7r\u00a7aYour Town has grown into a \u00a7eCITY\u00a7a!"}]}
tellraw @a {"rawtext":[{"text":"\u00a77New buildings will be raised over the next few minutes."}]}
playsound random.levelup @a ~ ~ ~
particle minecraft:totem_particle ~ ~2 ~
summon minecraft:fireworks_rocket ~ ~3 ~
function npck/kingdom/celebrate

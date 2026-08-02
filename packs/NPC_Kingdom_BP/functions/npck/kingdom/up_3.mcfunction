scoreboard players remove Wood npck.res 160
scoreboard players remove Stone npck.res 128
scoreboard players remove Food npck.res 96
scoreboard players remove Iron npck.res 16
scoreboard players set #level npck.sys 3
titleraw @a title {"rawtext":[{"text":"\u00a76\u00a7lTOWN"}]}
tellraw @a {"rawtext":[{"text":"\u00a76\u00a7l[KINGDOM] \u00a7r\u00a7aYour Village has grown into a \u00a7eTOWN\u00a7a!"}]}
tellraw @a {"rawtext":[{"text":"\u00a77New buildings will be raised over the next few minutes."}]}
playsound random.levelup @a ~ ~ ~
particle minecraft:totem_particle ~ ~2 ~
summon minecraft:fireworks_rocket ~ ~3 ~
function npck/kingdom/celebrate

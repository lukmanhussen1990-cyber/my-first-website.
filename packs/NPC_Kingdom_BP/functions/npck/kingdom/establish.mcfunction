scoreboard players set #founded npck.sys 1
scoreboard players set #level npck.sys 1
scoreboard players set #buildq npck.sys 0
scoreboard players set #daystate npck.sys 1
scoreboard players set #celebt npck.sys -1
scoreboard objectives setdisplay sidebar npck.res
fill ~-5 ~ ~-5 ~5 ~5 ~5 air
fill ~-5 ~-1 ~-5 ~5 ~-1 ~5 stone_bricks
fill ~-2 ~-1 ~-2 ~2 ~-1 ~2 polished_andesite
setblock ~ ~-1 ~ gold_block
setblock ~-5 ~ ~-5 glowstone
setblock ~5 ~ ~-5 glowstone
setblock ~-5 ~ ~5 glowstone
setblock ~5 ~ ~5 glowstone
particle minecraft:totem_particle ~ ~1 ~
playsound beacon.activate @a[r=48] ~ ~ ~
titleraw @a[r=48] title {"rawtext":[{"text":"\u00a76\u00a7lA KINGDOM IS BORN"}]}
tellraw @a {"rawtext":[{"text":"\u00a76\u00a7l[KINGDOM] \u00a7r\u00a7eYour \u00a7fCamp \u00a7ehas been founded! You are its ruler."}]}
tellraw @a[r=48] {"rawtext":[{"text":"\u00a77Tap the Core with the \u00a7eRoyal Ledger\u00a77 for a full report."}]}
function npck/kingdom/starter_kit
function npck/help

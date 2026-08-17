scoreboard players set @s li_chapter 9
clear @s li:radio_part
clear @s li:fuel_can
clear @s li:mech_part
clear @s li:nav_gear
titleraw @s times 10 40 10
titleraw @s title {"rawtext":[{"text":"§eTRANSMITTING"}]}
titleraw @s subtitle {"rawtext":[{"text":"§7Emergency band - mayday, mayday..."}]}
playsound beacon.activate @s ~ ~ ~ 1.0 0.7
tellraw @s {"rawtext":[{"text":"§7The bench crackles. The lamp above you turns over once, twice, and catches."}]}
setblock 132 92 111 minecraft:redstone_lamp
particle minecraft:end_chest ~ ~1 ~
weather clear 1200
function li_story/ending

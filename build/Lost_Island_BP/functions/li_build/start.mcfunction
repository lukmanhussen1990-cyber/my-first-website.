# Kicks off the staged island build.
scoreboard players set #build li_sys 1
scoreboard players set #step li_sys 0
scoreboard players set #grp li_sys 0
scoreboard players set #idx li_sys -1
gamerule sendcommandfeedback false
gamerule commandblockoutput false
gamerule dodaylightcycle true
gamerule showcoordinates true
gamerule naturalregeneration false
weather clear 600
time set 1000
tellraw @a {"rawtext":[{"text":"§8[§eLost Island§8] §7Building the island. Do not leave the world."}]}
titleraw @a times 5 40 10
titleraw @a title {"rawtext":[{"text":"§eLOST ISLAND"}]}
titleraw @a subtitle {"rawtext":[{"text":"§7building the world..."}]}

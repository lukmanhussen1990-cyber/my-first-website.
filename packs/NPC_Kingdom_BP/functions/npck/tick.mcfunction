# One tiny dispatcher; everything heavy hangs off the 2s pulse.
execute as @e[family=npck_marker] at @s run function npck/sys/marker
execute as @e[type=npck:kingdom_core,tag=!npck_init] at @s run function npck/kingdom/found
execute as @e[type=npck:kingdom_core,tag=npck_init] at @s unless score #founded npck.sys matches 1.. run function npck/kingdom/establish
execute if entity @e[type=npck:kingdom_core,tag=npck_init] run function npck/sys/clock

# Exhaustion every 2s.
scoreboard players set #cd_exh li_sys 4
execute as @a[scores={li_chapter=1..}] run scoreboard players add @s li_exh 1
execute as @a[scores={li_chapter=1..,li_thirst=..399}] run scoreboard players add @s li_exh 2
execute as @a[scores={li_chapter=1..}] at @s if block ~ ~-1 ~ minecraft:campfire run scoreboard players remove @s li_exh 6
execute as @a[scores={li_chapter=1..}] at @s if block ~ ~-2 ~ minecraft:white_wool run scoreboard players remove @s li_exh 5
execute as @a[scores={li_exh=..0}] run scoreboard players set @s li_exh 0
execute as @a[scores={li_exh=101..}] run scoreboard players set @s li_exh 100
execute as @a[scores={li_exh=70..},tag=!li_tired] run function li_surv/tired_on
execute as @a[scores={li_exh=..69},tag=li_tired] run function li_surv/tired_off
execute as @a[scores={li_exh=70..}] run effect @s mining_fatigue 4 0 true
execute as @a[scores={li_exh=90..}] run effect @s slowness 4 0 true

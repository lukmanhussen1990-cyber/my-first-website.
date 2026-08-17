# Temperature every 3s. All checks are per-player and bounded.
scoreboard players set #cd_temp li_sys 6
execute as @a[scores={li_temp=1..}] run scoreboard players remove @s li_temp 1
execute as @a[scores={li_temp=..-1}] run scoreboard players add @s li_temp 1
execute as @a[scores={li_chapter=1..}] at @s if entity @e[type=li:sensor,family=li_night,r=6,c=1] run scoreboard players remove @s li_temp 3
execute as @a[scores={li_chapter=1..}] if score #storm li_sys matches 1 run scoreboard players remove @s li_temp 3
execute as @a[scores={li_chapter=1..},y=96,dy=60] run scoreboard players remove @s li_temp 4
execute as @a[scores={li_chapter=1..}] at @s if block ~ ~ ~ minecraft:water run scoreboard players remove @s li_temp 5
execute as @a[scores={li_chapter=1..}] at @s if block ~ ~-1 ~ minecraft:campfire run scoreboard players add @s li_temp 8
execute as @a[scores={li_chapter=1..}] at @s if block ~ ~-1 ~ minecraft:torch run scoreboard players add @s li_temp 4
execute as @a[scores={li_chapter=1..}] at @s if block ~ ~-1 ~ li:emergency_light run scoreboard players add @s li_temp 3
execute as @a[scores={li_chapter=1..},y=62,dy=12] at @s if entity @e[type=li:sensor,family=li_day,r=6,c=1] run scoreboard players add @s li_temp 2
execute as @a[scores={li_temp=..-100}] run scoreboard players set @s li_temp -100
execute as @a[scores={li_temp=100..}] run scoreboard players set @s li_temp 100
execute as @a[scores={li_temp=..-60}] run function li_surv/freezing
execute as @a[scores={li_temp=60..}] run function li_surv/overheating

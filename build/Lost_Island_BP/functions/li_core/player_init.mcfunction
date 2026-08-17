# First-join setup for one player.
tag @s add li_init
tag @s add li_sys_on
scoreboard players set @s li_thirst 1200
scoreboard players set @s li_temp 0
scoreboard players set @s li_exh 0
scoreboard players add @s li_bat 0
scoreboard players add @s li_chapter 0
scoreboard players add @s li_esc 0
scoreboard players add @s li_obj 0
scoreboard players add @s li_flag 0
execute if score @s li_chapter matches 0 run function li_story/intro

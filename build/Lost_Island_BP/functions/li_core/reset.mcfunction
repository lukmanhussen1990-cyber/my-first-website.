# Reset one player's progress (does not rebuild the island).
tag @s remove li_init
scoreboard players set @s li_chapter 0
scoreboard players set @s li_thirst 1200
scoreboard players set @s li_temp 0
scoreboard players set @s li_exh 0
scoreboard players set @s li_bat 0
scoreboard players set @s li_esc 0
tellraw @s {"rawtext":[{"text":"§7Lost Island progress reset for you."}]}

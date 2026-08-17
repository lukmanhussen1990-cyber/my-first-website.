execute if entity @e[type=li:sensor,family=li_night,r=6,c=1] unless entity @e[family=li_hostile,r=26,c=1] run function li_mobs/night_spawn
execute if entity @e[type=li:sensor,family=li_day,r=6,c=1] if score #rand li_sys matches 0..3 unless entity @e[family=li_hostile,r=30,c=1] run function li_mobs/day_spawn
execute if score @s li_chapter matches 6.. unless entity @e[type=li:alpha_stalker,r=48,c=1] if score #rand li_sys matches 7 run function li_mobs/forbidden_spawn

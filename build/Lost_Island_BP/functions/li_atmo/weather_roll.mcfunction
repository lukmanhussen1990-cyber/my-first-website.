# Rolls the weather about every 5 minutes.
scoreboard players set #count li_sys 0
execute if score #rand li_sys matches 0..3 run function li_atmo/storm
execute if score #rand li_sys matches 4..8 run function li_atmo/rain
execute if score #rand li_sys matches 9..19 run function li_atmo/clear

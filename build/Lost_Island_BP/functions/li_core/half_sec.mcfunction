# Twice per second. Each subsystem is countdown-gated.
scoreboard players set #tick li_sys 0
scoreboard players add #sec li_sys 1
execute if score #sec li_sys matches 100000.. run scoreboard players set #sec li_sys 0
scoreboard players operation #rand li_sys = #sec li_sys
scoreboard players operation #rand li_sys %= #c20 li_sys
execute as @a[tag=!li_init] run function li_core/player_init
function li_items/detect
scoreboard players remove #cd_hud li_sys 1
execute if score #cd_hud li_sys matches ..0 run function li_surv/hud
scoreboard players remove #cd_thirst li_sys 1
execute if score #cd_thirst li_sys matches ..0 run function li_surv/thirst
scoreboard players remove #cd_temp li_sys 1
execute if score #cd_temp li_sys matches ..0 run function li_surv/temp
scoreboard players remove #cd_exh li_sys 1
execute if score #cd_exh li_sys matches ..0 run function li_surv/exh
scoreboard players remove #cd_tor li_sys 1
execute if score #cd_tor li_sys matches ..0 run function li_items/flashlight
scoreboard players remove #cd_atmo li_sys 1
execute if score #cd_atmo li_sys matches ..0 run function li_atmo/tick
scoreboard players remove #cd_enc li_sys 1
execute if score #cd_enc li_sys matches ..0 run function li_mobs/encounters
scoreboard players remove #cd_esc li_sys 1
execute if score #cd_esc li_sys matches ..0 run function li_story/escape_check
function li_story/zones

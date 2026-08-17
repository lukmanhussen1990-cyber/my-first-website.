# Runs once per world (guarded by the li_sys_on tag).
scoreboard objectives add li_sys dummy "LI System"
scoreboard objectives add li_chapter dummy "Chapter"
scoreboard objectives add li_thirst dummy "Thirst"
scoreboard objectives add li_temp dummy "Temperature"
scoreboard objectives add li_exh dummy "Exhaustion"
scoreboard objectives add li_bat dummy "Battery"
scoreboard objectives add li_flag dummy "Flags"
scoreboard objectives add li_esc dummy "Escape Parts"
scoreboard objectives add li_obj dummy "Objective"
scoreboard objectives add li_tmp dummy "Scratch"
scoreboard objectives add li_pct dummy "Water Percent"
scoreboard players set #tick li_sys 0
scoreboard players set #sec li_sys 0
scoreboard players set #build li_sys 0
scoreboard players set #step li_sys 0
scoreboard players set #grp li_sys 0
scoreboard players set #idx li_sys 0
scoreboard players set #built li_sys 0
scoreboard players set #count li_sys 0
scoreboard players set #storm li_sys 0
scoreboard players set #watch li_sys 0
scoreboard players set #rand li_sys 0
scoreboard players set #zgrp li_sys 0
scoreboard players set #c12 li_sys 12
scoreboard players set #c20 li_sys 20
scoreboard players set #cd_hud li_sys 2
scoreboard players set #cd_thirst li_sys 12
scoreboard players set #cd_temp li_sys 6
scoreboard players set #cd_exh li_sys 4
scoreboard players set #cd_tor li_sys 2
scoreboard players set #cd_atmo li_sys 10
scoreboard players set #cd_enc li_sys 20
scoreboard players set #cd_esc li_sys 4
tag @a add li_sys_on

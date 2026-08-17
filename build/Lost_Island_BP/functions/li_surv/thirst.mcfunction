# Thirst drain and state effects (every 6s).
scoreboard players set #cd_thirst li_sys 12
execute as @a[scores={li_chapter=1..}] run scoreboard players remove @s li_thirst 3
execute as @a[scores={li_chapter=1..,li_temp=40..}] run scoreboard players remove @s li_thirst 2
execute as @a[scores={li_thirst=..0}] run scoreboard players set @s li_thirst 0
execute as @a[scores={li_thirst=1201..}] run scoreboard players set @s li_thirst 1200
execute as @a[scores={li_thirst=..399},tag=!li_dry] run function li_surv/thirsty_on
execute as @a[scores={li_thirst=400..},tag=li_dry] run function li_surv/thirsty_off
execute as @a[scores={li_thirst=..119}] at @s run function li_surv/dehydrated
execute as @a[scores={li_thirst=0}] at @s run function li_surv/critical

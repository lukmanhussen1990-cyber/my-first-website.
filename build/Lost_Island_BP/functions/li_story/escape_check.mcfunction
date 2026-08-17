# Counts escape components and watches the lighthouse bench.
scoreboard players set #cd_esc li_sys 4
execute as @a[scores={li_chapter=8}] run scoreboard players set @s li_esc 0
execute as @a[scores={li_chapter=8},hasitem={item=li:radio_part}] run scoreboard players add @s li_esc 1
execute as @a[scores={li_chapter=8},hasitem={item=li:battery}] run scoreboard players add @s li_esc 1
execute as @a[scores={li_chapter=8},hasitem={item=li:fuel_can}] run scoreboard players add @s li_esc 1
execute as @a[scores={li_chapter=8},hasitem={item=li:mech_part}] run scoreboard players add @s li_esc 1
execute as @a[scores={li_chapter=8},hasitem={item=li:nav_gear}] run scoreboard players add @s li_esc 1
execute as @a[scores={li_chapter=8,li_esc=5..},x=128,y=92,z=108,dx=9,dy=6,dz=9] at @s run function li_story/escape_final
execute as @a[scores={li_chapter=8,li_esc=..4},x=128,y=92,z=108,dx=9,dy=6,dz=9] at @s run function li_story/escape_missing

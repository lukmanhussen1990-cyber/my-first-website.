scoreboard players set #watch li_sys 0
execute as @a[scores={li_chapter=3..},c=1] at @s if score #rand li_sys matches 3 unless entity @e[type=li:watcher,r=64,c=1] run function li_mobs/watcher_spawn

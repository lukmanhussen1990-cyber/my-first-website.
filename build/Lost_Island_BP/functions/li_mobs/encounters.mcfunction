# Encounter director, every 10s.
scoreboard players set #cd_enc li_sys 20
execute as @a[scores={li_chapter=2..}] at @s run function li_mobs/enc_player
scoreboard players add #watch li_sys 1
execute if score #watch li_sys matches 30.. run function li_mobs/watcher_try

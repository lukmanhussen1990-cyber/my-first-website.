scoreboard players add @s npck.job 1
execute if score @s npck.job matches 3.. run scoreboard players set @s npck.job 0
execute if entity @s[family=npck_builder] run function npck/npc/say/builder
execute if entity @s[family=npck_farmer] run function npck/npc/say/farmer
execute if entity @s[family=npck_miner] run function npck/npc/say/miner
execute if entity @s[family=npck_lumberjack] run function npck/npc/say/lumberjack
execute if entity @s[family=npck_guard] run function npck/npc/say/guard
execute if entity @s[family=npck_archer] run function npck/npc/say/archer
execute if entity @s[family=npck_knight] run function npck/npc/say/knight
execute if entity @s[family=npck_healer] run function npck/npc/say/healer
execute if entity @s[family=npck_merchant] run function npck/npc/say/merchant
execute if entity @s[family=npck_blacksmith] run function npck/npc/say/blacksmith
execute if entity @s[family=npck_royal_guard] run function npck/npc/say/royal_guard
execute if entity @s[family=npck_general] run function npck/npc/say/general
execute if entity @s[family=npck_advisor] run function npck/npc/say/advisor
execute if entity @s[family=npck_advisor] run function npck/kingdom/status
playsound note.harp @a[r=12] ~ ~ ~

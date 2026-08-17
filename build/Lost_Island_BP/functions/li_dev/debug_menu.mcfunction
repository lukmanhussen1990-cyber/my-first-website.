# The debug wand: refills meters and advances one chapter.
tellraw @s {"rawtext":[{"text":"§8[§eLost Island Debug§8]"}]}
tellraw @s {"rawtext":[{"text":"§7Chapter §f"},{"score":{"name":"*","objective":"li_chapter"}},{"text":"§7  Water §f"},{"score":{"name":"*","objective":"li_pct"}},{"text":"§7%  Temp §f"},{"score":{"name":"*","objective":"li_temp"}},{"text":"§7  Exh §f"},{"score":{"name":"*","objective":"li_exh"}},{"text":"§7  Torch §f"},{"score":{"name":"*","objective":"li_bat"}},{"text":"§7%"}]}
scoreboard players set @s li_thirst 1200
scoreboard players set @s li_temp 0
scoreboard players set @s li_exh 0
scoreboard players set @s li_bat 100
scoreboard players add @s li_chapter 1
execute if score @s li_chapter matches 9.. run scoreboard players set @s li_chapter 8
function li_story/objective
tellraw @s {"rawtext":[{"text":"§7Meters refilled and chapter advanced."}]}

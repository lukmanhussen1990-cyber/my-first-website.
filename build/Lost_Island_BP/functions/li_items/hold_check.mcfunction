# Runs only until the island exists: hold-to-start fallback.
execute as @a unless entity @s[hasitem={item=li:setup_tool,location=slot.weapon.mainhand}] run scoreboard players set @s li_tmp 0
execute as @a[hasitem={item=li:setup_tool,location=slot.weapon.mainhand}] run scoreboard players add @s li_tmp 1
execute as @a[hasitem={item=li:setup_tool,location=slot.weapon.mainhand},scores={li_tmp=3}] run titleraw @s actionbar {"rawtext":[{"text":"§7Keep holding the Start Kit..."}]}
execute as @a[hasitem={item=li:setup_tool,location=slot.weapon.mainhand},scores={li_tmp=6..}] at @s run function li_items/hold_start

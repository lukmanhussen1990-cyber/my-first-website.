# One actionbar line per player per second.
scoreboard players set #cd_hud li_sys 2
execute as @a[scores={li_chapter=1..}] run scoreboard players operation @s li_pct = @s li_thirst
execute as @a[scores={li_chapter=1..}] run scoreboard players operation @s li_pct /= #c12 li_sys
execute as @a[scores={li_chapter=1..,li_temp=..-60}] run titleraw @s actionbar {"rawtext":[{"text":"§bWater §f"},{"score":{"name":"*","objective":"li_pct"}},{"text":"§7%  "},{"text":"§eTemp §bFreezing§7  "},{"text":"§6Torch §f"},{"score":{"name":"*","objective":"li_bat"}},{"text":"§7%"}]}
execute as @a[scores={li_chapter=1..,li_temp=-59..-25}] run titleraw @s actionbar {"rawtext":[{"text":"§bWater §f"},{"score":{"name":"*","objective":"li_pct"}},{"text":"§7%  "},{"text":"§eTemp §bCold§7  "},{"text":"§6Torch §f"},{"score":{"name":"*","objective":"li_bat"}},{"text":"§7%"}]}
execute as @a[scores={li_chapter=1..,li_temp=-24..24}] run titleraw @s actionbar {"rawtext":[{"text":"§bWater §f"},{"score":{"name":"*","objective":"li_pct"}},{"text":"§7%  "},{"text":"§eTemp §aComfortable§7  "},{"text":"§6Torch §f"},{"score":{"name":"*","objective":"li_bat"}},{"text":"§7%"}]}
execute as @a[scores={li_chapter=1..,li_temp=25..59}] run titleraw @s actionbar {"rawtext":[{"text":"§bWater §f"},{"score":{"name":"*","objective":"li_pct"}},{"text":"§7%  "},{"text":"§eTemp §6Hot§7  "},{"text":"§6Torch §f"},{"score":{"name":"*","objective":"li_bat"}},{"text":"§7%"}]}
execute as @a[scores={li_chapter=1..,li_temp=60..}] run titleraw @s actionbar {"rawtext":[{"text":"§bWater §f"},{"score":{"name":"*","objective":"li_pct"}},{"text":"§7%  "},{"text":"§eTemp §cOverheating§7  "},{"text":"§6Torch §f"},{"score":{"name":"*","objective":"li_bat"}},{"text":"§7%"}]}

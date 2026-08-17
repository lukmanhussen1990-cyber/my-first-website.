# Entry point (tick.json). 2 commands per tick.
execute unless entity @a[tag=li_sys_on,c=1] run function li_core/boot
execute if entity @a[tag=li_sys_on,c=1] run function li_core/loop

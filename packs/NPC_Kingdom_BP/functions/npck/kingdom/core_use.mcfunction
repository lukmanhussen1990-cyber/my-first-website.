execute if entity @p[r=6,hasitem={item=npck:celebration_horn,location=slot.weapon.mainhand}] run function npck/kingdom/celebrate
execute if entity @p[r=6,hasitem={item=npck:war_horn,location=slot.weapon.mainhand}] run function npck/raid/declare
execute if entity @p[r=6,hasitem={item=npck:command_staff,location=slot.weapon.mainhand}] run function npck/kingdom/repair_step
execute unless entity @p[r=6,hasitem=[{item=npck:celebration_horn,location=slot.weapon.mainhand},{item=npck:war_horn,location=slot.weapon.mainhand},{item=npck:command_staff,location=slot.weapon.mainhand}]] run function npck/kingdom/status

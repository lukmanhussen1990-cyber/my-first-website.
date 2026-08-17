# Held torch upkeep, once per second.
scoreboard players set #cd_tor li_sys 2
execute as @a[hasitem={item=li:flashlight_on,location=slot.weapon.mainhand}] run effect @s night_vision 4 0 true
execute as @a[hasitem={item=li:flashlight_on,location=slot.weapon.mainhand},scores={li_bat=1..}] run scoreboard players remove @s li_bat 1
execute as @a[hasitem={item=li:flashlight_on}] at @s run function li_items/torch_check

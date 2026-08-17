execute if score @s li_bat matches ..0 run clear @s li:flashlight_on
execute if score @s li_bat matches ..0 run give @s li:flashlight_off 1
execute if score @s li_bat matches ..0 run titleraw @s actionbar {"rawtext":[{"text":"§7The torch flickers and dies."}]}
execute if score @s li_bat matches ..0 run playsound random.click @s ~ ~ ~ 0.7 0.5

clear @s li:flashlight_off_used
execute if score @s li_bat matches 1.. run function li_items/torch_on
execute if score @s li_bat matches ..0 run function li_items/torch_dead

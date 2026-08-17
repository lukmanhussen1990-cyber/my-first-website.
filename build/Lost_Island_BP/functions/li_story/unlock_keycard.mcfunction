titleraw @s actionbar {"rawtext":[{"text":"§7You look for something to open..."}]}
execute if entity @s[x=-32,y=67,z=-146,dx=12,dy=9,dz=12] run function li_story/open_lab_main_door
execute if entity @s[x=-31,y=16,z=-142,dx=12,dy=9,dz=12] run function li_story/open_complex_final_door

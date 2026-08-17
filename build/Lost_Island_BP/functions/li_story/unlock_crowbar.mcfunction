titleraw @s actionbar {"rawtext":[{"text":"§7You look for something to open..."}]}
execute if entity @s[x=-30,y=64,z=23,dx=12,dy=9,dz=12] run function li_story/open_hospital_pharmacy
execute if entity @s[x=4,y=64,z=10,dx=12,dy=9,dz=12] run function li_story/open_police_armoury
execute if entity @s[x=46,y=68,z=-97,dx=12,dy=9,dz=12] run function li_story/open_checkpoint_gate

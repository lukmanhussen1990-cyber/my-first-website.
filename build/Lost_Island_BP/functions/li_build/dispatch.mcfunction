# Runs one build step per tick.
scoreboard players add #idx li_sys 1
execute if score #idx li_sys matches 20.. run function li_build/nextgrp
execute if score #grp li_sys matches 0 run function li_build/g00
execute if score #grp li_sys matches 1 run function li_build/g01
execute if score #grp li_sys matches 2 run function li_build/g02
execute if score #grp li_sys matches 3 run function li_build/g03
execute if score #grp li_sys matches 4 run function li_build/g04
execute if score #grp li_sys matches 5 run function li_build/g05
execute if score #grp li_sys matches 6 run function li_build/g06
execute if score #grp li_sys matches 7 run function li_build/g07
execute if score #grp li_sys matches 8 run function li_build/g08
execute if score #grp li_sys matches 9 run function li_build/g09
execute if score #grp li_sys matches 10 run function li_build/g10
execute if score #grp li_sys matches 11 run function li_build/g11
execute if score #grp li_sys matches 12 run function li_build/g12
execute if score #grp li_sys matches 13 run function li_build/g13
execute if score #grp li_sys matches 14 run function li_build/g14
execute if score #grp li_sys matches 15 run function li_build/g15
execute if score #grp li_sys matches 16 run function li_build/g16
execute if score #grp li_sys matches 17 run function li_build/g17
execute if score #grp li_sys matches 18.. run function li_build/finish

# Rotates through the trigger-volume groups.
scoreboard players add #zgrp li_sys 1
execute if score #zgrp li_sys matches 5.. run scoreboard players set #zgrp li_sys 0
execute if score #zgrp li_sys matches 0 run function li_story/zones_0
execute if score #zgrp li_sys matches 1 run function li_story/zones_1
execute if score #zgrp li_sys matches 2 run function li_story/zones_2
execute if score #zgrp li_sys matches 3 run function li_story/zones_3
execute if score #zgrp li_sys matches 4 run function li_story/zones_4

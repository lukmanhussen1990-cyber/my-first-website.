scoreboard players set #prodmsg npck.sys 0
execute if entity @e[family=npck_farmer,r=72] run tellraw @a[r=48] {"rawtext":[{"text":"\u00a7a[Farmer] \u00a7f\"The harvest is ready.\""}]}
execute if entity @e[family=npck_worker,r=72] run tellraw @a[r=48] {"rawtext":[{"text":"\u00a7a[Kingdom] \u00a7f\"Our kingdom is growing!\""}]}

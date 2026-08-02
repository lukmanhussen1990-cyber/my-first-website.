execute if score @s npck.job matches 0 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Guard> \u00a7f\"Enemy spotted!\""}]}
execute if score @s npck.job matches 1 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Guard> \u00a7f\"The gate is secure, my king.\""}]}
execute if score @s npck.job matches 2 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Guard> \u00a7f\"For the kingdom!\""}]}

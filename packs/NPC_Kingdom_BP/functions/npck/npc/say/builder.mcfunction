execute if score @s npck.job matches 0 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Builder> \u00a7f\"My king, what are your orders?\""}]}
execute if score @s npck.job matches 1 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Builder> \u00a7f\"The walls need repairs.\""}]}
execute if score @s npck.job matches 2 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Builder> \u00a7f\"I'll have it standing by nightfall.\""}]}

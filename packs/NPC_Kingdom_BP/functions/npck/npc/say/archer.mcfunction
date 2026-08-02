execute if score @s npck.job matches 0 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Archer> \u00a7f\"My arrows are ready.\""}]}
execute if score @s npck.job matches 1 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Archer> \u00a7f\"Enemy spotted!\""}]}
execute if score @s npck.job matches 2 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Archer> \u00a7f\"Nothing gets past the wall.\""}]}

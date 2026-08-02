tellraw @a[r=24] {"rawtext":[{"text":"\u00a76\u00a7l===== KINGDOM REPORT ====="}]}
execute if score #level npck.sys matches 1 run tellraw @a[r=24] {"rawtext":[{"text":"\u00a7eRank: \u00a7fCamp \u00a77(Level 1/5)"}]}
execute if score #level npck.sys matches 2 run tellraw @a[r=24] {"rawtext":[{"text":"\u00a7eRank: \u00a7fVillage \u00a77(Level 2/5)"}]}
execute if score #level npck.sys matches 3 run tellraw @a[r=24] {"rawtext":[{"text":"\u00a7eRank: \u00a7fTown \u00a77(Level 3/5)"}]}
execute if score #level npck.sys matches 4 run tellraw @a[r=24] {"rawtext":[{"text":"\u00a7eRank: \u00a7fCity \u00a77(Level 4/5)"}]}
execute if score #level npck.sys matches 5 run tellraw @a[r=24] {"rawtext":[{"text":"\u00a7eRank: \u00a7fKingdom \u00a77(Level 5/5)"}]}
tellraw @a[r=24] {"rawtext":[{"text":"\u00a77 - \u00a7fFood: \u00a7a"},{"score":{"name":"Food","objective":"npck.res"}}]}
tellraw @a[r=24] {"rawtext":[{"text":"\u00a77 - \u00a7fWood: \u00a7a"},{"score":{"name":"Wood","objective":"npck.res"}}]}
tellraw @a[r=24] {"rawtext":[{"text":"\u00a77 - \u00a7fStone: \u00a7a"},{"score":{"name":"Stone","objective":"npck.res"}}]}
tellraw @a[r=24] {"rawtext":[{"text":"\u00a77 - \u00a7fIron: \u00a7a"},{"score":{"name":"Iron","objective":"npck.res"}}]}
tellraw @a[r=24] {"rawtext":[{"text":"\u00a77 - \u00a7fGold: \u00a7a"},{"score":{"name":"Gold","objective":"npck.res"}}]}
tellraw @a[r=24] {"rawtext":[{"text":"\u00a77 - \u00a7fEmeralds: \u00a7a"},{"score":{"name":"Emeralds","objective":"npck.res"}}]}
tellraw @a[r=24] {"rawtext":[{"text":"\u00a77Live storage is always shown on the sidebar."}]}
execute if score #level npck.sys matches 1 run tellraw @a[r=24] {"rawtext":[{"text":"\u00a7eNext (Village): \u00a7f64 Wood, 32 Stone, 32 Food"}]}
execute if score #level npck.sys matches 2 run tellraw @a[r=24] {"rawtext":[{"text":"\u00a7eNext (Town): \u00a7f160 Wood, 128 Stone, 96 Food, 16 Iron"}]}
execute if score #level npck.sys matches 3 run tellraw @a[r=24] {"rawtext":[{"text":"\u00a7eNext (City): \u00a7f320 Wood, 256 Stone, 192 Food, 64 Iron, 24 Gold, 8 Emeralds"}]}
execute if score #level npck.sys matches 4 run tellraw @a[r=24] {"rawtext":[{"text":"\u00a7eNext (Kingdom): \u00a7f512 Wood, 512 Stone, 384 Food, 128 Iron, 64 Gold, 32 Emeralds"}]}
execute if score #level npck.sys matches 5 run tellraw @a[r=24] {"rawtext":[{"text":"\u00a76Your realm has reached its greatest form."}]}
execute if score Emeralds npck.res matches 8.. run function npck/kingdom/tax
playsound random.orb @a[r=16] ~ ~ ~

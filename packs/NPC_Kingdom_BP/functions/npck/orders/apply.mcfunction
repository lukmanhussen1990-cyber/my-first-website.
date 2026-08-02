function npck/orders/apply_silent
execute if score @s npck.order matches 0 run titleraw @a[r=16] actionbar {"rawtext":[{"text":"\u00a76Order: \u00a7fWork"}]}
execute if score @s npck.order matches 0 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Citizen> \u00a7f\"Back to work, my king.\" \u00a77(Work)"}]}
execute if score @s npck.order matches 1 run titleraw @a[r=16] actionbar {"rawtext":[{"text":"\u00a76Order: \u00a7fFollow Me"}]}
execute if score @s npck.order matches 1 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Citizen> \u00a7f\"My king, what are your orders?\" \u00a77(Follow Me)"}]}
execute if score @s npck.order matches 2 run titleraw @a[r=16] actionbar {"rawtext":[{"text":"\u00a76Order: \u00a7fStay Here"}]}
execute if score @s npck.order matches 2 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Citizen> \u00a7f\"I will hold this ground.\" \u00a77(Stay Here)"}]}
execute if score @s npck.order matches 3 run titleraw @a[r=16] actionbar {"rawtext":[{"text":"\u00a76Order: \u00a7fPatrol This Area"}]}
execute if score @s npck.order matches 3 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Citizen> \u00a7f\"I'll walk the perimeter.\" \u00a77(Patrol This Area)"}]}
execute if score @s npck.order matches 4 run titleraw @a[r=16] actionbar {"rawtext":[{"text":"\u00a76Order: \u00a7fDefend The Kingdom"}]}
execute if score @s npck.order matches 4 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Citizen> \u00a7f\"For the kingdom!\" \u00a77(Defend The Kingdom)"}]}
execute if score @s npck.order matches 5 run titleraw @a[r=16] actionbar {"rawtext":[{"text":"\u00a76Order: \u00a7fAttack Target"}]}
execute if score @s npck.order matches 5 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Citizen> \u00a7f\"The enemy will fall!\" \u00a77(Attack Target)"}]}
execute if score @s npck.order matches 6 run titleraw @a[r=16] actionbar {"rawtext":[{"text":"\u00a76Order: \u00a7fRetreat"}]}
execute if score @s npck.order matches 6 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Citizen> \u00a7f\"Falling back, my king!\" \u00a77(Retreat)"}]}
execute if score @s npck.order matches 7 run titleraw @a[r=16] actionbar {"rawtext":[{"text":"\u00a76Order: \u00a7fGather Resources"}]}
execute if score @s npck.order matches 7 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Citizen> \u00a7f\"I'll gather resources.\" \u00a77(Gather Resources)"}]}
execute if score @s npck.order matches 8 run titleraw @a[r=16] actionbar {"rawtext":[{"text":"\u00a76Order: \u00a7fBuild"}]}
execute if score @s npck.order matches 8 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Citizen> \u00a7f\"The walls need repairs.\" \u00a77(Build)"}]}
execute if score @s npck.order matches 9 run titleraw @a[r=16] actionbar {"rawtext":[{"text":"\u00a76Order: \u00a7fRepair"}]}
execute if score @s npck.order matches 9 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Citizen> \u00a7f\"I'll patch it up.\" \u00a77(Repair)"}]}
execute if score @s npck.order matches 10 run titleraw @a[r=16] actionbar {"rawtext":[{"text":"\u00a76Order: \u00a7fReturn Home"}]}
execute if score @s npck.order matches 10 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Citizen> \u00a7f\"Returning home.\" \u00a77(Return Home)"}]}
execute if score @s npck.order matches 11 run titleraw @a[r=16] actionbar {"rawtext":[{"text":"\u00a76Order: \u00a7fCelebrate"}]}
execute if score @s npck.order matches 11 run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Citizen> \u00a7f\"Victory is ours!\" \u00a77(Celebrate)"}]}
playsound note.pling @a[r=16] ~ ~ ~
execute if score @s npck.order matches 1 unless entity @s[family=npck_recruited] run tellraw @a[r=16] {"rawtext":[{"text":"\u00a7b<Citizen> \u00a7f\"Give me an \u00a7aemerald\u00a7f to recruit me, my king.\""}]}
execute if score @s npck.order matches 10 run function npck/orders/go_home
execute if score @s npck.order matches 5 run effect @s speed 12 0 true
execute if score @s npck.order matches 6 run effect @s speed 10 1 true
execute if score @s npck.order matches 11 run particle minecraft:totem_particle ~ ~2 ~

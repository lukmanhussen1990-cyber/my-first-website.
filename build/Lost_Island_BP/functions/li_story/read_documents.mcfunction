titleraw @s actionbar {"rawtext":[{"text":"§7You leaf through the papers."}]}
execute if score #rand li_sys matches 0..2 run tellraw @s {"rawtext":[{"text":"§7§oSITE 7 - established to study an anomaly found during island survey works. Local population unaware. Keep it that way."}]}
execute if score #rand li_sys matches 3..5 run tellraw @s {"rawtext":[{"text":"§7§oIncident 12: containment breach in the lower cells. Three specimens unaccounted for. Site Command has declined evacuation."}]}
execute if score #rand li_sys matches 6..8 run tellraw @s {"rawtext":[{"text":"§7§oQuarantine the north. Quarantine the village. Quarantine the harbour. Under no circumstances quarantine the facility on paper."}]}
execute if score #rand li_sys matches 9..11 run tellraw @s {"rawtext":[{"text":"§7§oThe anomaly was here before the island had a name. We did not create anything. We WOKE something, and then we studied it until it studied us."}]}
execute if score #rand li_sys matches 12..14 run tellraw @s {"rawtext":[{"text":"§7§oI signed the order that kept the ships in port. Eight hundred people. I told myself containment was mercy. It was arithmetic."}]}
execute if score #rand li_sys matches 15..17 run tellraw @s {"rawtext":[{"text":"§7§oCell 1 - empty. Cell 2 - empty. Cell 3 - door opened from the inside. Cell 4 - do not open."}]}
execute if score #rand li_sys matches 18.. run tellraw @s {"rawtext":[{"text":"§7§oMost of this page is water damage."}]}

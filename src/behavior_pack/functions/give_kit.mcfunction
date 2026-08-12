# Give yourself the full survival equipment kit.

give @s myc:scanner 1
give @s myc:contamination_detector 1
give @s myc:spore_mask 1
give @s myc:protective_suit 1
give @s myc:medkit 4
give @s myc:suppressant 3
give @s myc:biofilter 6
tellraw @s {"rawtext":[{"text":"§a[SUPPLY] §7Equipment kit issued. Wear the mask and suit."}]}
tellraw @s {"rawtext":[{"text":"§7Hold the scanner and §fsneak§7, or tap with it, to scan."}]}

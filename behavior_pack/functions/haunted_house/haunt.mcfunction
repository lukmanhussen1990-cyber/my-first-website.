# --- HAUNTED HOUSE: optional spooky residents & ambiance ---
# WARNING: this summons real mobs. Some are hostile - be ready!

# The resident witch, brewing by the hearth
summon witch ~0 ~1 ~13

# Bats fluttering through the rooms
summon bat ~-3 ~5 ~6
summon bat ~3 ~5 ~12
summon bat ~0 ~7 ~9

# A lone zombie shambling in the yard
summon zombie ~4 ~1 ~-1

# Eerie cave ambiance
playsound ambient.cave @a ~ ~ ~ 1 0.6
playsound mob.ghast.moan @a ~ ~ ~ 0.8 0.8

# Roll in the spooky purple fog (from the resource pack)
fog @a push haunted:spooky_fog spooky_fog

# To clear the fog later, run:  /fog @a remove spooky_fog

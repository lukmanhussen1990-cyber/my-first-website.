# --- HAUNTED HOUSE: remove the whole build ---
# Clears the entire footprint (house + yard) back to air.

fill ~-9 ~-1 ~-3 ~9 ~18 ~19 minecraft:air
tellraw @a {"rawtext":[{"text":"§8The Haunted House fades back into the mist..."}]}

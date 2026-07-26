# STEP 2 - Carve the rooms out of the shell.
# Floor is Y -20. Room air is Y -19..-15 (5 high). Ceiling is Y -14.
# Doorways are only 3 high (Y -19..-17) so they read as doors.
#
#            Z+ (south)
#   FARM   |  HALL  |  WORKSHOP     z 12..16
#   -------+--------+----------     z 17 wall
#   QUARTERS| HALL  |  COMMAND      z 18..23
#   VAULT (hidden)                  z 25..27

# --- Landing / airlock (ladder from the surface lands here) ---
fill ~-3 ~-19 ~4 ~3 ~-15 ~9 air

# --- Corridor: landing -> main hall (3 high = doorway look) ---
fill ~-1 ~-19 ~10 ~1 ~-17 ~11 air

# --- Main hall ---
fill ~-6 ~-19 ~12 ~6 ~-15 ~23 air

# --- Farm room (west, front) ---
fill ~-13 ~-19 ~12 ~-8 ~-15 ~16 air

# --- Workshop / armoury (east, front) ---
fill ~8 ~-19 ~12 ~13 ~-15 ~16 air

# --- Living quarters (west, back) ---
fill ~-13 ~-19 ~18 ~-8 ~-15 ~23 air

# --- Command room (east, back) ---
fill ~8 ~-19 ~18 ~13 ~-15 ~23 air

# --- Doorways through the 1-block walls at X -7 and X 7 ---
fill ~-7 ~-19 ~14 ~-7 ~-17 ~15 air
fill ~7 ~-19 ~14 ~7 ~-17 ~15 air
fill ~-7 ~-19 ~20 ~-7 ~-17 ~21 air
fill ~7 ~-19 ~20 ~7 ~-17 ~21 air

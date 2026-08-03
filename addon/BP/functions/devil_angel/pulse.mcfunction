# ============================================================
#  DEVIL  -  burns the ground, the player, and nearly everything
# ============================================================

# Lay fire all around itself. "keep" only fills air, so it never
# eats your builds - it just sets them alight.
execute as @e[type=devil_angel:devil] at @s run fill ~-2 ~ ~-2 ~2 ~1 ~2 fire keep

# Scorch any player standing close
execute as @e[type=devil_angel:devil] at @s run damage @a[r=6] 2 fire

# Set the player himself on fire (fire in the block he stands in)
execute as @e[type=devil_angel:devil] at @s run execute as @a[r=7] at @s run fill ~ ~ ~ ~ ~ ~ fire keep

# Scorch every other mob nearby - but never other devils or the angel
execute as @e[type=devil_angel:devil] at @s run damage @e[r=6,family=mob,family=!devil,family=!angel] 3 fire
execute as @e[type=devil_angel:devil] at @s run execute as @e[r=7,family=mob,family=!devil,family=!angel] at @s run fill ~ ~ ~ ~ ~ ~ fire keep


# ============================================================
#  ANGEL  -  smites the devil, puts the fires out, protects you
# ============================================================

# Holy damage: any devil within 14 blocks is being burned down,
# even before the angel reaches it. This is what makes the angel win.
execute as @e[type=devil_angel:angel] at @s run damage @e[r=14,family=devil] 10 magic

# Extinguish the devil's fire around itself
execute as @e[type=devil_angel:angel] at @s run fill ~-4 ~-2 ~-4 ~4 ~2 ~4 air replace fire

# Blessings for any player nearby
execute as @e[type=devil_angel:angel] at @s run effect @a[r=14] fire_resistance 8 0 true
execute as @e[type=devil_angel:angel] at @s run effect @a[r=14] regeneration 6 1 true
execute as @e[type=devil_angel:angel] at @s run effect @a[r=14] absorption 8 1 true

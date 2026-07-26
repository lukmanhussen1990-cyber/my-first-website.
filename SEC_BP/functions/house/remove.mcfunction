# Deletes the house - run /function house/remove

# Wipes the whole envelope back to air. Same footprint as house/clear.
# Anything you left in a chest goes with it.
fill ~-16 ~-3 ~-16 ~16 ~20 ~16 air
tellraw @s {"rawtext":[{"text":"§eSecurity house removed.§r"}]}

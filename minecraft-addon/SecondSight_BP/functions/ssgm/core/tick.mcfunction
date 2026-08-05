# Second Sight - main loop. Runs every tick via functions/tick.json.
# Runs at world level, so the trigger items work even with cheats switched off.

# 1) Trigger orbs. Throwing a Perspective Lens / God Core spawns an invisible
#    orb for a moment; tag the nearest player (the thrower), then clean up.
execute at @e[type=ssgm:lens_orb] run tag @p[r=12] add ssgm_cycle
execute at @e[type=ssgm:god_orb] run tag @p[r=12] add ssgm_godtoggle
kill @e[type=ssgm:lens_orb]
kill @e[type=ssgm:god_orb]

# 2) Throwing consumes the item, so hand it straight back. clear-then-give
#    keeps it at exactly one copy instead of building up a pile.
execute as @a[tag=ssgm_cycle] run clear @s ssgm:perspective_lens
execute as @a[tag=ssgm_cycle] run give @s ssgm:perspective_lens 1
execute as @a[tag=ssgm_godtoggle] run clear @s ssgm:god_core
execute as @a[tag=ssgm_godtoggle] run give @s ssgm:god_core 1

# 3) Advance the view cycle: first person -> second person -> behind -> first.
#    ssgm_vdone stops one player falling through several branches in a tick.
execute as @a[tag=ssgm_cycle,tag=ssgm_view2] at @s run function ssgm/core/view_first
execute as @a[tag=ssgm_cycle,tag=ssgm_view1,tag=!ssgm_vdone] at @s run function ssgm/core/view_behind
execute as @a[tag=ssgm_cycle,tag=!ssgm_view1,tag=!ssgm_view2,tag=!ssgm_vdone] at @s run function ssgm/core/view_second

# 4) God mode toggle. Same guard, own marker tag.
execute as @a[tag=ssgm_godtoggle,tag=ssgm_god] at @s run function ssgm/core/god_off
execute as @a[tag=ssgm_godtoggle,tag=!ssgm_god,tag=!ssgm_gdone] at @s run function ssgm/core/god_on

# 5) Hold the camera in place. Re-applying it every tick is what makes the
#    view survive dying, respawning, changing dimension and reloading the
#    world - the player never has to re-toggle.
execute as @a[tag=ssgm_view1] run camera @s set minecraft:third_person_front
execute as @a[tag=ssgm_view2] run camera @s set minecraft:third_person

# 6) God mode upkeep. Long durations that get refreshed, so the effects come
#    back by themselves after a death without ever ticking down visibly.
effect @a[tag=ssgm_god] resistance 20 255 true
effect @a[tag=ssgm_god] fire_resistance 20 255 true
effect @a[tag=ssgm_god] water_breathing 20 255 true
effect @a[tag=ssgm_god] regeneration 20 4 true
effect @a[tag=ssgm_god] saturation 20 255 true
effect @a[tag=ssgm_god] night_vision 20 255 true
effect @a[tag=ssgm_god] strength 20 1 true
effect @a[tag=ssgm_god] haste 20 1 true

# 7) Clear the per-tick scratch tags.
tag @a remove ssgm_cycle
tag @a remove ssgm_godtoggle
tag @a remove ssgm_vdone
tag @a remove ssgm_gdone

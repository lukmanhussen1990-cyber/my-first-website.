# God mode OFF. Clear each effect by name rather than "effect @s clear" so
# that potions the player drank themselves are left alone.
tag @s remove ssgm_god
tag @s add ssgm_gdone
effect @s resistance 0
effect @s fire_resistance 0
effect @s water_breathing 0
effect @s regeneration 0
effect @s saturation 0
effect @s night_vision 0
effect @s strength 0
effect @s haste 0
title @s actionbar §c§lGOD MODE OFF§r §7- you can die again
playsound beacon.deactivate @s ~ ~ ~ 1 0.9

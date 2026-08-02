execute if block ~1 ~ ~0 wheat["growth"=7] run setblock ~1 ~ ~0 air destroy
execute if block ~1 ~-1 ~0 farmland if block ~1 ~ ~0 air run setblock ~1 ~ ~0 wheat
execute if block ~-1 ~ ~0 wheat["growth"=7] run setblock ~-1 ~ ~0 air destroy
execute if block ~-1 ~-1 ~0 farmland if block ~-1 ~ ~0 air run setblock ~-1 ~ ~0 wheat
execute if block ~0 ~ ~1 wheat["growth"=7] run setblock ~0 ~ ~1 air destroy
execute if block ~0 ~-1 ~1 farmland if block ~0 ~ ~1 air run setblock ~0 ~ ~1 wheat
execute if block ~0 ~ ~-1 wheat["growth"=7] run setblock ~0 ~ ~-1 air destroy
execute if block ~0 ~-1 ~-1 farmland if block ~0 ~ ~-1 air run setblock ~0 ~ ~-1 wheat
execute if block ~2 ~ ~0 wheat["growth"=7] run setblock ~2 ~ ~0 air destroy
execute if block ~2 ~-1 ~0 farmland if block ~2 ~ ~0 air run setblock ~2 ~ ~0 wheat
execute if block ~0 ~ ~2 wheat["growth"=7] run setblock ~0 ~ ~2 air destroy
execute if block ~0 ~-1 ~2 farmland if block ~0 ~ ~2 air run setblock ~0 ~ ~2 wheat
particle minecraft:villager_happy ~ ~1 ~

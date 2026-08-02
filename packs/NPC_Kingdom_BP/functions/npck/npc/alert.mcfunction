tag @s add npck_alerted
scoreboard players set @s npck.order 4
event entity @s npck:order_defend
execute if entity @s[tag=!npck_shouted] run function npck/npc/alert_shout

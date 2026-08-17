# Atmosphere, every 5s.
scoreboard players set #cd_atmo li_sys 10
execute as @a[scores={li_chapter=1..}] at @s unless entity @e[type=li:sensor,r=8,c=1] run summon li:sensor ~ ~1 ~
execute as @a[scores={li_chapter=1..}] at @s run tp @e[type=li:sensor,c=1,r=40] ~ ~1 ~
execute as @a[scores={li_chapter=1..},tag=!li_night] at @s if entity @e[type=li:sensor,family=li_night,r=8,c=1] run function li_atmo/night_start
execute as @a[tag=li_night] at @s if entity @e[type=li:sensor,family=li_day,r=8,c=1] run function li_atmo/night_end
execute as @a[scores={li_chapter=1..},tag=!li_fog_swamp,x=-160,y=40,z=-25,dx=105,dy=60,dz=85] run function li_atmo/fog_swamp_on
execute as @a[tag=li_fog_swamp] unless entity @s[x=-160,y=40,z=-25,dx=105,dy=60,dz=85] run function li_atmo/fog_swamp_off
execute as @a[scores={li_chapter=1..},tag=!li_fog_fac,y=12,dy=42] run function li_atmo/fog_fac_on
execute as @a[tag=li_fog_fac] unless entity @s[y=12,dy=42] run function li_atmo/fog_fac_off
execute as @a[tag=li_night] at @s if score #rand li_sys matches 4 run playsound ambient.weather.thunder @s ~ ~ ~ 0.25 0.7
execute as @a[y=12,dy=42] at @s if score #rand li_sys matches 9 run playsound ambient.cave @s ~ ~ ~ 0.5 0.8
scoreboard players add #count li_sys 1
execute if score #count li_sys matches 60.. run function li_atmo/weather_roll

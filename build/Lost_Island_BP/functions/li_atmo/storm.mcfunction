scoreboard players set #storm li_sys 1
weather thunder 900
execute as @a[scores={li_chapter=1..}] run fog @s push li:storm_fog li_storm
tellraw @a {"rawtext":[{"text":"§8[§eLost Island§8] §7A storm is coming in off the water."}]}
execute as @a[scores={li_chapter=1..}] run playsound ambient.weather.thunder @s ~ ~ ~ 0.8 0.7

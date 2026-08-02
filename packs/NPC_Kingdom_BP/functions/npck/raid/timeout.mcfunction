scoreboard players set #raidactive npck.sys 0
scoreboard players set #raidlen npck.sys 0
scoreboard players set #raidt npck.sys 0
kill @e[family=npck_enemy,r=200]
tellraw @a {"rawtext":[{"text":"\u00a7a[WAR] \u00a7fThe enemy has withdrawn into the wilderness."}]}
execute as @e[family=npck,r=96] run scoreboard players set @s npck.order 0
execute as @e[family=npck,r=96] at @s run function npck/orders/apply_silent

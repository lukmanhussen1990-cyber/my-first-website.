scoreboard players add #raidlen npck.sys 1
execute unless entity @e[family=npck_enemy,r=120] run function npck/raid/victory
execute if score #raidlen npck.sys matches 300.. run function npck/raid/timeout

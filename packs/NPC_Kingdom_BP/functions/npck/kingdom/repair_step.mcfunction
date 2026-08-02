scoreboard players add #repairq npck.sys 1
execute if score #repairq npck.sys matches 20.. run scoreboard players set #repairq npck.sys 0
execute if score #repairq npck.sys matches 0 if score #buildq npck.sys matches 1.. run function npck/place/house_1
execute if score #repairq npck.sys matches 1 if score #buildq npck.sys matches 2.. run function npck/place/house_2
execute if score #repairq npck.sys matches 2 if score #buildq npck.sys matches 3.. run function npck/place/storage
execute if score #repairq npck.sys matches 3 if score #buildq npck.sys matches 4.. run function npck/place/house_3
execute if score #repairq npck.sys matches 4 if score #buildq npck.sys matches 5.. run function npck/place/house_4
execute if score #repairq npck.sys matches 5 if score #buildq npck.sys matches 6.. run function npck/place/farm
execute if score #repairq npck.sys matches 6 if score #buildq npck.sys matches 7.. run function npck/place/town_hall
execute if score #repairq npck.sys matches 7 if score #buildq npck.sys matches 8.. run function npck/place/market
execute if score #repairq npck.sys matches 8 if score #buildq npck.sys matches 9.. run function npck/place/blacksmith
execute if score #repairq npck.sys matches 9 if score #buildq npck.sys matches 10.. run function npck/place/guard_tower
execute if score #repairq npck.sys matches 10 if score #buildq npck.sys matches 11.. run function npck/place/barracks
execute if score #repairq npck.sys matches 11 if score #buildq npck.sys matches 12.. run function npck/place/training_ground
execute if score #repairq npck.sys matches 12 if score #buildq npck.sys matches 13.. run function npck/place/hospital
execute if score #repairq npck.sys matches 13 if score #buildq npck.sys matches 14.. run function npck/place/stable
execute if score #repairq npck.sys matches 14 if score #buildq npck.sys matches 15.. run function npck/place/prison
execute if score #repairq npck.sys matches 15 if score #buildq npck.sys matches 16.. run function npck/place/walls
execute if score #repairq npck.sys matches 16 if score #buildq npck.sys matches 17.. run function npck/place/main_gate
execute if score #repairq npck.sys matches 17 if score #buildq npck.sys matches 18.. run function npck/place/castle
execute if score #repairq npck.sys matches 18 if score #buildq npck.sys matches 19.. run function npck/place/throne_room
execute if score #repairq npck.sys matches 19 if score #buildq npck.sys matches 20.. run function npck/place/treasury
playsound random.anvil_land @a[r=48] ~ ~ ~

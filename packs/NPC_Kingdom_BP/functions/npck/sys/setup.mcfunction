# Objectives are created once and then persist with the world.
scoreboard objectives add npck.res dummy "§6§lKINGDOM STORAGE"
scoreboard objectives add npck.sys dummy npckSystem
scoreboard objectives add npck.order dummy npckOrder
scoreboard objectives add npck.job dummy npckJob
scoreboard objectives add npck.rec dummy npckRecruit
scoreboard players add Food npck.res 0
scoreboard players add Wood npck.res 0
scoreboard players add Stone npck.res 0
scoreboard players add Iron npck.res 0
scoreboard players add Gold npck.res 0
scoreboard players add Emeralds npck.res 0
scoreboard players add #founded npck.sys 0
scoreboard players add #level npck.sys 0
scoreboard players add #clock npck.sys 0
scoreboard players add #buildq npck.sys 0
scoreboard players add #buildt npck.sys 0
scoreboard players add #jobt npck.sys 0
scoreboard players add #raidt npck.sys 0
scoreboard players add #raidlen npck.sys 0
scoreboard players add #raidactive npck.sys 0
scoreboard players add #wave npck.sys 0
scoreboard players add #dir npck.sys 0
scoreboard players add #bossdue npck.sys 0
scoreboard players add #daystate npck.sys 0
scoreboard players add #celebt npck.sys 0
scoreboard players add #repairq npck.sys 0
scoreboard players add #ord npck.sys 0
scoreboard players add #prodmsg npck.sys 0
scoreboard players add #buildwarn npck.sys 0
scoreboard players set #c3 npck.sys 3
scoreboard players set #c4 npck.sys 4
scoreboard objectives setdisplay sidebar npck.res

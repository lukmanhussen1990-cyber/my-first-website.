scoreboard players set #raidactive npck.sys 0
scoreboard players set #raidlen npck.sys 0
scoreboard players set #raidt npck.sys 0
titleraw @a title {"rawtext":[{"text":"\u00a7a\u00a7lVICTORY!"}]}
tellraw @a {"rawtext":[{"text":"\u00a7a\u00a7l[VICTORY] \u00a7r\u00a7aVictory! The enemy has retreated!"}]}
scoreboard players add Emeralds npck.res 12
scoreboard players add Gold npck.res 16
scoreboard players add Iron npck.res 24
function npck/kingdom/celebrate

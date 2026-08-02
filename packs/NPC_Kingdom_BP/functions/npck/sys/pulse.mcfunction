# runs as/at the Kingdom Core every 2 seconds
function npck/npc/maintain
function npck/npc/jobs
execute if entity @e[type=npck:kingdom_core,family=npck_night] run function npck/npc/night
execute if entity @e[type=npck:kingdom_core,family=npck_day] run function npck/npc/day
function npck/kingdom/upgrade_check
function npck/kingdom/build_step
function npck/raid/timer

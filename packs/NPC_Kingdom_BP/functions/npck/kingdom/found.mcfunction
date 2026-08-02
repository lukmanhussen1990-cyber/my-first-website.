tag @s add npck_init
function npck/sys/setup
execute if score #founded npck.sys matches 1.. run function npck/kingdom/reject
execute unless score #founded npck.sys matches 1.. run function npck/kingdom/establish

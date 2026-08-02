scoreboard players set #buildt npck.sys 0
execute if entity @e[family=npck_builder,r=72] run function npck/kingdom/build_next
execute unless entity @e[family=npck_builder,r=72] run function npck/kingdom/need_builder

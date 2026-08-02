summon npck:bandit ~2 ~3 ~2
summon npck:bandit ~-2 ~3 ~-2
summon npck:raider ~3 ~3 ~-3
summon npck:enemy_archer ~-3 ~3 ~3
execute if score #level npck.sys matches 3.. run summon npck:dark_knight ~ ~3 ~4
execute if score #level npck.sys matches 4.. run summon npck:enemy_wizard ~ ~3 ~-4
execute if score #level npck.sys matches 3.. run summon npck:bandit_king ~ ~4 ~

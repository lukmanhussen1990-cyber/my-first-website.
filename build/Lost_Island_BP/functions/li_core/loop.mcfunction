# Per-tick work: 3 commands while idle.
scoreboard players add #tick li_sys 1
execute if score #tick li_sys matches 10.. run function li_core/half_sec
execute if score #build li_sys matches 1 run function li_build/dispatch

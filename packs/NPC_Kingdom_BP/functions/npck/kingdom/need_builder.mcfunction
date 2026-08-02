scoreboard players add #buildwarn npck.sys 1
execute if score #buildwarn npck.sys matches 30.. run scoreboard players set #buildwarn npck.sys 0
execute if score #buildwarn npck.sys matches 1 if score #buildq npck.sys matches ..19 run tellraw @a[r=64] {"rawtext":[{"text":"\u00a7e[Kingdom] \u00a7fNo Builder is present - construction has stopped."}]}

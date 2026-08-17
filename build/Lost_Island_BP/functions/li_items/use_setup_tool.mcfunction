clear @s li:setup_tool_used
give @s li:setup_tool 1
execute if score #built li_sys matches ..0 run function li_build/start
execute if score #built li_sys matches 1.. run function li_dev/rebuild_warn

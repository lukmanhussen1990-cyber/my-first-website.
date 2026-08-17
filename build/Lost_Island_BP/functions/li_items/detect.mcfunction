# Detects marker items produced by minecraft:food/using_converts_to.
# Runs twice per second from li_core/half_sec. One command per item.
execute as @a[hasitem={item=li:clean_water_used}] at @s run function li_items/use_clean_water
execute as @a[hasitem={item=li:dirty_water_used}] at @s run function li_items/use_dirty_water
execute as @a[hasitem={item=li:boiled_water_used}] at @s run function li_items/use_boiled_water
execute as @a[hasitem={item=li:canned_beans_used}] at @s run function li_items/use_canned_beans
execute as @a[hasitem={item=li:canned_meat_used}] at @s run function li_items/use_canned_meat
execute as @a[hasitem={item=li:bandage_used}] at @s run function li_items/use_bandage
execute as @a[hasitem={item=li:first_aid_used}] at @s run function li_items/use_first_aid
execute as @a[hasitem={item=li:battery_used}] at @s run function li_items/use_battery
execute as @a[hasitem={item=li:flashlight_off_used}] at @s run function li_items/use_flashlight_off
execute as @a[hasitem={item=li:flashlight_on_used}] at @s run function li_items/use_flashlight_on
execute as @a[hasitem={item=li:crowbar_used}] at @s run function li_items/use_crowbar
execute as @a[hasitem={item=li:keycard_used}] at @s run function li_items/use_keycard
execute as @a[hasitem={item=li:bunker_key_used}] at @s run function li_items/use_bunker_key
execute as @a[hasitem={item=li:radio_part_used}] at @s run function li_items/use_radio_part
execute as @a[hasitem={item=li:fuel_can_used}] at @s run function li_items/use_fuel_can
execute as @a[hasitem={item=li:mech_part_used}] at @s run function li_items/use_mech_part
execute as @a[hasitem={item=li:nav_gear_used}] at @s run function li_items/use_nav_gear
execute as @a[hasitem={item=li:flare_used}] at @s run function li_items/use_flare
execute as @a[hasitem={item=li:documents_used}] at @s run function li_items/use_documents
execute as @a[hasitem={item=li:matches_used}] at @s run function li_items/use_matches
execute as @a[hasitem={item=li:setup_tool_used}] at @s run function li_items/use_setup_tool
execute as @a[hasitem={item=li:debug_tool_used}] at @s run function li_items/use_debug_tool

# Runs every tick. Throttles the heavy work down to roughly 2.5x per second
# so phones and tablets stay smooth.

scoreboard objectives add da_clock dummy
scoreboard players add clock da_clock 1
execute if score clock da_clock matches 8.. run function devil_angel/pulse
execute if score clock da_clock matches 8.. run scoreboard players set clock da_clock 0

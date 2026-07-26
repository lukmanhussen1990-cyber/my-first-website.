# MAIN ENTRY POINT - run /function house/build

# Builds the whole compound around you. Needs cheats enabled.
# Stand where you want the middle of the living room to be.
function house/clear
function house/foundation
function house/perimeter
function house/shell
function house/vault
function house/interior
function house/lights
function house/security

tellraw @s {"rawtext":[{"text":"§aSecurity house built.§r Load the dispensers with arrows, and use the levers to work the iron doors."}]}

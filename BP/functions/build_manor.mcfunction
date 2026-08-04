# Manual manor build. Type this in chat:  /function build_manor
# This needs no scripts at all - it is the fallback when the script engine is
# not running. Safe to run more than once; it clears and rebuilds.
gamerule keepinventory true
gamerule domobspawning false
gamerule dodaylightcycle false
gamerule doweathercycle false
gamerule showcoordinates true
time set 16000
weather rain 999999
tickingarea remove_all
tickingarea add circle 1015 65 1022 4 ag_manor
setworldspawn 1015 65 1000
function ag_build/00_clear
function ag_build/01_moor
function ag_build/02_foyer
function ag_build/03_nursery
function ag_build/04_cellar
function ag_build/05_mirror_wing
function ag_build/06_gallery
function ag_build/07_attic
function ag_build/08_props
give @a ag:manor_key 1
give @a ag:tallow_candle 1
give @a ag:manor_journal 1
give @a ag:salt_pouch 12
give @a ag:tallow 2
give @a ag:cracked_monocle 1
give @a ag:bone_camera 1
give @a ag:seance_bell 1
tp @a 1015 65 996

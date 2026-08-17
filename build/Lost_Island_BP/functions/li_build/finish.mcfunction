# Finalises the build and starts the story.
scoreboard players set #build li_sys 0
scoreboard players set #built li_sys 1
gamerule sendcommandfeedback false
setworldspawn 6 64 146
spawnpoint @a 6 64 146
tp @a 6 64 146 180 0
titleraw @a actionbar {"rawtext":[{"text":"§aIsland ready."}]}
playsound random.levelup @a
execute as @a[scores={li_chapter=..0}] run function li_story/chapter_1

#!/usr/bin/env python3
"""All gameplay systems for Lost Island: Abandoned, as Bedrock functions.

There is NO script API anywhere in this add-on. Everything below is built from
commands that exist in Bedrock 1.21.0:
  scoreboard, execute (modern chained form), tag, tellraw, titleraw, effect,
  give, clear, summon, kill, playsound, particle, weather, fog, time,
  gamerule, tp, spawnpoint, function, loot, setblock, fill.

Scheduling model
----------------
tick.json runs ONE tiny function per tick. It counts to 10 and then hands off
to li_core/half_sec, which decrements a countdown per subsystem and only calls
a subsystem when its countdown expires. Cost per tick at idle is 3 commands.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "build", "Lost_Island_BP")
FN = os.path.join(BP, "functions")
OUT = os.path.join(ROOT, "tools", "out")

# ---------------------------------------------------------------------------
STORY = {
    1: ("STRANDED", "Find shelter and basic supplies before nightfall.",
        "You wake face-down in wet sand. The boat is gone - most of it."),
    2: ("SIGNS OF LIFE", "Follow the road inland and find the village.",
        "Someone lived here. Not recently."),
    3: ("NO SIGNAL", "Reach the radio tower on the eastern hill.",
        "If anything still transmits on this island, it is up there."),
    4: ("THE EVACUATION", "Search the harbour and learn why the ships never left.",
        "They queued here. Thousands of them. Then something turned them back."),
    5: ("RESTRICTED", "Force the military checkpoint and reach the north.",
        "The army sealed the north road. They were keeping something in."),
    6: ("BELOW", "Find a way into the underground research complex.",
        "Everything on this island points down."),
    7: ("THE TRUTH", "Reach the sealed room beneath the facility.",
        "The last door. Whatever they did, the record of it is behind it."),
    8: ("ESCAPE", "Gather the escape components and repair the lighthouse radio.",
        "There is a way off this island. Build it."),
}

NOTE_TEXT = {
    1: ("weathered sign", "TURN BACK. The interior is not safe. Do not follow the road after dark. - M."),
    2: ("soaked manifest", "PASSENGER MANIFEST - 6 aboard. Destination: mainland. Weather advisory ignored. Only one name is not crossed out. Yours."),
    3: ("village notice", "TOWN NOTICE: Mandatory health screening at the clinic. Attendance is not optional. By order of the Site Administrator."),
    4: ("torn diary page", "Third week of the screenings. Nobody comes back from the north road and nobody will say why. The children have stopped asking."),
    5: ("evacuation leaflet", "EVACUATION - Proceed to the harbour with one bag. Transport departs at first light. DO NOT go to the harbour if you have a fever."),
    6: ("shop ledger", "Stopped restocking. Nobody pays any more. The soldiers took the rest of the tinned food on Tuesday."),
    7: ("pump note", "Out of fuel. Out of patience. If you are reading this I already walked north. Do not follow me."),
    8: ("motel register", "Room 4 - researcher, 11 nights, no name given. Room 7 - soldier, would not sleep. Room 9 - checked in, never checked out."),
    9: ("triage board", "TRIAGE: green - send home. Amber - observation. Red - transfer NORTH. Nobody transferred north has returned. Stop marking red."),
    10: ("quarantine order", "By order of Site Command this building is a quarantine ward. Staff will not discuss patient transfers with residents."),
    11: ("incident report", "Report 41: two more residents walked into the treeline and did not come out. Witness describes a tall figure watching from the ridge."),
    12: ("radio log", "0300 - contacted mainland. Told to hold position and await instruction. No instruction ever came."),
    13: ("station log", "Every alarm on the island went off at once. Then the power went. We drove north because we were told to."),
    14: ("ranger journal", "The animals left before we did. Whole valleys went quiet in a single night. That was the first real warning."),
    15: ("ranger map note", "Marked the tower, the dam and the north gate. Do not mark the facility. They ask about maps."),
    16: ("tower logbook", "Transmitter still works on emergency power. Message repeats: SITE COMPROMISED, DO NOT LAND, DO NOT SEND PERSONNEL."),
    17: ("last transmission", "...anyone receiving, this is Lost Island relay, we are the last four. The north gate is open. Repeat, the gate is OPEN."),
    18: ("keeper's note", "Kept the lamp lit for six weeks after the ships stopped. Somebody should be able to find their way out of here."),
    19: ("bench schematic", "EMERGENCY RADIO - needs a working component, a charged battery, fuel for the generator, a drive part and navigation gear. Then send."),
    20: ("bridge notice", "BRIDGE DESTROYED BY ORDER OF SITE COMMAND. Crossing the river is prohibited. Violators will be detained."),
    21: ("dam maintenance log", "Told to keep the turbines running for the facility no matter what. No maintenance crew has come up in nine days."),
    22: ("mine notice", "Shaft closed. Survey crew broke into a corridor that is not on any of our plans. Company says stop digging and say nothing."),
    23: ("fisher's log", "Nets keep coming up empty and torn. Something in the shallows at night. I am done fishing this coast."),
    24: ("swamp hut scrawl", "Safer out here than in town. They do not come this far into the water. Do not light fires after dark."),
    25: ("deep mine note", "We hit concrete. Two hundred metres down, under a mountain, and it was CONCRETE. It was already old."),
    26: ("harbour manifest", "Sailing list, final day: 812 names. Boarded: 0. Reason given: medical hold, Site Command."),
    27: ("evacuation failure notice", "HOLD ALL DEPARTURES. Nobody leaves the island until screening is complete. Soldiers turned the queue around at the gangway."),
    28: ("ferry log", "Engine ready, crew ready, orders never came. They shot the mooring lines rather than let us sail."),
    29: ("freighter log", "Sent to collect survivors. Ordered to turn about while still in sight of the harbour lights. We refused. We ran aground."),
    30: ("checkpoint order", "STANDING ORDER: this road is closed in both directions. Nothing walks south. Use force if required."),
    31: ("camp order", "Containment has failed at the facility. Fall back to the camp. Do not attempt to re-enter the lower levels."),
    32: ("camp last transmission", "We are the last unit on the island. The specimens are out of the cells. We are not equipped for this."),
    33: ("airstrip manifest", "Outbound flights cancelled indefinitely. Aircraft grounded on Site Command authority. Fuel requisitioned by the facility."),
    34: ("grounded crew note", "They took the fuel for the generators and left us the plane. A plane with no fuel is a very large paperweight."),
    35: ("intake log", "SITE 7 - established to study an anomaly found during island survey works. Local population unaware. Keep it that way."),
    36: ("incident summary", "Incident 12: containment breach in the lower cells. Three specimens unaccounted for. Site Command has declined evacuation."),
    37: ("quarantine directive", "Quarantine the north. Quarantine the village. Quarantine the harbour. Under no circumstances quarantine the facility on paper."),
    38: ("bunker log", "Sealed the blast door from the inside. Whatever is below us learned how the doors work. We are out of water."),
    39: ("hidden stash note", "If you found this you got further than we did. Keycard is in the deep cells. The alpha carries it now."),
    40: ("final record", "The anomaly was here before the island had a name. We did not create anything. We WOKE something, and then we studied it until it studied us."),
    41: ("director's confession", "I signed the order that kept the ships in port. Eight hundred people. I told myself containment was mercy. It was arithmetic."),
    42: ("cell block tally", "Cell 1 - empty. Cell 2 - empty. Cell 3 - door opened from the inside. Cell 4 - do not open."),
    50: ("buried cache note", "Buried what I could not carry. If you are reading this I did not make it back for it."),
    51: ("cache note", "Took what we needed from the camp. Left the rest for whoever comes next. Good luck."),
    52: ("stash note", "Third cache. Moving north tomorrow. If there is no fourth note, do not go north."),
    53: ("hermit's note", "Been out here since the screenings. Seen the tall one twice. It only watches. That is worse."),
    54: ("driftwood note", "Rafts do not work. The current takes you straight back. I have tried four times."),
    55: ("supply drop note", "Air-dropped and never collected. Half of it had already been taken when we found it."),
    56: ("survey note", "Ground penetrating survey shows a void under the whole northern plateau. Nobody ordered this survey."),
    57: ("scratched tally", "Sixty-one days. Still alone. Still here."),
    58: ("torn page", "...and the birds came back last week. That has to mean something good. It has to."),
    59: ("centre marker", "Geodetic marker - island centre. Someone has scratched underneath it: IT IS DIRECTLY BELOW YOU."),
    60: ("corner cache", "Whoever built this island's records room kept a copy of everything out here, off the books."),
}


def w(path, lines, header=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    body = []
    if header:
        body.append("# " + header)
    body.extend(lines)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(body) + "\n")


def raw(text):
    """A rawtext JSON payload for tellraw/titleraw."""
    return json.dumps({"rawtext": [{"text": text}]},
                      separators=(",", ":"), ensure_ascii=False)


def raw_parts(parts):
    """parts: list of str (literal) or ("score", objective)."""
    rt = []
    for p in parts:
        if isinstance(p, tuple):
            rt.append({"score": {"name": "*", "objective": p[1]}})
        else:
            rt.append({"text": p})
    return json.dumps({"rawtext": rt}, separators=(",", ":"),
                      ensure_ascii=False)


def box_sel(box, extra=""):
    """Bedrock volume selector from [x1,y1,z1,x2,y2,z2]."""
    x1, y1, z1, x2, y2, z2 = box
    x1, x2 = min(x1, x2), max(x1, x2)
    y1, y2 = min(y1, y2), max(y1, y2)
    z1, z2 = min(z1, z2), max(z1, z2)
    s = "x=%d,y=%d,z=%d,dx=%d,dy=%d,dz=%d" % (
        x1, y1, z1, x2 - x1, y2 - y1, z2 - z1)
    return s + ("," + extra if extra else "")


# ===========================================================================
def gen_core(total_steps, t_steps):
    w(os.path.join(FN, "tick.json"), [], None)
    with open(os.path.join(FN, "tick.json"), "w") as f:
        json.dump({"values": ["li_core/tick"]}, f, indent=2)

    # The boot guard is an entity test, never a score test: testing a score on
    # an objective that does not exist yet would fail and deadlock.
    w(os.path.join(FN, "li_core", "tick.mcfunction"), [
        "execute unless entity @a[tag=li_sys_on,c=1] run function li_core/boot",
        "execute if entity @a[tag=li_sys_on,c=1] run function li_core/loop",
    ], "Entry point (tick.json). 2 commands per tick.")

    boot = ['scoreboard objectives add %s dummy "%s"' % (n, d) for n, d in [
        ("li_sys", "LI System"), ("li_chapter", "Chapter"),
        ("li_thirst", "Thirst"), ("li_temp", "Temperature"),
        ("li_exh", "Exhaustion"), ("li_bat", "Battery"),
        ("li_flag", "Flags"), ("li_esc", "Escape Parts"),
        ("li_obj", "Objective"), ("li_tmp", "Scratch"),
        ("li_pct", "Water Percent")]]
    boot += [
        "scoreboard players set #tick li_sys 0",
        "scoreboard players set #sec li_sys 0",
        "scoreboard players set #build li_sys 0",
        "scoreboard players set #step li_sys 0",
        "scoreboard players set #grp li_sys 0",
        "scoreboard players set #idx li_sys 0",
        "scoreboard players set #built li_sys 0",
        "scoreboard players set #count li_sys 0",
        "scoreboard players set #storm li_sys 0",
        "scoreboard players set #watch li_sys 0",
        "scoreboard players set #rand li_sys 0",
        "scoreboard players set #zgrp li_sys 0",
        "scoreboard players set #c12 li_sys 12",
        "scoreboard players set #c20 li_sys 20",
        "scoreboard players set #cd_hud li_sys 2",
        "scoreboard players set #cd_thirst li_sys 12",
        "scoreboard players set #cd_temp li_sys 6",
        "scoreboard players set #cd_exh li_sys 4",
        "scoreboard players set #cd_tor li_sys 2",
        "scoreboard players set #cd_atmo li_sys 10",
        "scoreboard players set #cd_enc li_sys 20",
        "scoreboard players set #cd_esc li_sys 4",
        "tag @a add li_sys_on",
    ]
    w(os.path.join(FN, "li_core", "boot.mcfunction"), boot,
      "Runs once per world (guarded by the li_sys_on tag).")

    w(os.path.join(FN, "li_core", "loop.mcfunction"), [
        "scoreboard players add #tick li_sys 1",
        "execute if score #tick li_sys matches 10.. run function li_core/half_sec",
        "execute if score #build li_sys matches 1 run function li_build/dispatch",
    ], "Per-tick work: 3 commands while idle.")

    half = [
        "scoreboard players set #tick li_sys 0",
        "scoreboard players add #sec li_sys 1",
        "execute if score #sec li_sys matches 100000.. run scoreboard players set #sec li_sys 0",
        # pseudo-random 0..19, good enough for gameplay chance rolls
        "scoreboard players operation #rand li_sys = #sec li_sys",
        "scoreboard players operation #rand li_sys %= #c20 li_sys",
        "execute as @a[tag=!li_init] run function li_core/player_init",
        "function li_items/detect",
        "execute if score #built li_sys matches ..0 run function li_items/hold_check",
        # countdown-gated subsystems
        "scoreboard players remove #cd_hud li_sys 1",
        "execute if score #cd_hud li_sys matches ..0 run function li_surv/hud",
        "scoreboard players remove #cd_thirst li_sys 1",
        "execute if score #cd_thirst li_sys matches ..0 run function li_surv/thirst",
        "scoreboard players remove #cd_temp li_sys 1",
        "execute if score #cd_temp li_sys matches ..0 run function li_surv/temp",
        "scoreboard players remove #cd_exh li_sys 1",
        "execute if score #cd_exh li_sys matches ..0 run function li_surv/exh",
        "scoreboard players remove #cd_tor li_sys 1",
        "execute if score #cd_tor li_sys matches ..0 run function li_items/flashlight",
        "scoreboard players remove #cd_atmo li_sys 1",
        "execute if score #cd_atmo li_sys matches ..0 run function li_atmo/tick",
        "scoreboard players remove #cd_enc li_sys 1",
        "execute if score #cd_enc li_sys matches ..0 run function li_mobs/encounters",
        "scoreboard players remove #cd_esc li_sys 1",
        "execute if score #cd_esc li_sys matches ..0 run function li_story/escape_check",
        "function li_story/zones",
    ]
    w(os.path.join(FN, "li_core", "half_sec.mcfunction"), half,
      "Twice per second. Each subsystem is countdown-gated.")

    w(os.path.join(FN, "li_core", "player_init.mcfunction"), [
        "tag @s add li_init",
        "tag @s add li_sys_on",
        "scoreboard players set @s li_thirst 1200",
        "scoreboard players set @s li_temp 0",
        "scoreboard players set @s li_exh 0",
        "scoreboard players add @s li_bat 0",
        "scoreboard players add @s li_chapter 0",
        "scoreboard players add @s li_esc 0",
        "scoreboard players add @s li_obj 0",
        "scoreboard players add @s li_flag 0",
        "execute if score @s li_chapter matches 0 run function li_story/intro",
    ], "First-join setup for one player.")

    w(os.path.join(FN, "li_core", "offer_kit.mcfunction"), [
        "give @s li:setup_tool 1",
        "tellraw @s %s" % raw("§8[§eLost Island§8] §fYou have been given the "
                              "§eStart Kit§f."),
        "tellraw @s %s" % raw("§7Put it in your hand and §fhold it for 3 "
                              "seconds§7 to build the island."),
        "tellraw @s %s" % raw("§7Use a §fnew world§7 - it rewrites terrain "
                              "around 0,0."),
        "playsound random.orb @s ~ ~ ~ 0.7 1.4",
    ], "First join, island not built yet: hand over the Start Kit.")

    w(os.path.join(FN, "li_core", "reset.mcfunction"), [
        "tag @s remove li_init",
        "scoreboard players set @s li_chapter 0",
        "scoreboard players set @s li_thirst 1200",
        "scoreboard players set @s li_temp 0",
        "scoreboard players set @s li_exh 0",
        "scoreboard players set @s li_bat 0",
        "scoreboard players set @s li_esc 0",
        "tellraw @s %s" % raw("§7Lost Island progress reset for you."),
    ], "Reset one player's progress (does not rebuild the island).")


# ===========================================================================
def gen_build(t_index, l_index):
    t_count = t_index["count"]
    l_count = l_index["count"]
    total = t_count + l_count
    labels = {}
    for k, v in t_index["labels"].items():
        labels[int(k)] = v
    for k, v in l_index["labels"].items():
        labels[int(k) + t_count] = v

    GROUP = 20
    groups = (total + GROUP - 1) // GROUP

    w(os.path.join(FN, "li_build", "start.mcfunction"), [
        "scoreboard players set #build li_sys 1",
        "scoreboard players set #step li_sys 0",
        "scoreboard players set #grp li_sys 0",
        "scoreboard players set #idx li_sys -1",
        "gamerule sendcommandfeedback false",
        "gamerule commandblockoutput false",
        "gamerule dodaylightcycle true",
        "gamerule showcoordinates true",
        "gamerule naturalregeneration false",
        "weather clear 600",
        "time set 1000",
        "tellraw @a %s" % raw("§8[§eLost Island§8] §7Building the island. "
                              "Do not leave the world."),
        "titleraw @a times 5 40 10",
        "titleraw @a title %s" % raw("§eLOST ISLAND"),
        "titleraw @a subtitle %s" % raw("§7building the world..."),
    ], "Kicks off the staged island build.")

    # dispatcher: two levels so the per-tick cost stays ~40 command tests
    disp = [
        "scoreboard players add #idx li_sys 1",
        "execute if score #idx li_sys matches %d.. run function li_build/nextgrp"
        % GROUP,
    ]
    for g in range(groups):
        disp.append("execute if score #grp li_sys matches %d run function "
                    "li_build/g%02d" % (g, g))
    disp.append("execute if score #grp li_sys matches %d.. run function "
                "li_build/finish" % groups)
    w(os.path.join(FN, "li_build", "dispatch.mcfunction"), disp,
      "Runs one build step per tick.")

    w(os.path.join(FN, "li_build", "nextgrp.mcfunction"), [
        "scoreboard players set #idx li_sys 0",
        "scoreboard players add #grp li_sys 1",
    ])

    for g in range(groups):
        lines = []
        pct = int(100.0 * g / max(1, groups))
        cap = None
        for i in range(GROUP):
            step = g * GROUP + i
            if step >= total:
                break
            if step in labels:
                cap = labels[step]
            if step < t_count:
                fn = "li_build/t/s%03d" % step
            else:
                fn = "li_build/l/s%03d" % (step - t_count)
            lines.append("execute if score #idx li_sys matches %d run "
                         "function %s" % (i, fn))
        caption = cap or "Building"
        lines.insert(0, "titleraw @a actionbar %s"
                     % raw("§7%s... §f%d%%" % (caption, pct)))
        w(os.path.join(FN, "li_build", "g%02d.mcfunction" % g), lines)

    w(os.path.join(FN, "li_build", "finish.mcfunction"), [
        "scoreboard players set #build li_sys 0",
        "scoreboard players set #built li_sys 1",
        "gamerule sendcommandfeedback false",
        "setworldspawn 6 64 146",
        "spawnpoint @a 6 64 146",
        "tp @a 6 64 146 180 0",
        "titleraw @a actionbar %s" % raw("§aIsland ready."),
        "playsound random.levelup @a",
        # This runs from the tick chain, which has no executing entity, so the
        # per-player chapter function must be wrapped in an "as @a".
        "execute as @a[scores={li_chapter=..0}] run function li_story/chapter_1",
    ], "Finalises the build and starts the story.")

    # convenience aliases at the pack root
    w(os.path.join(FN, "li_start.mcfunction"), [
        "function li_build/start",
    ], "Player-facing: /function li_start")
    w(os.path.join(FN, "li_kit.mcfunction"), [
        "function li_core/offer_kit",
    ], "Player-facing: /function li_kit")
    w(os.path.join(FN, "li_help.mcfunction"), [
        "tellraw @s %s" % raw("§8[§eLost Island§8] §fCommands:"),
        "tellraw @s %s" % raw("§7 /function li_start §8- build the island"),
        "tellraw @s %s" % raw("§7 /function li_kit §8- get another Start Kit"),
        "tellraw @s %s" % raw("§7 /function li_core/reset §8- reset your progress"),
        "tellraw @s %s" % raw("§7 /function li_dev/giveall §8- creative test kit"),
    ])
    return total, groups


# ===========================================================================
def gen_survival():
    # ------------------------------------------------------------------- HUD
    hud = ["scoreboard players set #cd_hud li_sys 2"]
    hud += [
        "execute as @a[scores={li_chapter=1..}] run scoreboard players operation @s li_pct = @s li_thirst",
        "execute as @a[scores={li_chapter=1..}] run scoreboard players operation @s li_pct /= #c12 li_sys",
    ]
    bands = [
        ("..-60", "§bFreezing"),
        ("-59..-25", "§bCold"),
        ("-24..24", "§aComfortable"),
        ("25..59", "§6Hot"),
        ("60..", "§cOverheating"),
    ]
    for rng, word in bands:
        hud.append(
            "execute as @a[scores={li_chapter=1..,li_temp=%s}] run titleraw @s "
            "actionbar %s" % (rng, raw_parts([
                "§bWater §f", ("score", "li_pct"), "§7%  ",
                "§eTemp %s§7  " % word,
                "§6Torch §f", ("score", "li_bat"), "§7%",
            ])))
    w(os.path.join(FN, "li_surv", "hud.mcfunction"), hud,
      "One actionbar line per player per second.")

    # ---------------------------------------------------------------- thirst
    w(os.path.join(FN, "li_surv", "thirst.mcfunction"), [
        "scoreboard players set #cd_thirst li_sys 12",
        # 3 points every 6s from 1200 = about 40 minutes of walking around
        "execute as @a[scores={li_chapter=1..}] run scoreboard players remove @s li_thirst 3",
        "execute as @a[scores={li_chapter=1..,li_temp=40..}] run scoreboard players remove @s li_thirst 2",
        "execute as @a[scores={li_thirst=..0}] run scoreboard players set @s li_thirst 0",
        "execute as @a[scores={li_thirst=1201..}] run scoreboard players set @s li_thirst 1200",
        # state entry / exit messages, tag-gated so they never spam
        "execute as @a[scores={li_thirst=..399},tag=!li_dry] run function li_surv/thirsty_on",
        "execute as @a[scores={li_thirst=400..},tag=li_dry] run function li_surv/thirsty_off",
        "execute as @a[scores={li_thirst=..119}] at @s run function li_surv/dehydrated",
        "execute as @a[scores={li_thirst=0}] at @s run function li_surv/critical",
    ], "Thirst drain and state effects (every 6s).")

    w(os.path.join(FN, "li_surv", "thirsty_on.mcfunction"), [
        "tag @s add li_dry",
        "titleraw @s actionbar %s" % raw("§6You are thirsty. Find water."),
        "playsound random.burp @s ~ ~ ~ 0.4 0.7",
    ])
    w(os.path.join(FN, "li_surv", "thirsty_off.mcfunction"), [
        "tag @s remove li_dry",
    ])
    w(os.path.join(FN, "li_surv", "dehydrated.mcfunction"), [
        "effect @s weakness 14 0 true",
        "effect @s mining_fatigue 14 0 true",
        "titleraw @s actionbar %s" % raw("§cDehydrated - you need water now."),
    ])
    w(os.path.join(FN, "li_surv", "critical.mcfunction"), [
        "effect @s weakness 12 1 true",
        "effect @s wither 2 0 true",
        "titleraw @s title %s" % raw("§4DEHYDRATED"),
        "playsound mob.warden.heartbeat @s ~ ~ ~ 0.7 0.8",
    ])

    # ------------------------------------------------------------- drinking
    def drink(name, amount, extra=None):
        lines = [
            "clear @s li:%s_used" % name,
            "scoreboard players add @s li_thirst %d" % amount,
            "execute if score @s li_thirst matches 1201.. run scoreboard players set @s li_thirst 1200",
            "playsound random.drink @s ~ ~ ~ 0.8 1.0",
            "give @s minecraft:glass_bottle 1",
            "titleraw @s actionbar %s" % raw("§bWater +%d" % (amount // 12)),
        ]
        if extra:
            lines += extra
        return lines

    w(os.path.join(FN, "li_items", "use_clean_water.mcfunction"),
      drink("clean_water", 400))
    w(os.path.join(FN, "li_items", "use_boiled_water.mcfunction"),
      drink("boiled_water", 600))
    w(os.path.join(FN, "li_items", "use_dirty_water.mcfunction"),
      drink("dirty_water", 250, [
          # roughly a 45% chance of illness, driven by the rolling #rand
          "execute if score #rand li_sys matches 0..8 run function li_items/dirty_sick",
      ]))
    w(os.path.join(FN, "li_items", "dirty_sick.mcfunction"), [
        "effect @s poison 8 0 false",
        "effect @s nausea 12 0 false",
        "titleraw @s actionbar %s" % raw("§2That water was foul."),
        "playsound random.burp @s ~ ~ ~ 0.7 0.6",
    ])

    # ----------------------------------------------------------- temperature
    w(os.path.join(FN, "li_surv", "temp.mcfunction"), [
        "scoreboard players set #cd_temp li_sys 6",
        # drift back toward comfortable
        "execute as @a[scores={li_temp=1..}] run scoreboard players remove @s li_temp 1",
        "execute as @a[scores={li_temp=..-1}] run scoreboard players add @s li_temp 1",
        # night is colder
        "execute as @a[scores={li_chapter=1..}] at @s if entity @e[type=li:sensor,family=li_night,r=6,c=1] run scoreboard players remove @s li_temp 3",
        # storms (this system starts them, so it knows when they are running)
        "execute as @a[scores={li_chapter=1..}] if score #storm li_sys matches 1 run scoreboard players remove @s li_temp 3",
        # altitude
        "execute as @a[scores={li_chapter=1..},y=96,dy=60] run scoreboard players remove @s li_temp 4",
        # standing in water
        "execute as @a[scores={li_chapter=1..}] at @s if block ~ ~ ~ minecraft:water run scoreboard players remove @s li_temp 5",
        # warmth from fire and shelter
        "execute as @a[scores={li_chapter=1..}] at @s if block ~ ~-1 ~ minecraft:campfire run scoreboard players add @s li_temp 8",
        "execute as @a[scores={li_chapter=1..}] at @s if block ~ ~-1 ~ minecraft:torch run scoreboard players add @s li_temp 4",
        "execute as @a[scores={li_chapter=1..}] at @s if block ~ ~-1 ~ li:emergency_light run scoreboard players add @s li_temp 3",
        # low ground in daylight gets hot
        "execute as @a[scores={li_chapter=1..},y=62,dy=12] at @s if entity @e[type=li:sensor,family=li_day,r=6,c=1] run scoreboard players add @s li_temp 2",
        # clamp
        "execute as @a[scores={li_temp=..-100}] run scoreboard players set @s li_temp -100",
        "execute as @a[scores={li_temp=100..}] run scoreboard players set @s li_temp 100",
        # extremes bite
        "execute as @a[scores={li_temp=..-60}] run function li_surv/freezing",
        "execute as @a[scores={li_temp=60..}] run function li_surv/overheating",
    ], "Temperature every 3s. All checks are per-player and bounded.")

    w(os.path.join(FN, "li_surv", "freezing.mcfunction"), [
        "effect @s slowness 6 0 true",
        "scoreboard players add @s li_exh 4",
        "titleraw @s actionbar %s" % raw("§bFreezing - find warmth."),
    ])
    w(os.path.join(FN, "li_surv", "overheating.mcfunction"), [
        "effect @s weakness 6 0 true",
        "scoreboard players remove @s li_thirst 6",
        "scoreboard players add @s li_exh 3",
        "titleraw @s actionbar %s" % raw("§cOverheating - get out of the sun."),
    ])

    # ------------------------------------------------------------ exhaustion
    # Bedrock command syntax cannot detect sprinting or damage taken, so
    # exhaustion is driven by the things it CAN see: time awake, thirst,
    # temperature extremes and whether the player is resting by a fire.
    w(os.path.join(FN, "li_surv", "exh.mcfunction"), [
        "scoreboard players set #cd_exh li_sys 4",
        "execute as @a[scores={li_chapter=1..}] run scoreboard players add @s li_exh 1",
        "execute as @a[scores={li_chapter=1..,li_thirst=..399}] run scoreboard players add @s li_exh 2",
        # resting by a fire recovers
        "execute as @a[scores={li_chapter=1..}] at @s if block ~ ~-1 ~ minecraft:campfire run scoreboard players remove @s li_exh 6",
        "execute as @a[scores={li_chapter=1..}] at @s if block ~ ~-2 ~ minecraft:white_wool run scoreboard players remove @s li_exh 5",
        "execute as @a[scores={li_exh=..0}] run scoreboard players set @s li_exh 0",
        "execute as @a[scores={li_exh=101..}] run scoreboard players set @s li_exh 100",
        "execute as @a[scores={li_exh=70..},tag=!li_tired] run function li_surv/tired_on",
        "execute as @a[scores={li_exh=..69},tag=li_tired] run function li_surv/tired_off",
        "execute as @a[scores={li_exh=70..}] run effect @s mining_fatigue 4 0 true",
        "execute as @a[scores={li_exh=90..}] run effect @s slowness 4 0 true",
    ], "Exhaustion every 2s.")
    w(os.path.join(FN, "li_surv", "tired_on.mcfunction"), [
        "tag @s add li_tired",
        "titleraw @s actionbar %s" % raw("§7You are exhausted. Rest by a fire."),
    ])
    w(os.path.join(FN, "li_surv", "tired_off.mcfunction"), [
        "tag @s remove li_tired",
    ])


# ===========================================================================
def gen_items(markers):
    """One use_* function per marker item."""
    def base(name):
        return ["clear @s li:%s_used" % name]

    simple = {
        "canned_beans": [
            "effect @s saturation 1 4 true",
            "scoreboard players add @s li_thirst 40",
            "scoreboard players remove @s li_exh 8",
            "playsound random.eat @s ~ ~ ~ 0.8 1.0",
            "titleraw @s actionbar %s" % raw("§6You eat the cold beans."),
        ],
        "canned_meat": [
            "effect @s saturation 1 6 true",
            "scoreboard players add @s li_thirst 20",
            "scoreboard players remove @s li_exh 12",
            "playsound random.eat @s ~ ~ ~ 0.8 0.9",
            "titleraw @s actionbar %s" % raw("§6You eat the tinned meat."),
        ],
        "bandage": [
            "effect @s regeneration 4 1 true",
            "effect @s poison 0",
            "playsound random.orb @s ~ ~ ~ 0.5 1.4",
            "titleraw @s actionbar %s" % raw("§fYou dress the wound."),
        ],
        "first_aid": [
            "effect @s regeneration 10 2 true",
            "effect @s absorption 30 0 true",
            "effect @s poison 0",
            "effect @s wither 0",
            "playsound random.levelup @s ~ ~ ~ 0.6 1.6",
            "titleraw @s actionbar %s" % raw("§fFirst aid applied."),
        ],
        "battery": [
            "scoreboard players add @s li_bat 40",
            "execute if score @s li_bat matches 101.. run scoreboard players set @s li_bat 100",
            "playsound random.click @s ~ ~ ~ 0.8 1.2",
            "titleraw @s actionbar %s" % raw("§eTorch charged."),
        ],
        "matches": [
            "setblock ~ ~ ~ minecraft:campfire",
            "playsound fire.ignite @s ~ ~ ~ 0.8 1.0",
            "titleraw @s actionbar %s" % raw("§6You light a small fire."),
        ],
        "flare": [
            "setblock ~ ~ ~ minecraft:torch",
            "particle minecraft:large_explosion ~ ~1 ~",
            "playsound fire.ignite @s ~ ~ ~ 1.0 0.6",
            # flares genuinely scare the wildlife off
            "effect @e[family=li_hostile,r=14] slowness 8 1 true",
            "damage @e[family=li_hostile,r=6] 2 fire",
            "titleraw @s actionbar %s" % raw("§cThe flare hisses and burns."),
        ],
    }

    for name, body in simple.items():
        w(os.path.join(FN, "li_items", "use_%s.mcfunction" % name),
          base(name) + body)

    # A belt-and-braces starter: hold the kit in your hand for 3 seconds.
    w(os.path.join(FN, "li_items", "hold_check.mcfunction"), [
        "execute as @a unless entity @s[hasitem={item=li:setup_tool,"
        "location=slot.weapon.mainhand}] run scoreboard players set @s li_tmp 0",
        "execute as @a[hasitem={item=li:setup_tool,location=slot.weapon.mainhand}] "
        "run scoreboard players add @s li_tmp 1",
        "execute as @a[hasitem={item=li:setup_tool,location=slot.weapon.mainhand},"
        "scores={li_tmp=3}] run titleraw @s actionbar %s"
        % raw("§7Keep holding the Start Kit..."),
        "execute as @a[hasitem={item=li:setup_tool,location=slot.weapon.mainhand},"
        "scores={li_tmp=6..}] at @s run function li_items/hold_start",
    ], "Runs only until the island exists: hold-to-start fallback.")
    w(os.path.join(FN, "li_items", "hold_start.mcfunction"), [
        "scoreboard players set @s li_tmp 0",
        "execute if score #built li_sys matches ..0 run function li_build/start",
    ])

    # ------------------------------------------------------------ flashlight
    w(os.path.join(FN, "li_items", "use_flashlight_off.mcfunction"), [
        "clear @s li:flashlight_off_used",
        "execute if score @s li_bat matches 1.. run function li_items/torch_on",
        "execute if score @s li_bat matches ..0 run function li_items/torch_dead",
    ])
    w(os.path.join(FN, "li_items", "torch_on.mcfunction"), [
        "give @s li:flashlight_on 1",
        "playsound random.click @s ~ ~ ~ 0.9 1.3",
        "titleraw @s actionbar %s" % raw("§eTorch on."),
    ])
    w(os.path.join(FN, "li_items", "torch_dead.mcfunction"), [
        "give @s li:flashlight_off 1",
        "playsound random.click @s ~ ~ ~ 0.7 0.6",
        "titleraw @s actionbar %s" % raw("§7The torch is dead. It needs a battery."),
    ])
    w(os.path.join(FN, "li_items", "use_flashlight_on.mcfunction"), [
        "clear @s li:flashlight_on_used",
        "give @s li:flashlight_off 1",
        "playsound random.click @s ~ ~ ~ 0.9 0.9",
        "titleraw @s actionbar %s" % raw("§7Torch off."),
    ])
    # Bedrock 1.21.0 has no per-item dynamic light, so a held, charged torch
    # grants night vision instead. This is the closest supported effect.
    w(os.path.join(FN, "li_items", "flashlight.mcfunction"), [
        "scoreboard players set #cd_tor li_sys 2",
        "execute as @a[hasitem={item=li:flashlight_on,location=slot.weapon.mainhand}] run effect @s night_vision 4 0 true",
        "execute as @a[hasitem={item=li:flashlight_on,location=slot.weapon.mainhand},scores={li_bat=1..}] run scoreboard players remove @s li_bat 1",
        "execute as @a[hasitem={item=li:flashlight_on}] at @s run function li_items/torch_check",
    ], "Held torch upkeep, once per second.")
    w(os.path.join(FN, "li_items", "torch_check.mcfunction"), [
        "execute if score @s li_bat matches ..0 run clear @s li:flashlight_on",
        "execute if score @s li_bat matches ..0 run give @s li:flashlight_off 1",
        "execute if score @s li_bat matches ..0 run titleraw @s actionbar %s"
        % raw("§7The torch flickers and dies."),
        "execute if score @s li_bat matches ..0 run playsound random.click @s ~ ~ ~ 0.7 0.5",
    ])

    # ------------------------------------------------------ tools / key items
    w(os.path.join(FN, "li_items", "use_crowbar.mcfunction"), [
        "clear @s li:crowbar_used",
        "give @s li:crowbar 1",
        "function li_story/unlock_crowbar",
    ])
    w(os.path.join(FN, "li_items", "use_keycard.mcfunction"), [
        "clear @s li:keycard_used",
        "give @s li:keycard 1",
        "function li_story/unlock_keycard",
    ])
    w(os.path.join(FN, "li_items", "use_bunker_key.mcfunction"), [
        "clear @s li:bunker_key_used",
        "give @s li:bunker_key 1",
        "function li_story/unlock_bunker",
    ])
    w(os.path.join(FN, "li_items", "use_documents.mcfunction"), [
        "clear @s li:documents_used",
        "give @s li:documents 1",
        "function li_story/read_documents",
    ])
    for keep in ("radio_part", "fuel_can", "mech_part", "nav_gear"):
        w(os.path.join(FN, "li_items", "use_%s.mcfunction" % keep), [
            "clear @s li:%s_used" % keep,
            "give @s li:%s 1" % keep,
            "titleraw @s actionbar %s"
            % raw("§eEscape component - take it to the lighthouse."),
            "playsound random.click @s ~ ~ ~ 0.6 1.1",
        ])
    w(os.path.join(FN, "li_items", "use_setup_tool.mcfunction"), [
        "clear @s li:setup_tool_used",
        "give @s li:setup_tool 1",
        "execute if score #built li_sys matches ..0 run function li_build/start",
        "execute if score #built li_sys matches 1.. run function li_dev/rebuild_warn",
    ])
    w(os.path.join(FN, "li_items", "use_debug_tool.mcfunction"), [
        "clear @s li:debug_tool_used",
        "give @s li:debug_tool 1",
        "function li_dev/debug_menu",
    ])


# ===========================================================================
def gen_story(notes, zones, locks, total_chapters=8):
    # ------------------------------------------------------------- intro
    w(os.path.join(FN, "li_story", "intro.mcfunction"), [
        "titleraw @s times 10 70 20",
        "titleraw @s title %s" % raw("§eLOST ISLAND: ABANDONED"),
        "titleraw @s subtitle %s"
        % raw("§7Survive. Discover what happened. Find a way home."),
        "playsound ambient.weather.thunder @s ~ ~ ~ 0.7 0.8",
        "tellraw @s %s" % raw("§8§m                                        "),
        "tellraw @s %s" % raw("§eLOST ISLAND: ABANDONED"),
        "tellraw @s %s" % raw("§7The island was inhabited once. Almost "
                              "everyone disappeared."),
        "tellraw @s %s" % raw("§7Run §f/function li_help§7 for commands."),
        "tellraw @s %s" % raw("§8§m                                        "),
        # Building the island rewrites a large region, so it is always the
        # player's call. The Start Kit works in survival with cheats off.
        "execute if score #built li_sys matches ..0 run function li_core/offer_kit",
        "execute if score #built li_sys matches 1.. run function li_story/chapter_1",
    ], "Shown once, on first join.")

    # ----------------------------------------------------------- chapters
    for n, (title, objective, flavour) in STORY.items():
        lines = [
            "scoreboard players set @s li_chapter %d" % n,
            "titleraw @s times 8 50 15",
            "titleraw @s title %s" % raw("§eCHAPTER %d" % n),
            "titleraw @s subtitle %s" % raw("§f" + title),
            "tellraw @s %s" % raw("§8[§eChapter %d§8] §f%s" % (n, title)),
            "tellraw @s %s" % raw("§7%s" % flavour),
            "tellraw @s %s" % raw("§6> OBJECTIVE §f%s" % objective),
            "playsound random.levelup @s ~ ~ ~ 0.7 1.0",
        ]
        if n == 8:
            lines.append("tellraw @s %s" % raw(
                "§7Components needed: radio part, battery, fuel, mechanical "
                "part, navigation gear."))
        w(os.path.join(FN, "li_story", "chapter_%d.mcfunction" % n), lines)

    w(os.path.join(FN, "li_story", "objective.mcfunction"), [
        "execute as @s[scores={li_chapter=%d}] run tellraw @s %s"
        % (n, raw("§6> OBJECTIVE §f%s" % STORY[n][1]))
        for n in STORY
    ], "Re-print the current objective.")

    # ------------------------------------------------------- zone triggers
    # 80-ish volume tests, split into 5 rotating groups: ~16 tests per half
    # second, which is the single biggest per-tick cost in the pack.
    triggers = []
    for z in zones:
        triggers.append(("z%d" % z["id"], z["box"],
                         "li_story/discover_%d" % z["id"]))
    for nt in notes:
        triggers.append(("n%d" % nt["id"], nt["box"],
                         "li_story/note_%d" % nt["id"]))

    GROUPS = 5
    w(os.path.join(FN, "li_story", "zones.mcfunction"), [
        "scoreboard players add #zgrp li_sys 1",
        "execute if score #zgrp li_sys matches %d.. run scoreboard players set #zgrp li_sys 0" % GROUPS,
    ] + ["execute if score #zgrp li_sys matches %d run function li_story/zones_%d"
         % (g, g) for g in range(GROUPS)],
      "Rotates through the trigger-volume groups.")

    buckets = [[] for _ in range(GROUPS)]
    for i, t in enumerate(triggers):
        buckets[i % GROUPS].append(t)
    for g, bucket in enumerate(buckets):
        lines = []
        for tag, box, fn in bucket:
            lines.append("execute as @a[scores={li_chapter=1..},tag=!li_%s,%s] "
                         "at @s run function %s"
                         % (tag, box_sel(box), fn))
        w(os.path.join(FN, "li_story", "zones_%d.mcfunction" % g), lines)

    # --------------------------------------------------------- discoveries
    CHAPTER_ON_DISCOVER = {5: 3, 12: 4, 19: 5, 25: 7}
    SHELTER_ZONES = (2, 3, 4)
    for z in zones:
        zid = z["id"]
        lines = [
            "tag @s add li_z%d" % zid,
            "titleraw @s actionbar %s" % raw("§aDiscovered: §f" + z["name"]),
            "tellraw @s %s" % raw("§8[§eDiscovery§8] §f%s" % z["name"]),
            "playsound random.orb @s ~ ~ ~ 0.6 1.2",
        ]
        if zid in SHELTER_ZONES:
            lines.append(
                "execute if score @s li_chapter matches 1 run function "
                "li_story/chapter_2")
        if zid in CHAPTER_ON_DISCOVER:
            nxt = CHAPTER_ON_DISCOVER[zid]
            lines.append(
                "execute if score @s li_chapter matches ..%d run function "
                "li_story/chapter_%d" % (nxt - 1, nxt))
        if zid == 26:
            lines.append(
                "execute if score @s li_chapter matches ..7 run function "
                "li_story/chapter_8")
            lines.append("function li_mobs/spawn_alpha")
        w(os.path.join(FN, "li_story", "discover_%d.mcfunction" % zid), lines)

    # --------------------------------------------------------------- notes
    for nt in notes:
        nid = nt["id"]
        label, text = NOTE_TEXT.get(
            nid, ("torn page", "The ink has run. Whatever it said is gone."))
        lines = [
            "tag @s add li_n%d" % nid,
            "playsound random.pop @s ~ ~ ~ 0.5 1.3",
            "tellraw @s %s" % raw("§8[§7%s§8]" % label),
            "tellraw @s %s" % raw("§7§o" + text),
            "titleraw @s actionbar %s" % raw("§7You found a §f%s§7." % label),
        ]
        if nid == 40:
            lines.append("execute if score @s li_chapter matches ..7 run "
                         "function li_story/truth")
        w(os.path.join(FN, "li_story", "note_%d.mcfunction" % nid), lines)

    # ---------------------------------------------------------- the truth
    w(os.path.join(FN, "li_story", "truth.mcfunction"), [
        "titleraw @s times 10 80 20",
        "titleraw @s title %s" % raw("§4THE TRUTH"),
        "titleraw @s subtitle %s" % raw("§7They did not create it. They woke it."),
        "playsound mob.warden.nearby_close @s ~ ~ ~ 0.9 0.7",
        "tellraw @s %s" % raw("§7The records are complete. Site 7 was built "
                              "over something older than the island's name."),
        "function li_story/chapter_8",
    ])

    # ------------------------------------------------------------- unlocks
    for kind, item in (("crowbar", "li:crowbar"), ("keycard", "li:keycard"),
                       ("bunker", "li:bunker_key")):
        want = {"crowbar": "li:crowbar", "keycard": "li:keycard",
                "bunker": "li:bunker_key"}[kind]
        lines = []
        for lk in locks:
            if lk["item"] != want:
                continue
            b = lk["box"]
            cx = (b[0] + b[3]) // 2
            cy = (b[1] + b[4]) // 2
            cz = (b[2] + b[5]) // 2
            lines.append(
                "execute if entity @s[x=%d,y=%d,z=%d,dx=12,dy=9,dz=12] run "
                "function li_story/open_%s"
                % (cx - 6, cy - 4, cz - 6, lk["id"]))
        if not lines:
            lines = ["titleraw @s actionbar %s" % raw("§7Nothing to open here.")]
        else:
            lines.insert(0, "titleraw @s actionbar %s"
                         % raw("§7You look for something to open..."))
        w(os.path.join(FN, "li_story", "unlock_%s.mcfunction" % kind), lines)

    for lk in locks:
        b = lk["box"]
        body = [
            "fill %d %d %d %d %d %d minecraft:air" % (b[0], b[1], b[2],
                                                      b[3], b[4], b[5]),
            "playsound random.anvil_use @s ~ ~ ~ 0.9 0.8",
            "titleraw @s actionbar %s" % raw("§aIt gives way."),
            "tellraw @s %s" % raw("§7%s" % lk["hint"]),
        ]
        # Forcing the checkpoint gate is what completes Chapter 5, not merely
        # walking up to it.
        if lk["id"] == "checkpoint_gate":
            body.append("execute if score @s li_chapter matches ..5 run "
                        "function li_story/chapter_6")
        if lk["id"] == "bunker_blast_door":
            body.append("execute if score @s li_chapter matches ..6 run "
                        "function li_story/chapter_7")
        w(os.path.join(FN, "li_story", "open_%s.mcfunction" % lk["id"]), body)

    # --------------------------------------------------- rotating documents
    docs = [NOTE_TEXT[k][1] for k in (35, 36, 37, 40, 41, 42)]
    lines = ["titleraw @s actionbar %s" % raw("§7You leaf through the papers.")]
    for i, d in enumerate(docs):
        lines.append("execute if score #rand li_sys matches %d..%d run tellraw "
                     "@s %s" % (i * 3, i * 3 + 2,
                                raw("§7§o" + d)))
    lines.append("execute if score #rand li_sys matches 18.. run tellraw @s %s"
                 % raw("§7§oMost of this page is water damage."))
    w(os.path.join(FN, "li_story", "read_documents.mcfunction"), lines)

    # -------------------------------------------------------------- escape
    w(os.path.join(FN, "li_story", "escape_check.mcfunction"), [
        "scoreboard players set #cd_esc li_sys 4",
        "execute as @a[scores={li_chapter=8}] run scoreboard players set @s li_esc 0",
        "execute as @a[scores={li_chapter=8},hasitem={item=li:radio_part}] run scoreboard players add @s li_esc 1",
        "execute as @a[scores={li_chapter=8},hasitem={item=li:battery}] run scoreboard players add @s li_esc 1",
        "execute as @a[scores={li_chapter=8},hasitem={item=li:fuel_can}] run scoreboard players add @s li_esc 1",
        "execute as @a[scores={li_chapter=8},hasitem={item=li:mech_part}] run scoreboard players add @s li_esc 1",
        "execute as @a[scores={li_chapter=8},hasitem={item=li:nav_gear}] run scoreboard players add @s li_esc 1",
        # the lighthouse lamp room bench
        "execute as @a[scores={li_chapter=8,li_esc=5..},x=128,y=92,z=108,dx=9,dy=6,dz=9] at @s run function li_story/escape_final",
        "execute as @a[scores={li_chapter=8,li_esc=..4},x=128,y=92,z=108,dx=9,dy=6,dz=9] at @s run function li_story/escape_missing",
    ], "Counts escape components and watches the lighthouse bench.")

    w(os.path.join(FN, "li_story", "escape_missing.mcfunction"), [
        "titleraw @s actionbar %s" % raw_parts([
            "§7Radio bench: §f", ("score", "li_esc"), "§7/5 components"]),
    ])

    w(os.path.join(FN, "li_story", "escape_final.mcfunction"), [
        "scoreboard players set @s li_chapter 9",
        "clear @s li:radio_part",
        "clear @s li:fuel_can",
        "clear @s li:mech_part",
        "clear @s li:nav_gear",
        "titleraw @s times 10 40 10",
        "titleraw @s title %s" % raw("§eTRANSMITTING"),
        "titleraw @s subtitle %s" % raw("§7Emergency band - mayday, mayday..."),
        "playsound beacon.activate @s ~ ~ ~ 1.0 0.7",
        "tellraw @s %s" % raw("§7The bench crackles. The lamp above you turns "
                              "over once, twice, and catches."),
        "setblock 132 92 111 minecraft:redstone_lamp",
        "particle minecraft:end_chest ~ ~1 ~",
        "weather clear 1200",
        "function li_story/ending",
    ])
    w(os.path.join(FN, "li_story", "ending.mcfunction"), [
        "titleraw @s times 10 90 30",
        "titleraw @s title %s" % raw("§aSIGNAL RECEIVED"),
        "titleraw @s subtitle %s" % raw("§fYou survived Lost Island."),
        "playsound raid.horn @s ~ ~ ~ 1.0 0.8",
        "tellraw @s %s" % raw("§8§m                                        "),
        "tellraw @s %s" % raw("§aSIGNAL RECEIVED"),
        "tellraw @s %s" % raw("§7A ship's horn answers from somewhere out in "
                              "the dark water. It is getting closer."),
        "tellraw @s %s" % raw("§fYou survived Lost Island."),
        "tellraw @s %s" % raw("§7The island is still yours to explore."),
        "tellraw @s %s" % raw("§8§m                                        "),
        "give @s li:documents 1",
    ])


# ===========================================================================
def gen_mobs():
    # Offsets are baked so a "random" spawn point costs no extra commands.
    offsets = [(16, 3, 9), (-14, 3, 12), (11, 3, -15), (-17, 3, -8),
               (20, 4, -4), (-9, 3, 18)]
    lines = [
        "scoreboard players set #cd_enc li_sys 20",
        "execute as @a[scores={li_chapter=2..}] at @s run function li_mobs/enc_player",
        "scoreboard players add #watch li_sys 1",
        "execute if score #watch li_sys matches 30.. run function li_mobs/watcher_try",
    ]
    w(os.path.join(FN, "li_mobs", "encounters.mcfunction"), lines,
      "Encounter director, every 10s.")

    # One extra hostile at a time, and only when the area is quiet.
    enc = [
        "execute if entity @e[type=li:sensor,family=li_night,r=6,c=1] unless entity @e[family=li_hostile,r=26,c=1] run function li_mobs/night_spawn",
        "execute if entity @e[type=li:sensor,family=li_day,r=6,c=1] if score #rand li_sys matches 0..3 unless entity @e[family=li_hostile,r=30,c=1] run function li_mobs/day_spawn",
        "execute if score @s li_chapter matches 6.. unless entity @e[type=li:alpha_stalker,r=48,c=1] if score #rand li_sys matches 7 run function li_mobs/forbidden_spawn",
    ]
    w(os.path.join(FN, "li_mobs", "enc_player.mcfunction"), enc)

    night = []
    for i, (dx, dy, dz) in enumerate(offsets):
        night.append("execute if score #rand li_sys matches %d..%d run summon "
                     "li:island_stalker ~%d ~%d ~%d"
                     % (i * 3, i * 3 + 2, dx, dy, dz))
    night.append("execute if score #rand li_sys matches 18..19 run summon "
                 "li:feral_survivor ~13 ~3 ~-11")
    night.append("titleraw @s actionbar %s"
                 % raw("§8Something moves in the dark."))
    w(os.path.join(FN, "li_mobs", "night_spawn.mcfunction"), night)

    day = [
        "execute if score #rand li_sys matches 0..1 run summon li:feral_survivor ~18 ~3 ~10",
        "execute if score #rand li_sys matches 2..3 run summon li:island_boar ~14 ~2 ~-12",
    ]
    w(os.path.join(FN, "li_mobs", "day_spawn.mcfunction"), day)

    w(os.path.join(FN, "li_mobs", "forbidden_spawn.mcfunction"), [
        # only inside the Forbidden Zone footprint
        "execute if entity @s[x=-160,y=12,z=-160,dx=200,dy=80,dz=66] run summon li:alpha_stalker ~18 ~2 ~14",
        "execute if entity @s[x=-160,y=12,z=-160,dx=200,dy=80,dz=66] run playsound mob.ravager.roar @s ~ ~ ~ 1.0 0.6",
    ])
    w(os.path.join(FN, "li_mobs", "spawn_alpha.mcfunction"), [
        "execute unless entity @e[type=li:alpha_stalker,r=60,c=1] run summon li:alpha_stalker ~12 ~1 ~10",
        "playsound mob.ravager.roar @s ~ ~ ~ 1.0 0.5",
        "titleraw @s actionbar %s" % raw("§4Something very large is awake down here."),
    ])
    # The watcher is deliberately rare: this can only fire every 5 minutes and
    # then only on one specific roll, so roughly twice an hour at most.
    w(os.path.join(FN, "li_mobs", "watcher_try.mcfunction"), [
        "scoreboard players set #watch li_sys 0",
        "execute as @a[scores={li_chapter=3..},c=1] at @s if score #rand li_sys matches 3 unless entity @e[type=li:watcher,r=64,c=1] run function li_mobs/watcher_spawn",
    ])
    w(os.path.join(FN, "li_mobs", "watcher_spawn.mcfunction"), [
        "summon li:watcher ~26 ~4 ~22",
        "playsound mob.enderman.idle @s ~ ~ ~ 0.5 0.6",
    ])


# ===========================================================================
def gen_atmo():
    w(os.path.join(FN, "li_atmo", "tick.mcfunction"), [
        "scoreboard players set #cd_atmo li_sys 10",
        # every player carries one invisible day/night sensor
        "execute as @a[scores={li_chapter=1..}] at @s unless entity @e[type=li:sensor,r=8,c=1] run summon li:sensor ~ ~1 ~",
        "execute as @a[scores={li_chapter=1..}] at @s run tp @e[type=li:sensor,c=1,r=40] ~ ~1 ~",
        # night transitions
        "execute as @a[scores={li_chapter=1..},tag=!li_night] at @s if entity @e[type=li:sensor,family=li_night,r=8,c=1] run function li_atmo/night_start",
        "execute as @a[tag=li_night] at @s if entity @e[type=li:sensor,family=li_day,r=8,c=1] run function li_atmo/night_end",
        # regional fog
        "execute as @a[scores={li_chapter=1..},tag=!li_fog_swamp,x=-160,y=40,z=-25,dx=105,dy=60,dz=85] run function li_atmo/fog_swamp_on",
        "execute as @a[tag=li_fog_swamp] unless entity @s[x=-160,y=40,z=-25,dx=105,dy=60,dz=85] run function li_atmo/fog_swamp_off",
        "execute as @a[scores={li_chapter=1..},tag=!li_fog_fac,y=12,dy=42] run function li_atmo/fog_fac_on",
        "execute as @a[tag=li_fog_fac] unless entity @s[y=12,dy=42] run function li_atmo/fog_fac_off",
        # ambience
        "execute as @a[tag=li_night] at @s if score #rand li_sys matches 4 run playsound ambient.weather.thunder @s ~ ~ ~ 0.25 0.7",
        "execute as @a[y=12,dy=42] at @s if score #rand li_sys matches 9 run playsound ambient.cave @s ~ ~ ~ 0.5 0.8",
        # weather director
        "scoreboard players add #count li_sys 1",
        "execute if score #count li_sys matches 60.. run function li_atmo/weather_roll",
    ], "Atmosphere, every 5s.")

    w(os.path.join(FN, "li_atmo", "night_start.mcfunction"), [
        "tag @s add li_night",
        "fog @s push li:night_fog li_night",
        "titleraw @s actionbar %s" % raw("§8Night. The island changes after dark."),
        "playsound ambient.weather.thunder @s ~ ~ ~ 0.35 0.6",
    ])
    w(os.path.join(FN, "li_atmo", "night_end.mcfunction"), [
        "tag @s remove li_night",
        "fog @s pop li_night",
        "titleraw @s actionbar %s" % raw("§fDawn. You made it through."),
        "scoreboard players remove @s li_exh 20",
        "execute if score @s li_chapter matches 1 run function li_story/chapter_2",
    ])
    w(os.path.join(FN, "li_atmo", "fog_swamp_on.mcfunction"), [
        "tag @s add li_fog_swamp",
        "fog @s push li:swamp_fog li_swamp",
        "titleraw @s actionbar %s" % raw("§2The air thickens. You cannot see far."),
    ])
    w(os.path.join(FN, "li_atmo", "fog_swamp_off.mcfunction"), [
        "tag @s remove li_fog_swamp",
        "fog @s pop li_swamp",
    ])
    w(os.path.join(FN, "li_atmo", "fog_fac_on.mcfunction"), [
        "tag @s add li_fog_fac",
        "fog @s push li:facility_fog li_fac",
    ])
    w(os.path.join(FN, "li_atmo", "fog_fac_off.mcfunction"), [
        "tag @s remove li_fog_fac",
        "fog @s pop li_fac",
    ])
    w(os.path.join(FN, "li_atmo", "weather_roll.mcfunction"), [
        "scoreboard players set #count li_sys 0",
        "execute if score #rand li_sys matches 0..3 run function li_atmo/storm",
        "execute if score #rand li_sys matches 4..8 run function li_atmo/rain",
        "execute if score #rand li_sys matches 9..19 run function li_atmo/clear",
    ], "Rolls the weather about every 5 minutes.")
    w(os.path.join(FN, "li_atmo", "storm.mcfunction"), [
        "scoreboard players set #storm li_sys 1",
        "weather thunder 900",
        "execute as @a[scores={li_chapter=1..}] run fog @s push li:storm_fog li_storm",
        "tellraw @a %s" % raw("§8[§eLost Island§8] §7A storm is coming in off "
                              "the water."),
        "execute as @a[scores={li_chapter=1..}] run playsound ambient.weather.thunder @s ~ ~ ~ 0.8 0.7",
    ])
    w(os.path.join(FN, "li_atmo", "rain.mcfunction"), [
        "scoreboard players set #storm li_sys 1",
        "weather rain 900",
        "execute as @a[scores={li_chapter=1..}] run fog @s push li:storm_fog li_storm",
    ])
    w(os.path.join(FN, "li_atmo", "clear.mcfunction"), [
        "scoreboard players set #storm li_sys 0",
        "weather clear 900",
        "execute as @a run fog @s pop li_storm",
    ])


# ===========================================================================
def gen_dev(item_ids):
    give = ["gamerule sendcommandfeedback false"]
    for i in item_ids:
        give.append("give @s li:%s 1" % i)
    give.append("tellraw @s %s" % raw("§7Test kit given."))
    w(os.path.join(FN, "li_dev", "giveall.mcfunction"), give,
      "Creative/test helper: one of every custom item.")

    w(os.path.join(FN, "li_dev", "debug_menu.mcfunction"), [
        "tellraw @s %s" % raw("§8[§eLost Island Debug§8]"),
        "tellraw @s %s" % raw_parts(["§7Chapter §f", ("score", "li_chapter"),
                                     "§7  Water §f", ("score", "li_pct"),
                                     "§7%  Temp §f", ("score", "li_temp"),
                                     "§7  Exh §f", ("score", "li_exh"),
                                     "§7  Torch §f", ("score", "li_bat"),
                                     "§7%"]),
        "scoreboard players set @s li_thirst 1200",
        "scoreboard players set @s li_temp 0",
        "scoreboard players set @s li_exh 0",
        "scoreboard players set @s li_bat 100",
        "scoreboard players add @s li_chapter 1",
        "execute if score @s li_chapter matches 9.. run scoreboard players set @s li_chapter 8",
        "function li_story/objective",
        "tellraw @s %s" % raw("§7Meters refilled and chapter advanced."),
    ], "The debug wand: refills meters and advances one chapter.")

    w(os.path.join(FN, "li_dev", "rebuild_warn.mcfunction"), [
        "tellraw @s %s" % raw("§cThe island is already built."),
        "tellraw @s %s" % raw("§7Run §f/function li_build/start§7 again only "
                              "if you want to rebuild it from scratch."),
    ])


# ===========================================================================
def main():
    with open(os.path.join(OUT, "terrain_index.json")) as f:
        t_index = json.load(f)
    with open(os.path.join(OUT, "loc_index.json")) as f:
        l_index = json.load(f)
    with open(os.path.join(OUT, "note_spots.json")) as f:
        notes = json.load(f)
    with open(os.path.join(OUT, "discover_zones.json")) as f:
        zones = json.load(f)
    with open(os.path.join(OUT, "locked_areas.json")) as f:
        locks = json.load(f)
    with open(os.path.join(OUT, "marker_items.json")) as f:
        markers = json.load(f)

    total, groups = gen_build(t_index, l_index)
    gen_core(total, t_index["count"])
    gen_survival()
    gen_items(markers)
    gen_story(notes, zones, locks)
    gen_mobs()
    gen_atmo()

    item_ids = [
        "clean_water", "dirty_water", "boiled_water", "canned_beans",
        "canned_meat", "bandage", "first_aid", "cloth", "rope", "scrap",
        "battery", "flashlight_off", "crowbar", "keycard", "bunker_key",
        "radio_part", "fuel_can", "mech_part", "nav_gear", "flare",
        "documents", "matches", "setup_tool", "debug_tool",
    ]
    gen_dev(item_ids)

    n = sum(len(fs) for _, _, fs in os.walk(FN) for _ in [0])
    count = 0
    for root, _d, files in os.walk(FN):
        count += len([f for f in files if f.endswith(".mcfunction")])
    print("build steps    : %d in %d dispatch groups" % (total, groups))
    print("functions      : %d .mcfunction files" % count)
    print("notes wired    : %d" % len(notes))
    print("zones wired    : %d" % len(zones))
    print("locks wired    : %d" % len(locks))


if __name__ == "__main__":
    main()

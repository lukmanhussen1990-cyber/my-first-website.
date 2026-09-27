--[[
    Rockstar Bodyguard Mod for Bully: Scholarship Edition (PC)
    Requires: Derpy's Script Loader (DSL)

    Spawns up to MAX_GUARDS bodyguards that follow Jimmy, fight anyone
    who attacks him, and respawn if they die or get left behind.

    Controls (keyboard, change in CONFIG below):
      F5  - Spawn a bodyguard
      F6  - Dismiss all bodyguards
      F7  - Order bodyguards to attack Jimmy's current target
      F8  - Toggle invincible bodyguards
]]

---------------------------------------------------------------------------
-- CONFIG
---------------------------------------------------------------------------
local CONFIG = {
    MAX_GUARDS    = 3,

    -- Ped model IDs to pick from when spawning a guard (cycled in order).
    --   75  = Russell    (Bullies leader)
    --   130 = Gary
    --   19  = Ted        (Jocks leader)
    --   91  = Johnny     (Greasers leader)
    --   37  = Derby      (Preppies leader)
    --   30  = Earnest    (Nerds leader)
    -- Swap in any model ID you like.
    MODELS        = { 75, 91, 19, 37 },

    -- Weapon given to each guard (nil = fists only).
    --   Example: WEAPON = 357, WEAPON_AMMO = 1   (baseball bat)
    WEAPON        = nil,
    WEAPON_AMMO   = 1,

    INVINCIBLE    = true,    -- guards are healed to full every tick
    AUTO_RESPAWN  = true,    -- replace guards that die / get unloaded
    RESPAWN_DELAY = 5000,    -- ms before a lost guard is replaced
    LEASH_DIST    = 40.0,    -- teleport guard back if farther than this

    KEY_SPAWN     = "F5",
    KEY_DISMISS   = "F6",
    KEY_ATTACK    = "F7",
    KEY_GODMODE   = "F8",
}

---------------------------------------------------------------------------
-- STATE
---------------------------------------------------------------------------
local guards      = {}   -- list of { ped = id, model = id, lostAt = ms|nil }
local modelIndex  = 1
local enabled     = false

-- Call a game function without crashing the script if it is missing
-- or errors (some natives differ between game/DSL versions).
local function safe(fn, ...)
    if type(fn) ~= "function" then return nil end
    local ok, a, b, c = pcall(fn, ...)
    if ok then return a, b, c end
    return nil
end

local function msg(text)
    safe(TextPrintString, text, 3, 1)
end

local function keyPressed(key)
    return safe(IsKeyBeingPressed, key) == true
end

local function isAlive(ped)
    return ped ~= nil
        and safe(PedIsValid, ped) == true
        and safe(PedIsDead, ped) ~= true
end

local function dist2D(x1, y1, x2, y2)
    local dx, dy = x1 - x2, y1 - y2
    return math.sqrt(dx * dx + dy * dy)
end

local function nextModel()
    local m = CONFIG.MODELS[modelIndex]
    modelIndex = modelIndex % #CONFIG.MODELS + 1
    return m
end

---------------------------------------------------------------------------
-- GUARD LOGIC
---------------------------------------------------------------------------
local function setupGuard(ped)
    -- 13 = player faction, 4 = "adore" (will never turn on Jimmy)
    safe(PedSetPedToTypeAttitude, ped, 13, 4)
    safe(PedSetFlag, ped, 108, true) -- ignore minor stimuli / don't wander
    safe(PedRecruitAlly, gPlayer, ped)

    if CONFIG.WEAPON then
        safe(PedSetWeapon, ped, CONFIG.WEAPON, CONFIG.WEAPON_AMMO)
    end

    local maxHp = safe(PedGetMaxHealth, ped)
    if maxHp then
        safe(PedSetHealth, ped, maxHp * 2)
    end
end

local function spawnGuardPed(model)
    local x, y, z = PlayerGetPosXYZ()
    -- spread guards out a little behind/around the player
    local offset = (#guards % 3) - 1
    local ped = safe(PedCreateXY, model, x + 1.5 * offset, y - 1.5, z)
    if ped and ped ~= -1 then
        setupGuard(ped)
        return ped
    end
    return nil
end

local function spawnGuard()
    if #guards >= CONFIG.MAX_GUARDS then
        msg("Bodyguards: max (" .. CONFIG.MAX_GUARDS .. ") already hired")
        return
    end
    local model = nextModel()
    local ped = spawnGuardPed(model)
    if ped then
        table.insert(guards, { ped = ped, model = model, lostAt = nil })
        enabled = true
        msg("Bodyguard hired! (" .. #guards .. "/" .. CONFIG.MAX_GUARDS .. ")")
    else
        msg("Couldn't spawn bodyguard here")
    end
end

local function dismissAll()
    for _, g in ipairs(guards) do
        if g.ped and safe(PedIsValid, g.ped) then
            safe(PedDismissAlly, gPlayer, g.ped)
            safe(PedMakeAmbient, g.ped)
        end
    end
    guards = {}
    enabled = false
    msg("Bodyguards dismissed")
end

local function attackTarget()
    local target = safe(PedGetTargetPed, gPlayer)
    if not target or target == -1 or not isAlive(target) then
        msg("Lock on to someone first")
        return
    end
    for _, g in ipairs(guards) do
        if isAlive(g.ped) then
            safe(PedAttack, g.ped, target, 3)
        end
    end
    msg("Get 'em!")
end

-- Defend Jimmy: if something is hitting the player, sic the guards on it.
local function defendPlayer()
    local attacker = safe(PedGetWhoHitMeLast, gPlayer)
    if attacker and attacker ~= -1 and attacker ~= gPlayer and isAlive(attacker) then
        for _, g in ipairs(guards) do
            if isAlive(g.ped) and attacker ~= g.ped then
                safe(PedAttack, g.ped, attacker, 3)
            end
        end
    end
end

local function maintainGuards()
    local now = GetTimer()
    local px, py, pz = PlayerGetPosXYZ()

    for _, g in ipairs(guards) do
        if isAlive(g.ped) then
            g.lostAt = nil

            if CONFIG.INVINCIBLE then
                local maxHp = safe(PedGetMaxHealth, g.ped)
                if maxHp then safe(PedSetHealth, g.ped, maxHp * 2) end
            end

            -- Left behind (e.g. player ran / rode off): warp back.
            local gx, gy = safe(PedGetPosXYZ, g.ped)
            if gx and dist2D(px, py, gx, gy) > CONFIG.LEASH_DIST then
                safe(PedSetPosXYZ, g.ped, px + 1.0, py - 1.0, pz)
                safe(PedRecruitAlly, gPlayer, g.ped)
            end
        elseif CONFIG.AUTO_RESPAWN then
            -- Dead or unloaded (area change, etc.): respawn after a delay.
            g.lostAt = g.lostAt or now
            if now - g.lostAt >= CONFIG.RESPAWN_DELAY then
                local ped = spawnGuardPed(g.model)
                if ped then
                    g.ped, g.lostAt = ped, nil
                end
            end
        end
    end

    if not CONFIG.AUTO_RESPAWN then
        for i = #guards, 1, -1 do
            if not isAlive(guards[i].ped) then table.remove(guards, i) end
        end
        if #guards == 0 then enabled = false end
    end
end

---------------------------------------------------------------------------
-- MAIN
---------------------------------------------------------------------------
function main()
    -- wait for the game/world to be ready
    while SystemIsReady and not SystemIsReady() do Wait(0) end
    Wait(1000)
    msg("Rockstar Bodyguard Mod loaded - press " .. CONFIG.KEY_SPAWN .. " to hire")

    while true do
        if keyPressed(CONFIG.KEY_SPAWN) then
            spawnGuard()
        elseif keyPressed(CONFIG.KEY_DISMISS) then
            dismissAll()
        elseif keyPressed(CONFIG.KEY_ATTACK) then
            attackTarget()
        elseif keyPressed(CONFIG.KEY_GODMODE) then
            CONFIG.INVINCIBLE = not CONFIG.INVINCIBLE
            msg("Invincible bodyguards: " .. (CONFIG.INVINCIBLE and "ON" or "OFF"))
        end

        if enabled then
            safe(maintainGuards)
            safe(defendPlayer)
        end

        Wait(0)
    end
end

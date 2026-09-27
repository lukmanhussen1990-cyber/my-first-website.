--[[
    Rockstar Bodyguard Mod - ANDROID (Bully: Anniversary Edition)
    Written for the game's built-in Lua 5.0 (no mod loader needed).

    This file REPLACES STimeCycle.lur inside Scripts.img. The game runs
    STimeCycle every time the world loads, so our code starts with it.
    The F_* functions at the bottom are the game's school-bell / class /
    curfew callbacks and must stay in this file.

    No keyboard on mobile, so there are no hotkeys:
      * Bodyguards are hired automatically when the world loads.
      * They follow Jimmy and fight anyone who hits him.
      * Lock on to someone and HOLD the lock for 2 seconds -> guards attack them.
      * Lock on to one of your OWN guards for 3 seconds -> all guards are dismissed.
        (They come back the next time the world/save loads.)
]]

---------------------------------------------------------------------------
-- CONFIG
---------------------------------------------------------------------------
BG_CONFIG = {
    ENABLED       = true,
    MAX_GUARDS    = 3,
    -- 75 Russell, 91 Johnny, 19 Ted, 37 Derby, 130 Gary, 30 Earnest
    MODELS        = { 75, 91, 19 },
    WEAPON        = nil,     -- e.g. 357 (bat); nil = fists
    WEAPON_AMMO   = 1,
    INVINCIBLE    = true,
    AUTO_RESPAWN  = true,
    RESPAWN_DELAY = 5000,    -- ms
    LEASH_DIST    = 40,      -- metres before a guard is warped back
    ATTACK_HOLD   = 2000,    -- ms of lock-on to order an attack
    DISMISS_HOLD  = 3000,    -- ms of lock-on on a guard to dismiss all
}

---------------------------------------------------------------------------
-- HELPERS (Lua 5.0: no '#', no '%', varargs via 'arg')
---------------------------------------------------------------------------
local guards = {}          -- { ped = , model = , lostAt = }
local modelIndex = 1
local active = false

local function safe(fn, ...)
    if type(fn) ~= "function" then return nil end
    local res = { pcall(fn, unpack(arg)) }
    if res[1] then return res[2], res[3], res[4] end
    return nil
end

local function msg(text)
    safe(TextPrintString, text, 3, 1)
end

local function now()
    return safe(GetTimer) or 0
end

local function isAlive(ped)
    return ped ~= nil and ped ~= -1
        and safe(PedIsValid, ped) == true
        and safe(PedIsDead, ped) ~= true
end

local function isGuard(ped)
    for i = 1, table.getn(guards) do
        if guards[i].ped == ped then return true end
    end
    return false
end

local function nextModel()
    local m = BG_CONFIG.MODELS[modelIndex]
    modelIndex = math.mod(modelIndex, table.getn(BG_CONFIG.MODELS)) + 1
    return m
end

---------------------------------------------------------------------------
-- GUARDS
---------------------------------------------------------------------------
local function setupGuard(ped)
    safe(PedSetPedToTypeAttitude, ped, 13, 4)   -- adore the player
    safe(PedRecruitAlly, gPlayer, ped)
    if BG_CONFIG.WEAPON then
        safe(PedSetWeapon, ped, BG_CONFIG.WEAPON, BG_CONFIG.WEAPON_AMMO)
    end
    local hp = safe(PedGetMaxHealth, ped)
    if hp then safe(PedSetHealth, ped, hp * 2) end
end

local function spawnGuardPed(model, slot)
    local x, y, z = safe(PlayerGetPosXYZ)
    if not x then return nil end
    local offset = math.mod(slot, 3) - 1
    local ped = safe(PedCreateXY, model, x + 1.5 * offset, y - 1.5, z)
    if ped and ped ~= -1 then
        setupGuard(ped)
        return ped
    end
    return nil
end

local function hireAll()
    guards = {}
    for i = 1, BG_CONFIG.MAX_GUARDS do
        local model = nextModel()
        local ped = spawnGuardPed(model, i - 1)
        table.insert(guards, { ped = ped, model = model, lostAt = nil })
    end
    active = true
    msg("Bodyguards hired: " .. BG_CONFIG.MAX_GUARDS)
end

local function dismissAll()
    for i = 1, table.getn(guards) do
        local g = guards[i]
        if g.ped and safe(PedIsValid, g.ped) then
            safe(PedDismissAlly, gPlayer, g.ped)
            safe(PedMakeAmbient, g.ped)
        end
    end
    guards = {}
    active = false
    msg("Bodyguards dismissed")
end

local function allAttack(target)
    for i = 1, table.getn(guards) do
        local g = guards[i]
        if isAlive(g.ped) and g.ped ~= target then
            safe(PedAttack, g.ped, target, 3)
        end
    end
end

local function maintainGuards()
    local t = now()
    local px, py, pz = safe(PlayerGetPosXYZ)
    if not px then return end

    for i = 1, table.getn(guards) do
        local g = guards[i]
        if isAlive(g.ped) then
            g.lostAt = nil
            if BG_CONFIG.INVINCIBLE then
                local hp = safe(PedGetMaxHealth, g.ped)
                if hp then safe(PedSetHealth, g.ped, hp * 2) end
            end
            local gx, gy = safe(PedGetPosXYZ, g.ped)
            if gx then
                local dx, dy = px - gx, py - gy
                if math.sqrt(dx * dx + dy * dy) > BG_CONFIG.LEASH_DIST then
                    safe(PedSetPosXYZ, g.ped, px + 1, py - 1, pz)
                    safe(PedRecruitAlly, gPlayer, g.ped)
                end
            end
        elseif BG_CONFIG.AUTO_RESPAWN then
            g.lostAt = g.lostAt or t
            if t - g.lostAt >= BG_CONFIG.RESPAWN_DELAY then
                local ped = spawnGuardPed(g.model, i - 1)
                if ped then g.ped = ped; g.lostAt = nil end
            end
        end
    end
end

-- lock-on "gestures" (replaces the PC hotkeys)
local lockTarget, lockSince, lockFired = nil, 0, false

local function handleLockOn()
    local target = safe(PedGetTargetPed, gPlayer)
    if not target or target == -1 or not isAlive(target) then
        lockTarget, lockFired = nil, false
        return
    end
    if target ~= lockTarget then
        lockTarget, lockSince, lockFired = target, now(), false
        return
    end
    if lockFired then return end
    local held = now() - lockSince
    if isGuard(target) then
        if held >= BG_CONFIG.DISMISS_HOLD then
            lockFired = true
            dismissAll()
        end
    elseif held >= BG_CONFIG.ATTACK_HOLD then
        lockFired = true
        allAttack(target)
        msg("Get 'em!")
    end
end

local function defendPlayer()
    local attacker = safe(PedGetWhoHitMeLast, gPlayer)
    if attacker and attacker ~= -1 and attacker ~= gPlayer
       and not isGuard(attacker) and isAlive(attacker) then
        allAttack(attacker)
    end
end

local function bodyguardTick()
    if not active then return end
    safe(maintainGuards)
    safe(handleLockOn)
    safe(defendPlayer)
end

---------------------------------------------------------------------------
-- MAIN (started by the game when the world loads)
---------------------------------------------------------------------------
function main()
    while (SystemIsReady and not SystemIsReady())
       or (AreaIsLoading and AreaIsLoading()) do
        Wait(0)
    end
    Wait(2000)
    if BG_CONFIG.ENABLED then
        hireAll()
    end
    while true do
        bodyguardTick()
        Wait(0)
    end
end

---------------------------------------------------------------------------
-- ORIGINAL STimeCycle CALLBACKS (called by the game - keep these!)
---------------------------------------------------------------------------
local function XmasActive()
    return IsMissionCompleated("3-R08") and not IsMissionCompleated("3-R08_XMas")
end

function F_RingSchoolBell()
    local area = safe(AreaGetVisible)
    if area == 0 or area == 2 then
        safe(SoundPlay2D, "SchoolBell")
    end
end

function F_AttendedClass()
    if XmasActive() then return end
    SetSkippedClass(false)
    PlayerSetPunishmentPoints(0)
end

function F_MissedClass()
    if XmasActive() then return end
    SetSkippedClass(true)
    StatAddToInt(166)
end

function F_AttendedCurfew()
    if not PedInConversation(gPlayer) and not MissionActive() then
        TextPrintString("You got home in time for curfew", 4)
    end
end

function F_MissedCurfew()
    if not PedInConversation(gPlayer) and not MissionActive() then
        TextPrint("TM_TIRED5", 4, 2)
    end
end

function F_StartClass()
    if XmasActive() then return end
    F_RingSchoolBell()
end

function F_EndClass()
    if XmasActive() then return end
    F_RingSchoolBell()
end

function F_UpdateTimeCycle()
    if not IsMissionCompleated("1-B") then
        local day = GetCurrentDay(false)
        if day < 0 or day > 2 then SetCurrentDay(0) end
    end
end

function F_StartMorning()              F_UpdateTimeCycle() end
function F_EndMorning()                F_UpdateTimeCycle() end
function F_StartLunch()                F_UpdateTimeCycle() end
function F_EndLunch()                  F_UpdateTimeCycle() end
function F_StartAfternoon()            F_UpdateTimeCycle() end
function F_EndAfternoon()              F_UpdateTimeCycle() end
function F_StartEvening()              F_UpdateTimeCycle() end
function F_EndEvening()                F_UpdateTimeCycle() end
function F_StartCurfew_SlightlyTired() F_UpdateTimeCycle() end
function F_StartCurfew_Tired()         F_UpdateTimeCycle() end
function F_StartCurfew_MoreTired()     F_UpdateTimeCycle() end
function F_StartCurfew_TooTired()      F_UpdateTimeCycle() end
function F_EndCurfew_TooTired()        F_UpdateTimeCycle() end
function F_EndTired()                  F_UpdateTimeCycle() end
function F_Nothing() end

function F_ClassWarning()
    if XmasActive() then return end
    local area = safe(AreaGetVisible)
    if area == 0 or area == 2 then
        safe(SoundPlay2D, "ClassWarning")
    end
end

/**
 * All player-facing text.
 *
 * Chat and the action bar are used instead of `@minecraft/server-ui` forms:
 * server-ui is a second script module dependency (another version to get wrong)
 * and full-screen forms are intrusive on a phone, where the player is often
 * being chased while they read.
 */

export const STAGES = [
  { name: "HEALTHY", colour: "§a", min: 0 },
  { name: "EXPOSED", colour: "§e", min: 10 },
  { name: "INFECTED", colour: "§6", min: 40 },
  { name: "CRITICAL", colour: "§c", min: 75 },
];

export function stageIndex(infection) {
  let index = 0;
  for (let i = 0; i < STAGES.length; i++) {
    if (infection >= STAGES[i].min) index = i;
  }
  return index;
}

export function stageOf(infection) {
  return STAGES[stageIndex(infection)];
}

/** Renders 0..100 as a 20-cell bar, coloured by stage. */
export function bar(value, cells = 20) {
  const filled = Math.max(0, Math.min(cells, Math.round((value / 100) * cells)));
  const stage = stageOf(value);
  return `${stage.colour}${"|".repeat(filled)}§8${"|".repeat(cells - filled)}`;
}

export function contaminationLabel(score) {
  if (score >= 26) return "§4EXTREME";
  if (score >= 14) return "§cHIGH";
  if (score >= 6) return "§6MODERATE";
  if (score >= 2) return "§eLOW";
  return "§aNONE";
}

export function threatLabel(level) {
  return (
    ["§aDORMANT", "§eLEVEL 1", "§eLEVEL 2", "§6LEVEL 3", "§cLEVEL 4", "§4LEVEL 5"][
      Math.max(0, Math.min(5, level))
    ] ?? "§7UNKNOWN"
  );
}

export function scanReadout({ infection, contamination, nearbyInfected, nestCount, outbreak, level, day }) {
  const stage = stageOf(infection);
  const lines = [
    "§8§m                              §r",
    "§b§lMYCELIUM-X SCAN§r",
    "",
    `§7Infection: §f${Math.round(infection)}%`,
    `§7Status: ${stage.colour}§l${stage.name}§r`,
    `§7${bar(infection)}§r`,
    `§7Nearby contamination: ${contaminationLabel(contamination)}§r`,
    `§7Hostile signatures: §f${nearbyInfected}§7 within 24m`,
    `§7Fungal nests: §f${nestCount}§7 within 48m`,
  ];
  if (outbreak) {
    lines.push(`§7Outbreak: ${threatLabel(level)} §8(day ${day})§r`);
  } else {
    lines.push("§7Outbreak: §aNO ACTIVE OUTBREAK§r");
  }
  lines.push("§8§m                              §r");
  return lines.join("\n");
}

export function detectorReadout({ contamination, nearest, nestCount, blocksSampled }) {
  const lines = [
    "§8§m                              §r",
    "§d§lCONTAMINATION DETECTOR§r",
    "",
    `§7Local density: ${contaminationLabel(contamination)}§r`,
    `§7Sampled: §f${blocksSampled}§7 volumes`,
    `§7Fungal nests: §f${nestCount}§7 within 64m`,
  ];
  if (nearest) {
    lines.push(
      `§7Nearest source: §f${nearest.distance}m §8${nearest.direction}§r`
    );
  } else {
    lines.push("§7Nearest source: §aout of range§r");
  }
  lines.push("§8§m                              §r");
  return lines.join("\n");
}

export function statusReadout({ outbreak, day, level, lockdown, built, infectedNearby, totalNests }) {
  const lines = [
    "§8§m                              §r",
    "§c§lOUTBREAK STATUS§r",
    "",
    `§7State: ${outbreak ? "§cACTIVE" : "§aCONTAINED"}§r`,
  ];
  if (outbreak) {
    lines.push(`§7Day: §f${day}`);
    lines.push(`§7Threat: ${threatLabel(level)}§r`);
  }
  lines.push(`§7Mansion: ${built ? "§adeployed" : "§8not deployed"}§r`);
  lines.push(`§7Lockdown: ${lockdown ? "§cSEALED" : "§aopen"}§r`);
  lines.push(`§7Infected near you: §f${infectedNearby}`);
  lines.push(`§7Nests near you: §f${totalNests}`);
  lines.push("§8§m                              §r");
  return lines.join("\n");
}

/** Compact single line for the action bar. */
export function actionBar(infection, { outbreak, level, lockdown }) {
  const stage = stageOf(infection);
  let line = `${stage.colour}${stage.name} §8| §7INF §f${Math.round(infection)}%`;
  if (outbreak) line += ` §8| §7THREAT ${threatLabel(level)}`;
  if (lockdown) line += " §8| §c§lLOCKDOWN";
  return line;
}

export const HELP_LINES = [
  "§8§m                              §r",
  "§b§lLUXURY TECH MANSION + MYCELIUM-X§r",
  "",
  "§e/function tech_house §7- deploy the mansion here",
  "§e/function tech_house_now §7- deploy instantly (heavier)",
  "§e/function tech_house_clear §7- remove the mansion",
  "§e/function give_kit §7- full survival equipment kit",
  "",
  "§e/function outbreak_start §7- begin the outbreak",
  "§e/function outbreak_stop §7- end it and clear infection",
  "§e/function outbreak_status §7- current threat report",
  "",
  "§e/function house_lockdown §7- seal the mansion",
  "§e/function house_unlock §7- reopen the mansion",
  "",
  "§e/function scan §7- scan without the handheld device",
  "§e/function nest_here §7- plant a fungal nest at your feet",
  "§e/function cure_me §7- clear your own infection",
  "§e/function infect_me §7- raise your infection (testing)",
  "§8§m                              §r",
];

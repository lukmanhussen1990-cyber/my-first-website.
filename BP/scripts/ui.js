// The Hollow Bride - all player-facing UI.
// server-ui forms only. No custom JSON-UI: it breaks on tall phone aspect ratios.

import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { log } from "./util.js";
import {
  pget,
  pset,
  pnum,
  pstr,
  keyCount,
  hasKey,
  pagesFound
} from "./state.js";
import { PAGES, PAGE_TEXT, CELLAR_NAMES } from "./config.js";

// A phone player is often mid-menu when we want to talk to them. Retry politely.
async function show(form, player, tries) {
  const limit = tries === undefined ? 12 : tries;
  for (let i = 0; i < limit; i++) {
    try {
      const res = await form.show(player);
      if (res.canceled && res.cancelationReason === "UserBusy") {
        await sleep(20);
        continue;
      }
      return res;
    } catch (e) {
      log("form show failed: " + (e && e.message ? e.message : e));
      return { canceled: true };
    }
  }
  return { canceled: true };
}

function sleep(ticks) {
  return new Promise((resolve) => {
    try {
      system.runTimeout(resolve, ticks);
    } catch (e) {
      resolve();
    }
  });
}

// ---- First join settings ----------------------------------------------------

export async function showSettings(player) {
  const form = new ModalFormData()
    .title("Before You Enter")
    .dropdown("Scare Intensity", ["Mild", "Normal", "Hard"], 1)
    .dropdown("Jumpscare Flashes", ["On", "Off"], 0);

  const res = await show(form, player);
  if (res.canceled || !res.formValues) {
    pset(player, "intensity", "normal");
    pset(player, "flashes", true);
    pset(player, "configured", true);
    return;
  }
  const modes = ["mild", "normal", "hard"];
  pset(player, "intensity", modes[res.formValues[0]] || "normal");
  pset(player, "flashes", res.formValues[1] === 0);
  pset(player, "configured", true);
}

// ---- Manor Journal ----------------------------------------------------------

export async function showJournal(player) {
  const keys = keyCount(player);
  const found = pagesFound(player);
  const body =
    "Bone Keys: " + keys + " / 5\n" +
    "Pages: " + found.length + " / 12\n" +
    "Sanity: " + Math.round(pnum(player, "sanity", 100)) + "\n" +
    "Candle: " + Math.round(pnum(player, "candle_fuel", 0) / 12) + "%\n" +
    "Salt left: " + pnum(player, "salt_left", 0) + "\n" +
    "Bell charges: " + pnum(player, "bell_charges", 0);

  const form = new ActionFormData()
    .title("Manor Journal")
    .body(body)
    .button("Objectives")
    .button("Bone Keys")
    .button("Collected Pages")
    .button("Close");

  const res = await show(form, player);
  if (res.canceled) return;
  if (res.selection === 0) return showObjectives(player);
  if (res.selection === 1) return showKeys(player);
  if (res.selection === 2) return showPages(player);
}

async function showObjectives(player) {
  const act = pnum(player, "act", 0);
  const lines = [
    "Read the will in the mailbox. Cross the threshold.",
    "Take the Tallow Candle. Learn the clock.",
    "Nursery: match the toys to the music box.",
    "Cellar: ring the bell on the right name.",
    "Mirror Wing: find the mirror that is real.",
    "Gallery: photograph the dead in order.",
    "Attic: strip the veil, break the chorus, hollow her.",
    "Dawn: get out, or take her place."
  ];
  let body = "";
  for (let i = 0; i <= Math.min(act, lines.length - 1); i++) {
    body += (i < act ? "[done] " : "[now]  ") + lines[i] + "\n";
  }
  const form = new ActionFormData().title("Objectives").body(body).button("Back");
  await show(form, player);
}

async function showKeys(player) {
  const names = [
    "I - The Nursery",
    "II - The Cellar of Names",
    "III - The Mirror Wing",
    "IV - The Portrait Gallery",
    "V - The Attic Heart"
  ];
  let body = "";
  for (let i = 0; i < 5; i++) {
    body += (hasKey(player, i + 1) ? "[X] " : "[ ] ") + names[i] + "\n";
  }
  const form = new ActionFormData().title("Bone Keys").body(body).button("Back");
  await show(form, player);
}

async function showPages(player) {
  const found = pagesFound(player);
  const form = new ActionFormData().title("Collected Pages");
  if (found.length === 0) {
    form.body("You have found nothing worth keeping. Yet.");
    form.button("Back");
    await show(form, player);
    return;
  }
  form.body("Twelve pages were torn out. You have " + found.length + ".");
  for (const id of found) {
    const meta = PAGES.find((p) => p.id === id);
    form.button(meta ? meta.title : "Page " + id);
  }
  form.button("Back");
  const res = await show(form, player);
  if (res.canceled || res.selection === undefined) return;
  const id = found[res.selection];
  if (id === undefined) return;
  const meta = PAGES.find((p) => p.id === id);
  const read = new ActionFormData()
    .title(meta ? meta.title : "Page " + id)
    .body(PAGE_TEXT[id] || "The ink has run.")
    .button("Back");
  await show(read, player);
}

// ---- Bone Camera ------------------------------------------------------------

export async function showPhoto(player, title, body) {
  const form = new ActionFormData()
    .title("What The Bone Camera Saw")
    .body(title + "\n\n" + body)
    .button("Put the camera down");
  await show(form, player);
}

// ---- Seance Bell ------------------------------------------------------------

export async function showBellRiddle(player, riddle, onAnswer) {
  const form = new ModalFormData()
    .title("The House Answers")
    .dropdown(riddle, CELLAR_NAMES, 0);
  const res = await show(form, player);
  if (res.canceled || !res.formValues) return;
  onAnswer(res.formValues[0]);
}

export async function showBellHint(player, text) {
  const form = new ActionFormData()
    .title("The House Answers")
    .body(text)
    .button("Lower the bell");
  await show(form, player);
}

// ---- Mailbox / will ---------------------------------------------------------

export async function showWill(player) {
  const form = new ActionFormData()
    .title("Last Will of Elowen Vane")
    .body(
      "To whoever reads this and is still breathing:\n\n" +
        "Vane Manor and everything inside it passes to you.\n" +
        "The keys are bone. There are five.\n" +
        "Do not let the candle die.\n" +
        "Do not answer the bell twice.\n" +
        "If you meet a bride, she is not a guest."
    )
    .button("Pocket the will");
  await show(form, player);
}

// ---- Endings ----------------------------------------------------------------

export async function showEnding(player, which) {
  const escape =
    "You reach the gate as the roof folds in behind you.\n\n" +
    "In the mailbox is a will. Your name is on it.\n" +
    "It is dated forty years ago.\n\n" +
    "You were never the heir. You were the invitation.";
  const stay =
    "You close the bedroom door from the inside.\n\n" +
    "The house goes quiet in the way a held breath is quiet.\n" +
    "Somewhere below, a gate opens for someone new.\n\n" +
    "You keep the last chair warm.";
  const form = new ActionFormData()
    .title(which === "escape" ? "Ending: Dawn" : "Ending: The Hollow Bride")
    .body(which === "escape" ? escape : stay)
    .button("Close the book");
  await show(form, player);
}

export async function confirmStay(player) {
  const form = new MessageFormData()
    .title("The Locked Bedroom")
    .body("Stay, and the manor stops needing her.\n\nThis ends the run.")
    .button1("Stay")
    .button2("Go back");
  const res = await show(form, player);
  return !res.canceled && res.selection === 0;
}

export { show as showRaw, sleep };

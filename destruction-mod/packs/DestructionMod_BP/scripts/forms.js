// @ts-check
// Opening a form can fail with "UserBusy" (e.g. the chat or another screen is
// still closing). These wrappers retry for a moment instead of giving up.
import { FormCancelationReason } from "@minecraft/server-ui";
import { wait } from "./util.js";

/** @typedef {import("@minecraft/server").Player} Player */

/**
 * @template {import("@minecraft/server-ui").FormResponse} R
 * @param {() => Promise<R>} open
 * @returns {Promise<R | undefined>}
 */
async function retryWhileBusy(open) {
  for (let i = 0; i < 12; i++) {
    let res;
    try {
      res = await open();
    } catch {
      return undefined; // player left
    }
    if (res.canceled && res.cancelationReason === FormCancelationReason.UserBusy) {
      await wait(8);
      continue;
    }
    return res;
  }
  return undefined;
}

/** @param {Player} player @param {import("@minecraft/server-ui").ActionFormData} form */
export function showAction(player, form) {
  return retryWhileBusy(() => form.show(player));
}

/** @param {Player} player @param {import("@minecraft/server-ui").ModalFormData} form */
export function showModal(player, form) {
  return retryWhileBusy(() => form.show(player));
}

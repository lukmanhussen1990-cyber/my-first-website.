// Mock of @minecraft/server-ui 1.1.0: ActionFormData, ModalFormData, MessageFormData.
// show() records the built form and resolves with a response queued by the test
// (see __ui below / README). Without a queued response the form resolves as
// canceled with cancelationReason "UserClosed".

import { Player, __mock } from "./server.mjs";

export const FormCancelationReason = Object.freeze({ UserBusy: "UserBusy", UserClosed: "UserClosed" });
export const FormRejectReason = Object.freeze({
  MalformedResponse: "MalformedResponse",
  PlayerQuit: "PlayerQuit",
  ServerShutdown: "ServerShutdown",
});

export class FormRejectError extends Error {
  constructor(reason) {
    super(`Form rejected: ${reason}`);
    this.name = "FormRejectError";
    this.reason = reason;
  }
}

const INTERNAL = Symbol("ui.internal");

export class FormResponse {
  constructor(token, props) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    Object.assign(this, props);
  }
}
export class ActionFormResponse extends FormResponse {}
export class MessageFormResponse extends FormResponse {}
export class ModalFormResponse extends FormResponse {}

const UI = {
  shown: [],
  queue: [], // {player?: string(id|name), response}
  handler: undefined,
};

function checkText(v, what) {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") return v; // RawMessage
  throw new TypeError(`${what}: expected string or RawMessage`);
}

function takeResponse(record) {
  if (UI.handler) {
    const r = UI.handler(record);
    if (r !== undefined) return r;
  }
  const i = UI.queue.findIndex((q) => !q.player || q.player === record.playerId || q.player === record.playerName);
  if (i >= 0) return UI.queue.splice(i, 1)[0].response;
  return { canceled: true, cancelationReason: FormCancelationReason.UserClosed };
}

function show(form, kind, player) {
  if (!(player instanceof Player)) throw new TypeError(`${kind}.show: argument must be a Player`);
  if (!player.isValid()) return Promise.reject(new FormRejectError(FormRejectReason.PlayerQuit));
  const record = {
    kind,
    playerId: player.id,
    playerName: player.name,
    tick: __mock.currentTick,
    title: form.titleText,
    body: form.bodyText,
    buttons: form.buttons ? form.buttons.map((b) => ({ ...b })) : undefined,
    button1: form.button1Text,
    button2: form.button2Text,
    controls: form.controls ? form.controls.map((c) => ({ ...c })) : undefined,
  };
  UI.shown.push(record);
  const r = takeResponse(record);
  return new Promise((resolve, reject) => {
    queueMicrotask(() => {
      if (r.reject) return reject(new FormRejectError(r.reject));
      if (r.canceled) {
        const props = { canceled: true, cancelationReason: r.cancelationReason ?? FormCancelationReason.UserClosed };
        if (kind === "ModalFormData") return resolve(new ModalFormResponse(INTERNAL, { ...props, formValues: undefined }));
        if (kind === "MessageFormData") return resolve(new MessageFormResponse(INTERNAL, { ...props, selection: undefined }));
        return resolve(new ActionFormResponse(INTERNAL, { ...props, selection: undefined }));
      }
      if (kind === "ActionFormData") {
        const sel = r.selection;
        if (!Number.isInteger(sel) || sel < 0 || sel >= record.buttons.length) {
          return reject(new Error(`mock ui: selection ${sel} invalid for ActionForm with ${record.buttons.length} buttons`));
        }
        return resolve(new ActionFormResponse(INTERNAL, { canceled: false, cancelationReason: undefined, selection: sel }));
      }
      if (kind === "MessageFormData") {
        const sel = r.selection;
        if (sel !== 0 && sel !== 1) return reject(new Error(`mock ui: MessageForm selection must be 0 (button1) or 1 (button2), got ${sel}`));
        return resolve(new MessageFormResponse(INTERNAL, { canceled: false, cancelationReason: undefined, selection: sel }));
      }
      // ModalFormData: defaults from the controls, overridden by r.formValues (array) or r.values ({index|label: value})
      const vals = record.controls.map((c) => c.defaultValue);
      if (Array.isArray(r.formValues)) r.formValues.forEach((v, i) => (vals[i] = v));
      if (r.values) {
        for (const [k, v] of Object.entries(r.values)) {
          const idx = /^\d+$/.test(k) ? Number(k) : record.controls.findIndex((c) => c.label === k);
          if (idx < 0 || idx >= vals.length) return reject(new Error(`mock ui: unknown modal control '${k}'`));
          vals[idx] = v;
        }
      }
      for (let i = 0; i < vals.length; i++) {
        const c = record.controls[i];
        const v = vals[i];
        const bad =
          (c.type === "slider" && (typeof v !== "number" || v < c.min || v > c.max)) ||
          (c.type === "toggle" && typeof v !== "boolean") ||
          (c.type === "dropdown" && (!Number.isInteger(v) || v < 0 || v >= c.options.length)) ||
          (c.type === "textField" && typeof v !== "string");
        if (bad) return reject(new Error(`mock ui: value ${JSON.stringify(v)} invalid for ${c.type} '${c.label}'`));
      }
      return resolve(new ModalFormResponse(INTERNAL, { canceled: false, cancelationReason: undefined, formValues: vals }));
    });
  });
}

export class ActionFormData {
  constructor() {
    this.titleText = "";
    this.bodyText = "";
    this.buttons = [];
  }
  title(titleText) {
    this.titleText = checkText(titleText, "title");
    return this;
  }
  body(bodyText) {
    this.bodyText = checkText(bodyText, "body");
    return this;
  }
  button(text, iconPath) {
    this.buttons.push({ text: checkText(text, "button"), iconPath });
    return this;
  }
  show(player) {
    return show(this, "ActionFormData", player);
  }
}

export class MessageFormData {
  constructor() {
    this.titleText = "";
    this.bodyText = "";
    this.button1Text = "";
    this.button2Text = "";
  }
  title(t) {
    this.titleText = checkText(t, "title");
    return this;
  }
  body(b) {
    this.bodyText = checkText(b, "body");
    return this;
  }
  button1(t) {
    this.button1Text = checkText(t, "button1");
    return this;
  }
  button2(t) {
    this.button2Text = checkText(t, "button2");
    return this;
  }
  show(player) {
    return show(this, "MessageFormData", player);
  }
}

export class ModalFormData {
  constructor() {
    this.titleText = "";
    this.controls = [];
  }
  title(t) {
    this.titleText = checkText(t, "title");
    return this;
  }
  dropdown(label, options, defaultValueIndex = 0) {
    if (!Array.isArray(options) || options.length === 0) throw new TypeError("dropdown: options must be a non-empty array");
    this.controls.push({ type: "dropdown", label: checkText(label, "dropdown"), options: [...options], defaultValue: defaultValueIndex });
    return this;
  }
  slider(label, minimumValue, maximumValue, valueStep, defaultValue) {
    if (!(maximumValue >= minimumValue)) throw new RangeError("slider: maximumValue < minimumValue");
    if (!(valueStep > 0)) throw new RangeError("slider: valueStep must be > 0");
    this.controls.push({ type: "slider", label: checkText(label, "slider"), min: minimumValue, max: maximumValue, step: valueStep, defaultValue: defaultValue ?? minimumValue });
    return this;
  }
  textField(label, placeholderText, defaultValue = "") {
    this.controls.push({ type: "textField", label: checkText(label, "textField"), placeholder: placeholderText, defaultValue });
    return this;
  }
  toggle(label, defaultValue = false) {
    this.controls.push({ type: "toggle", label: checkText(label, "toggle"), defaultValue: !!defaultValue });
    return this;
  }
  show(player) {
    return show(this, "ModalFormData", player);
  }
}

/** Test control for forms. */
export const __ui = {
  /** Every form shown so far: {kind, playerId, playerName, tick, title, body, buttons, button1, button2, controls}. */
  get shown() {
    return UI.shown;
  },
  last() {
    return UI.shown[UI.shown.length - 1];
  },
  /**
   * Queue the response for the next form shown (to `player` if given, matched by id or name).
   * response: {selection: n} (action/message), {formValues: [...]} or {values: {label|index: v}} (modal),
   *           {canceled: true, cancelationReason?}, or {reject: "PlayerQuit"}.
   */
  respond(response, player) {
    UI.queue.push({ player: player ? (typeof player === "string" ? player : player.id) : undefined, response });
  },
  /** Choose the action-form button whose text matches (string or RegExp) when the next form shows. */
  pressButton(match, player) {
    this.setHandler((rec) => {
      if (player && rec.playerId !== (typeof player === "string" ? player : player.id)) return undefined;
      if (rec.kind !== "ActionFormData") return undefined;
      const idx = rec.buttons.findIndex((b) => (match instanceof RegExp ? match.test(String(b.text)) : b.text === match));
      this.setHandler(undefined);
      if (idx < 0) throw new Error(`mock ui: no button matching ${match} in ${JSON.stringify(rec.buttons.map((b) => b.text))}`);
      return { selection: idx };
    });
  },
  /** handler(record) -> response | undefined (undefined falls back to the queue). */
  setHandler(fn) {
    UI.handler = fn;
  },
  pending() {
    return UI.queue.length;
  },
  reset() {
    UI.shown.length = 0;
    UI.queue.length = 0;
    UI.handler = undefined;
  },
};

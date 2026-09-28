// Minimal mock of @minecraft/server-ui 1.1.0 for headless smoke tests.

export const FormCancelationReason = { UserBusy: "UserBusy", UserClosed: "UserClosed" };
export const FormRejectReason = { MalformedResponse: "MalformedResponse", PlayerQuit: "PlayerQuit", ServerShutdown: "ServerShutdown" };
export const uiLog = { shown: [] };
const responses = [];

/** Queue the response for the next form shown. */
export function __respond(r) {
  responses.push(r);
}

class Form {
  constructor(kind) {
    this.kind = kind;
    this.buttons = [];
    this.controls = [];
  }
  title(t) {
    this._title = t;
    return this;
  }
  body(b) {
    this._body = b;
    return this;
  }
  button(text, icon) {
    this.buttons.push({ text, icon });
    return this;
  }
  dropdown(label, options, def) {
    this.controls.push({ type: "dropdown", label, options, def });
    return this;
  }
  toggle(label, def) {
    this.controls.push({ type: "toggle", label, def });
    return this;
  }
  slider(label, min, max, step, def) {
    this.controls.push({ type: "slider", label, min, max, step, def });
    return this;
  }
  textField(label, placeholder, def) {
    this.controls.push({ type: "text", label, placeholder, def });
    return this;
  }
  button1(t) {
    this.buttons[0] = { text: t };
    return this;
  }
  button2(t) {
    this.buttons[1] = { text: t };
    return this;
  }
  show(player) {
    uiLog.shown.push({ kind: this.kind, title: this._title, body: this._body, buttons: this.buttons, controls: this.controls, player: player.id });
    const r = responses.shift() ?? { canceled: true, cancelationReason: FormCancelationReason.UserClosed };
    return Promise.resolve(r);
  }
}

export class ActionFormData extends Form {
  constructor() {
    super("action");
  }
}
export class ModalFormData extends Form {
  constructor() {
    super("modal");
  }
}
export class MessageFormData extends Form {
  constructor() {
    super("message");
  }
}

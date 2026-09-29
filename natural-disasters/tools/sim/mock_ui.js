// Mock of @minecraft/server-ui 1.1.0 used by the headless simulation.
export const FormCancelationReason = { UserBusy: 'UserBusy', UserClosed: 'UserClosed' };

/** queue of scripted responses: each is a function(form) -> response object */
export const uiScript = { queue: [], shown: [] };

class Base {
  constructor() { this.calls = []; }
  title(t) { this.calls.push(['title', t]); return this; }
  async show(player) {
    uiScript.shown.push({ kind: this.constructor.name, calls: this.calls });
    const next = uiScript.queue.shift();
    if (!next) return { canceled: true, cancelationReason: FormCancelationReason.UserClosed };
    return next(this);
  }
}
export class ModalFormData extends Base {
  slider(label, min, max, step, def) {
    if (!(min < max) || !(step > 0)) throw new Error('bad slider');
    if (def !== undefined && (def < min || def > max)) throw new Error('slider default out of range: ' + label);
    this.calls.push(['slider', label, min, max, step, def]); return this;
  }
  toggle(label, def) { this.calls.push(['toggle', label, def]); return this; }
  dropdown(label, options, def) {
    if (!Array.isArray(options) || options.length === 0) throw new Error('bad dropdown');
    if (def !== undefined && (def < 0 || def >= options.length)) throw new Error('dropdown default out of range: ' + label);
    this.calls.push(['dropdown', label, options, def]); return this;
  }
  textField(label) { this.calls.push(['textField', label]); return this; }
}
export class ActionFormData extends Base {
  body(t) { this.calls.push(['body', t]); return this; }
  button(t) { this.calls.push(['button', t]); return this; }
}
export class MessageFormData extends Base {
  body(t) { this.calls.push(['body', t]); return this; }
  button1(t) { this.calls.push(['button1', t]); return this; }
  button2(t) { this.calls.push(['button2', t]); return this; }
}

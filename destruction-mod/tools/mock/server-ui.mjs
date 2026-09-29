// Fake @minecraft/server-ui (1.1.0 surface). Tests queue answers in
// `answers`; each answer is a function (form) => response fields.

export const FormCancelationReason = { UserBusy: "UserBusy", UserClosed: "UserClosed" };
export const answers = [];
export const shown = [];

function reply(form) {
  shown.push(form);
  const next = answers.shift();
  if (!next) return Promise.resolve({ canceled: true, cancelationReason: FormCancelationReason.UserClosed });
  return Promise.resolve({ canceled: false, ...next(form) });
}

class Form {
  title(t) {
    this.titleText = String(t);
    return this;
  }
  body(b) {
    this.bodyText = String(b);
    return this;
  }
}

export class ActionFormData extends Form {
  buttons = [];
  button(text, icon) {
    if (icon !== undefined && typeof icon !== "string") throw new Error("icon must be a string");
    this.buttons.push({ text: String(text), icon });
    return this;
  }
  async show(player) {
    const res = await reply(this);
    if (res.selection !== undefined && (res.selection < 0 || res.selection >= this.buttons.length)) {
      throw new Error(`selection ${res.selection} out of range for "${this.titleText}"`);
    }
    return res;
  }
}

export class ModalFormData extends Form {
  controls = [];
  textField(label, placeholder, def) {
    if (def !== undefined && typeof def !== "string") throw new Error("textField default must be a string");
    this.controls.push({ type: "text", label, def: def ?? "" });
    return this;
  }
  slider(label, min, max, step, def) {
    if (!(min < max) || !(step > 0)) throw new Error("bad slider range");
    if (def !== undefined && (def < min || def > max || (def - min) % step !== 0)) {
      throw new Error(`slider default ${def} not in ${min}..${max} step ${step}`);
    }
    this.controls.push({ type: "slider", label, def: def ?? min });
    return this;
  }
  dropdown(label, options, def) {
    if (!options.length) throw new Error("empty dropdown");
    if (def !== undefined && (def < 0 || def >= options.length || !Number.isInteger(def))) {
      throw new Error(`dropdown default ${def} out of range`);
    }
    this.controls.push({ type: "dropdown", label, def: def ?? 0, options });
    return this;
  }
  toggle(label, def) {
    this.controls.push({ type: "toggle", label, def: def ?? false });
    return this;
  }
  async show(player) {
    const res = await reply(this);
    if (res.canceled) return res;
    const values = res.formValues ?? this.controls.map((c) => c.def);
    if (values.length !== this.controls.length) throw new Error("formValues length mismatch");
    return { canceled: false, formValues: values };
  }
}

export class MessageFormData extends Form {
  button1() {
    return this;
  }
  button2() {
    return this;
  }
  show() {
    return reply(this);
  }
}

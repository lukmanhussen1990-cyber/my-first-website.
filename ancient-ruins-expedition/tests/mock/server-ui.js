// Stand-in for @minecraft/server-ui 1.1.0 (ActionFormData only).
export const ui = { shown: [], respond: () => ({ canceled: true }) };

export class ActionFormData {
  constructor() {
    this.buttons = [];
    this.titleText = "";
    this.bodyText = "";
  }
  title(t) { this.titleText = t; return this; }
  body(t) { this.bodyText = t; return this; }
  button(t) { this.buttons.push(t); return this; }
  show(player) {
    ui.shown.push({ player, form: this });
    return Promise.resolve(ui.respond(this));
  }
}

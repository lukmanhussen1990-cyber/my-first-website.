// DOM overlays: title, pause, end screens, captions, notes and toasts.

const $ = (id) => document.getElementById(id);

function safeStore(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    // Storage is optional.
  }
  return null;
}

export class UI {
  constructor() {
    this.el = {
      loading: $('loading'),
      loadingBar: $('loading-bar'),
      loadingText: $('loading-text'),
      title: $('title'),
      pause: $('pause'),
      end: $('end'),
      hud: $('hud'),
      caption: $('caption'),
      note: $('note'),
      card: $('titlecard'),
      hint: $('hint'),
      toast: $('toast'),
      endCount: $('end-count'),
      endList: $('end-list'),
      endTime: $('end-time'),
      error: $('error'),
    };
    this.captionsOn = safeStore('np-captions') !== '0';
    this._timers = {};
    const cb = $('opt-captions');
    if (cb) cb.checked = this.captionsOn;
  }

  static load(key, fallback) {
    const v = safeStore(key);
    return v === null || v === undefined ? fallback : v;
  }

  static save(key, value) {
    safeStore(key, String(value));
  }

  progress(fraction, text) {
    this.el.loadingBar.style.transform = `scaleX(${Math.max(0.02, fraction)})`;
    if (text) this.el.loadingText.textContent = text;
  }

  hideLoading() {
    this.el.loading.classList.add('gone');
    setTimeout(() => { this.el.loading.hidden = true; }, 900);
  }

  showError(message) {
    this.el.loading.hidden = true;
    this.el.error.hidden = false;
    this.el.error.querySelector('p').textContent = message;
  }

  show(name) {
    for (const k of ['title', 'pause', 'end']) this.el[k].hidden = k !== name;
    document.body.dataset.screen = name || 'play';
  }

  _fade(el, text, seconds, key) {
    clearTimeout(this._timers[key]);
    el.textContent = text;
    el.classList.add('on');
    this._timers[key] = setTimeout(() => el.classList.remove('on'), seconds * 1000);
  }

  caption(text, seconds = 5) {
    if (!this.captionsOn) return;
    this._fade(this.el.caption, text, seconds, 'caption');
  }

  note(text) {
    this._fade(this.el.note, text, 5.5, 'note');
  }

  toast(text) {
    this._fade(this.el.toast, text, 2.2, 'toast');
  }

  hint(text, seconds = 7) {
    this._fade(this.el.hint, text, seconds, 'hint');
  }

  titleCard(time, place) {
    const el = this.el.card;
    el.querySelector('.time').textContent = time;
    el.querySelector('.place').textContent = place;
    clearTimeout(this._timers.card);
    el.classList.add('on');
    this._timers.card = setTimeout(() => el.classList.remove('on'), 5200);
  }

  setCaptions(on) {
    this.captionsOn = on;
    safeStore('np-captions', on ? '1' : '0');
    if (!on) this.el.caption.classList.remove('on');
  }

  toggleHud() {
    this.el.hud.classList.toggle('hidden');
  }

  showEnd(summary) {
    this.el.endCount.textContent = `${summary.count} of ${summary.total}`;
    const mins = Math.floor(summary.time / 60);
    const secs = Math.floor(summary.time % 60);
    this.el.endTime.textContent = `${mins}:${String(secs).padStart(2, '0')} on the road`;
    this.el.endList.replaceChildren(...summary.items.map((it) => {
      const li = document.createElement('li');
      li.className = it.seen ? 'seen' : 'missed';
      li.textContent = it.seen ? it.label : 'Something you didn’t see';
      return li;
    }));
    this.show('end');
  }
}

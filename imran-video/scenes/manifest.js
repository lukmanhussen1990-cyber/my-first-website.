// Scene files, loaded in parallel; each registers itself with SCENE({...}).
window.SCENE_FILES = ['chat.js'];
window.SCENES_LOADED = Promise.all(SCENE_FILES.map((f) => new Promise((res) => {
  const s = document.createElement('script');
  s.src = 'scenes/' + f;
  s.onload = res;
  s.onerror = () => { window.__errors.push('failed to load scenes/' + f); res(); };
  document.head.appendChild(s);
})));

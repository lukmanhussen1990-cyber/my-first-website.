(function () {
  'use strict';
  window.Photosynthesis = window.Photosynthesis || {};

  // "Save picture" on the finale: a PNG of the scene with a caption band.

  // Player-facing strings.
  const copy = {
    button: 'Save picture',
    title: 'Sun to Sugar',
    equation: '6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂',
    results: 'Score {score} · {stars} of {max} stars · O₂ {o2} · ATP {atp} · NADPH {nadph} · CO₂ {co2}',
    failed: 'Could not save the picture.'
  };

  // Palette from the spec.
  const COLOR = { ink: '#0c1a16', sun: '#ffd166', text: '#eaf5ee', muted: '#9fbfb0' };

  const BUTTON_ID = 'btn-save-picture';
  const FILE_NAME = 'sun-to-sugar.png';
  const PICTURE_WIDTH = 1200;   // px
  const CAPTION_HEIGHT = 220;   // px, below the scene
  const MAX_STARS = 12;
  const REVOKE_DELAY_MS = 5000;

  const CSS = [
    '#btn-save-picture { min-width: 200px; margin-top: 18px; }',
    '#btn-save-picture + #overlay-button { margin-top: 12px; }'
  ].join('\n');

  let lastFinale = null;   // detail of the latest finale event, read by the caption

  // Replaces each {key} with values[key].
  function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, function (match, key) {
      return key in values ? String(values[key]) : match;
    });
  }

  // A finale number as plain text. A missing value reads as 0.
  function show(value) {
    const number = Number(value);
    return isFinite(number) ? String(number) : '0';
  }

  function resultsLine() {
    const f = lastFinale || {};
    const s = f.stats || {};
    return fill(copy.results, {
      score: show(f.score),
      stars: show(f.stars),
      max: MAX_STARS,
      o2: show(s.o2),
      atp: show(s.atp),
      nadph: show(s.nadph),
      co2: show(s.co2)
    });
  }

  // The button sits in the finale card, directly before #overlay-button.
  function showButton() {
    hideButton();
    const card = document.querySelector('.overlay-card');
    const anchor = document.getElementById('overlay-button');
    if (!card || !anchor || anchor.parentNode !== card) return;
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.className = 'btn btn-ghost';
    button.type = 'button';
    button.textContent = copy.button;
    button.addEventListener('click', savePicture);
    card.insertBefore(button, anchor);
  }

  function hideButton() {
    const button = document.getElementById(BUTTON_ID);
    if (button && button.parentNode) button.parentNode.removeChild(button);
  }

  function fail() {
    const status = document.getElementById('status');
    if (status) status.textContent = copy.failed;
  }

  function fontFamily() {
    try {
      return window.getComputedStyle(document.body).fontFamily || 'sans-serif';
    } catch (error) {
      return 'sans-serif';
    }
  }

  // Shrinks the font, two pixels at a time, until the text fits maxWidth.
  function fitFont(ctx, text, weight, size, maxWidth, family) {
    let px = size;
    ctx.font = weight + ' ' + px + 'px ' + family;
    while (px > 16 && ctx.measureText(text).width > maxWidth) {
      px -= 2;
      ctx.font = weight + ' ' + px + 'px ' + family;
    }
  }

  // Three centred lines on the ink band, which starts at y = top.
  function drawCaption(ctx, width, top) {
    const family = fontFamily();
    const maxWidth = width - 120;
    const cx = width / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    fitFont(ctx, copy.title, 700, 64, maxWidth, family);
    ctx.fillStyle = COLOR.sun;
    ctx.fillText(copy.title, cx, top + 60);

    fitFont(ctx, copy.equation, 600, 40, maxWidth, family);
    ctx.fillStyle = COLOR.text;
    ctx.fillText(copy.equation, cx, top + 122);

    const results = resultsLine();
    fitFont(ctx, results, 400, 30, maxWidth, family);
    ctx.fillStyle = COLOR.muted;
    ctx.fillText(results, cx, top + 174);
  }

  // Scene pixels scaled to PICTURE_WIDTH on top, the caption band below.
  function buildPicture(scene) {
    const sceneHeight = Math.round(PICTURE_WIDTH * scene.height / scene.width);
    const canvas = document.createElement('canvas');   // offscreen, never attached
    canvas.width = PICTURE_WIDTH;
    canvas.height = sceneHeight + CAPTION_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = COLOR.ink;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(scene, 0, 0, PICTURE_WIDTH, sceneHeight);
    drawCaption(ctx, PICTURE_WIDTH, sceneHeight);
    return canvas;
  }

  function triggerDownload(href) {
    const link = document.createElement('a');
    link.href = href;
    link.download = FILE_NAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function onBlob(blob) {
    let url = null;
    try {
      if (!blob) throw new Error('no picture');
      url = URL.createObjectURL(blob);
      triggerDownload(url);
      setTimeout(function () { URL.revokeObjectURL(url); }, REVOKE_DELAY_MS);
    } catch (error) {
      if (url) URL.revokeObjectURL(url);
      fail();
    }
  }

  function savePicture() {
    try {
      const status = document.getElementById('status');
      if (status && status.textContent === copy.failed) status.textContent = '';
      const scene = document.getElementById('scene');
      if (!scene || !scene.width || !scene.height) throw new Error('no scene');
      const picture = buildPicture(scene);
      if (typeof picture.toBlob === 'function') {
        picture.toBlob(onBlob, 'image/png');
      } else {
        triggerDownload(picture.toDataURL('image/png'));
      }
    } catch (error) {
      fail();
    }
  }

  function onPhotoEvent(event) {
    try {
      const detail = event && event.detail;
      if (!detail) return;
      if (detail.type === 'finale') {
        lastFinale = detail;
        showButton();
      } else if (detail.type === 'restart' || (detail.type === 'screen' && detail.screen !== 'finale')) {
        hideButton();
      }
    } catch (error) {
      // An optional feature must never break the game.
    }
  }

  function init() {
    try {
      if (!document.querySelector('style[data-feature="share"]')) {
        const style = document.createElement('style');
        style.setAttribute('data-feature', 'share');
        style.textContent = CSS;
        (document.head || document.documentElement).appendChild(style);
      }
    } catch (error) {
      // The button works without the extra spacing.
    }
    document.addEventListener('photo:event', onPhotoEvent);
  }

  window.Photosynthesis.share = { savePicture: savePicture };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

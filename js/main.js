(() => {
  const audio = document.getElementById('audio');
  const controls = document.getElementById('controls');
  const playBtn = document.getElementById('play');
  const seek = document.getElementById('seek');
  const timeEl = document.getElementById('time');
  const mercy = document.getElementById('mercy');
  const grid = document.getElementById('grid');
  const stageText = document.getElementById('stage-text');
  const transcript = document.getElementById('transcript');
  const lines = [...transcript.querySelectorAll('.line')];
  const phrases = [...transcript.querySelectorAll('.phrase')].map((el, i) => {
    el.dataset.index = i;
    return { el, i, start: parseFloat(el.dataset.start), line: lines.indexOf(el.closest('.line')) };
  });

  // What the 100 dots show at each moment of the narration (seconds)
  const SCENES = [
    [0, 'intro'],
    [5.9, 'hundred'], // "...in one hundred parts"
    [8.9, 'one'], // "He sent down only one part..."
    [28, 'kept'], // "The other ninety-nine..."
    [33.6, 'hope'], // "So never lose hope"
  ];
  const ONE_PART = 94; // the dot that is "sent down"
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  for (let i = 0; i < 100; i++) {
    const dot = document.createElement('span');
    dot.className = i === ONE_PART ? 'dot dot-one' : 'dot';
    // Light up from the centre outwards
    const row = Math.floor(i / 10);
    const col = i % 10;
    dot.style.setProperty('--d', Math.round(Math.hypot(row - 4.5, col - 4.5) * 110));
    grid.append(dot);
  }

  // Swap the browser's audio controls for our own
  audio.removeAttribute('controls');
  controls.hidden = false;

  let started = false;
  let activePhrase = -1;
  let activeLine = -1;
  let frame = 0;
  let transcriptVisible = false;

  const formatTime = (s) => {
    s = Math.max(0, Math.floor(s));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const duration = () =>
    Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : parseFloat(seek.max);

  const phraseAt = (t) => {
    let index = 0;
    for (const p of phrases) {
      if (p.start <= t) index = p.i;
      else break;
    }
    return index;
  };

  const sceneAt = (t) => {
    let scene = SCENES[0][1];
    for (const [at, name] of SCENES) if (t >= at) scene = name;
    return scene;
  };

  const setState = (state) => {
    document.body.dataset.state = state;
    const labels = { playing: 'Pause', ended: 'Play again' };
    playBtn.setAttribute('aria-label', labels[state] || 'Play');
  };

  function showLine(index) {
    const copies = [...lines[index].querySelectorAll('.phrase')].map((el) => el.cloneNode(true));
    stageText.replaceChildren(...copies.flatMap((el, i) => (i ? [' ', el] : [el])));
    if (!reducedMotion.matches) {
      stageText.classList.remove('enter');
      void stageText.offsetWidth; // restart the animation
      stageText.classList.add('enter');
    }
  }

  function followLine(line) {
    if (!transcriptVisible || audio.paused) return;
    const box = line.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) {
      line.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
  }

  function render(t) {
    const d = duration();
    seek.value = t;
    seek.style.setProperty('--progress', `${Math.min(100, (t / d) * 100)}%`);
    timeEl.textContent = `${formatTime(t)} / ${formatTime(d)}`;

    if (!started) return;
    mercy.dataset.scene = sceneAt(t);

    const index = phraseAt(t);
    if (index === activePhrase) return;
    activePhrase = index;

    const lineIndex = phrases[index].line;
    if (lineIndex !== activeLine) {
      activeLine = lineIndex;
      lines.forEach((line, i) => {
        line.classList.toggle('is-current', i === lineIndex);
        line.classList.toggle('is-past', i < lineIndex);
      });
      showLine(lineIndex);
      followLine(lines[lineIndex]);
    }

    phrases.forEach((p) => p.el.classList.toggle('is-active', p.i === index));
    stageText.querySelectorAll('.phrase').forEach((el) => {
      el.classList.toggle('is-upcoming', Number(el.dataset.index) > index);
    });
  }

  function tick() {
    render(audio.currentTime);
    frame = requestAnimationFrame(tick);
  }

  function playFrom(t) {
    audio.currentTime = t;
    audio.play();
  }

  playBtn.addEventListener('click', () => {
    if (audio.ended) playFrom(0);
    else if (audio.paused) audio.play();
    else audio.pause();
  });

  seek.addEventListener('input', () => {
    const t = parseFloat(seek.value);
    audio.currentTime = t;
    if (!started || audio.ended) {
      started = true;
      setState('paused');
    }
    render(t);
  });

  audio.addEventListener('loadedmetadata', () => {
    seek.max = audio.duration;
    render(audio.currentTime);
  });

  audio.addEventListener('play', () => {
    started = true;
    setState('playing');
    cancelAnimationFrame(frame);
    tick();
  });

  audio.addEventListener('pause', () => {
    cancelAnimationFrame(frame);
    if (!audio.ended) setState('paused');
    render(audio.currentTime);
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.paused) render(audio.currentTime);
  });

  audio.addEventListener('ended', () => {
    cancelAnimationFrame(frame);
    setState('ended');
    mercy.dataset.scene = 'final';
    stageText.querySelectorAll('.phrase').forEach((el) => el.classList.remove('is-upcoming'));
  });

  // Tap any line to listen from there
  lines.forEach((line, i) => {
    const start = phrases.find((p) => p.line === i).start;
    line.tabIndex = 0;
    line.setAttribute('role', 'button');
    line.title = 'Play from here';
    line.addEventListener('click', () => playFrom(start));
    line.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        playFrom(start);
      }
    });
  });

  new IntersectionObserver(([entry]) => {
    transcriptVisible = entry.isIntersecting;
  }).observe(transcript);

  // ---------- Sharing ----------

  const toast = document.getElementById('toast');
  const shareUrl = location.href.split('#')[0];
  const shareText = "How big is Allah's mercy? A 42-second reminder for anyone who needs hope today.";
  let toastTimer = 0;

  const showToast = (message) => {
    toast.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.textContent = ''), 4000);
  };

  const nativeShare = () =>
    navigator.share({ title: document.title, text: shareText, url: shareUrl }).catch(() => {});

  document.getElementById('share-whatsapp').href =
    `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;

  if (navigator.share) {
    const nativeBtn = document.getElementById('share-native');
    nativeBtn.hidden = false;
    nativeBtn.addEventListener('click', nativeShare);
  }

  document.getElementById('stage-share').addEventListener('click', () => {
    if (navigator.share) nativeShare();
    else document.getElementById('share').scrollIntoView();
  });

  document.getElementById('share-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link copied. Paste it to someone who needs it.');
    } catch {
      showToast(`Copy this link: ${shareUrl}`);
    }
  });
})();

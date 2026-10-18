YOUR MODULE: the AUDIO — music score, ambience, foley, dialogue processing, final mix, and lip-sync envelopes.
Write Python scripts in /home/user/my-first-website./warrior-reel/audio/ (e.g. audio/score.py, audio/mix.py, audio/build_all.py) that read timeline/timeline.json
and produce (deterministically) in /home/user/my-first-website./warrior-reel/out/audio/:
  music.wav, stems/dialogue_JESUS.wav, stems/dialogue_KNIGHT.wav, stems/ambience.wav, stems/foley.wav, mix.wav (final,
  48 kHz stereo 24-bit, length exactly timeline.duration), mouth.json, and a short report (loudness numbers).
Tools available: python3 with numpy, scipy, soundfile, pyloudnorm, pretty_midi; fluidsynth CLI with /usr/share/sounds/sf2/FluidR3_GM.sf2
(render MIDI via: fluidsynth -ni -g 0.6 -r 48000 -F out.wav /usr/share/sounds/sf2/FluidR3_GM.sf2 in.mid), ffmpeg. pip install
more if needed (pip install --break-system-packages ...). You cannot listen, so verify with analysis (levels, spectra, clipping,
LUFS, onset timing).
MUSIC: gentle, cinematic, emotionally supportive, never drowning the dialogue. Compose in code (pretty_midi) with real musical
craft: e.g. D minor/F major colour, slow tempo (~66 bpm, free timing aligned to beats in the timeline), instruments: String
Ensemble/Slow Strings pad, Cello sustained bass, soft Piano or Harp motif (a simple memorable 4-6 note motif), very light Choir
Aahs only at the resolution. Shape: hook (0-3.6 s) low tense drone + single piano notes; establishing shot opens a little (title);
dialogue section sparse and warm, harmonically uneasy while the knight speaks of betrayal; a gradual swell across the sword moment
(beats.swordLookStart -> swordSettleEnd) resolving from minor to the relative/parallel major exactly as the sword tip touches the
ground (beats.swordTipDown); warmer, fuller from beats.goldenStart; a final sustained major chord through the end card
(beats.endCardStart) and a clean fade-out over the last ~1.5 s. Add a synthetic stereo reverb (e.g. convolution with a
decaying-noise IR) for space. Duck music ~7-9 dB under speech (smoothed sidechain from the dialogue stems).
DIALOGUE: place each cue's mp3 (cue.file, at cue.fileStart) from timeline.json. Per line: high-pass ~75 Hz, gentle denoise or
downward expansion ONLY in the gaps/tails (the Jesus takes have a noise floor around -40 dB; no musical-noise artifacts), light
compression, loudness-match so both characters sit at the same perceived level (the knight takes are much quieter at the source),
no reverb/echo. Keep each character on its own labeled stem (requirement: dialogue clearly labelled per character).
AMBIENCE: use /home/user/my-first-website./warrior-reel/audio/sfx/river_loop.mp3 and /home/user/my-first-website./warrior-reel/audio/sfx/birds.mp3 if present (crossfade-loop them to full length);
otherwise synthesize a convincing babbling-brook bed (filtered noise + many random rising sine "bubble" grains) and sparse soft
bird chirps. River subtle under dialogue (~-30 LUFS-ish), slightly louder in wordless moments.
FOLEY (from audio/sfx/*.mp3 if present, else synthesize something tasteful): leather/steel grip creak at ~0.2 s, soft footsteps
on grass from beats.establishStart to beats.jesusArrive (~0.55 s apart), cloth rustle at beats.jesusSitStart, gentle armour
shift/clink when the knight looks at the sword (beats.swordLookStart) and when he relaxes, a soft metallic ring + earthy thud at
beats.swordTipDown, a soft armour shift at beats.goldenStart. Keep foley subtle and realistic.
MASTER: final mix.wav at -14 LUFS integrated, true peak <= -1 dBTP, dialogue always clearly intelligible.
MOUTH: mouth.json = { fps:30, JESUS:[per-frame 0..1], KNIGHT:[...] } openness from each character's dialogue envelope
(RMS -> smoothed, attack ~30 ms, release ~80 ms, normalised per line, small noise gate so silence = 0), length = timeline.frames.
Make it all runnable with one command: python3 audio/build_all.py. Report the exact commands, outputs and loudness numbers.

// Voice processing chains shared by the preview and the final mix (ffmpeg filter syntax).
// Narrator: deep, close, intimate. Whisper: proximity bass + breathy air, leaning into the right ear.
export const VO_CHAINS = {
  narrator: [
    'aresample=48000',
    'highpass=f=55',
    'equalizer=f=110:t=q:w=0.9:g=2.5',
    'equalizer=f=320:t=q:w=1.2:g=-1.5',
    'equalizer=f=3500:t=q:w=1.0:g=1.5',
    'acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=2',
    'aformat=channel_layouts=stereo',
  ],
  whisper: [
    'aresample=48000',
    'highpass=f=90',
    'equalizer=f=180:t=q:w=0.8:g=4',
    'equalizer=f=7000:t=h:w=0.7:g=3',
    'acompressor=threshold=-24dB:ratio=4:attack=4:release=90:makeup=4',
    'aformat=channel_layouts=stereo',
    'pan=stereo|c0=0.55*c0|c1=1.0*c1',
  ],
};

export const voPreviewFilter = (role) => VO_CHAINS[role].join(',');

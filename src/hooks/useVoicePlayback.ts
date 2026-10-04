import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export interface VoicePlayback {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  /** Play / pause; replays from the start once finished. */
  toggle(): void;
  /** Pause and rewind to the start. */
  stop(): void;
}

const toMs = (seconds: number) => (Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0);

function useNativeVoicePlayback(uri?: string): VoicePlayback {
  const player = useAudioPlayer(uri ?? null, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);

  // Rewind when a note finishes so the next tap replays it.
  useEffect(() => {
    if (!status.didJustFinish) return;
    try {
      player.pause();
      player.seekTo(0).catch(() => undefined);
    } catch {
      // Player released.
    }
  }, [player, status.didJustFinish]);

  const play = async () => {
    // Make sure we're out of recording mode so audio uses the loudspeaker and ignores the silent switch.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    if (status.duration > 0 && status.currentTime >= status.duration - 0.05) await player.seekTo(0);
    player.play();
  };

  const toggle = () => {
    if (!uri) return;
    try {
      if (status.playing) player.pause();
      else play().catch(() => undefined);
    } catch {
      // Player released.
    }
  };

  const stop = () => {
    try {
      player.pause();
      player.seekTo(0).catch(() => undefined);
    } catch {
      // Player released.
    }
  };

  return {
    isPlaying: Boolean(uri) && status.playing,
    positionMs: uri ? toMs(status.currentTime) : 0,
    durationMs: uri ? toMs(status.duration) : 0,
    toggle,
    stop,
  };
}

interface WebPlaybackState {
  uri?: string;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
}

const IDLE: WebPlaybackState = { isPlaying: false, positionMs: 0, durationMs: 0 };

/**
 * Web fallback on a lazily created <audio> element: expo-audio's web player
 * constructs `new Audio()` during render, which breaks static (SSR) export.
 */
function useWebVoicePlayback(uri?: string): VoicePlayback {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<WebPlaybackState>(IDLE);

  useEffect(() => {
    if (!uri || typeof Audio === 'undefined') return;
    const element = new Audio(uri);
    element.preload = 'metadata';
    audio.current = element;

    const update = (patch: Partial<WebPlaybackState>) =>
      setState((prev) => ({ ...(prev.uri === uri ? prev : IDLE), ...patch, uri }));
    const sync = () => update({ positionMs: toMs(element.currentTime), durationMs: toMs(element.duration) });
    const onPlay = () => update({ isPlaying: true });
    const onPause = () => update({ isPlaying: false });
    const onEnded = () => {
      element.currentTime = 0;
      update({ isPlaying: false, positionMs: 0 });
    };

    const listeners: [keyof HTMLMediaElementEventMap, () => void][] = [
      ['loadedmetadata', sync],
      ['durationchange', sync],
      ['timeupdate', sync],
      ['play', onPlay],
      ['pause', onPause],
      ['ended', onEnded],
    ];
    listeners.forEach(([event, handler]) => element.addEventListener(event, handler));
    return () => {
      listeners.forEach(([event, handler]) => element.removeEventListener(event, handler));
      element.pause();
      element.removeAttribute('src');
      element.load();
      if (audio.current === element) audio.current = null;
    };
  }, [uri]);

  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (element.paused) element.play().catch(() => undefined);
    else element.pause();
  };

  const stop = () => {
    const element = audio.current;
    if (!element) return;
    element.pause();
    element.currentTime = 0;
  };

  const current = uri && state.uri === uri ? state : IDLE;
  return {
    isPlaying: current.isPlaying,
    positionMs: current.positionMs,
    durationMs: current.durationMs,
    toggle,
    stop,
  };
}

/** Plays a recorded voice note: play/pause toggle, stop, live position and duration. */
export const useVoicePlayback: (uri?: string) => VoicePlayback =
  Platform.OS === 'web' ? useWebVoicePlayback : useNativeVoicePlayback;

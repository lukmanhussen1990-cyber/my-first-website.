import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
  type RecordingStatus,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { deleteFile, persistFile } from '@/services/media';

export type VoiceRecorderStatus = 'idle' | 'recording' | 'denied';

export interface VoiceRecording {
  /** Persisted file URI (`Paths.document/voice/…`; the blob URL on web). */
  uri: string;
  durationMs: number;
}

export interface VoiceRecorder {
  status: VoiceRecorderStatus;
  durationMs: number;
  /** 0–1 input level for the live waveform (metering normalised from −60…0 dBFS). */
  level: number;
  start(): Promise<void>;
  stop(): Promise<VoiceRecording | null>;
  cancel(): Promise<void>;
}

export const MAX_RECORDING_MS = 5 * 60 * 1000;

const RECORDING_OPTIONS: RecordingOptions = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
const STATE_INTERVAL_MS = 100;
const METER_FLOOR_DB = -60;

/** Maps a dBFS metering value (−160…0) onto 0–1, treating anything below −60 dB as silence. */
export function meteringToLevel(db?: number): number {
  if (db === undefined || !Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}

function webRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

/** Back to playback mode so voice notes play through the speaker (iOS routes to the earpiece while recording is allowed). */
async function restoreAudioMode(): Promise<void> {
  try {
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  } catch {
    // Audio session unavailable — nothing to restore.
  }
}

/**
 * Voice-note recorder (max 5 minutes, metering on). `stop()` persists the
 * file into `Paths.document/voice/` and resolves its URI + duration.
 * `status` is `'denied'` when microphone access is refused or unsupported.
 */
export function useVoiceRecorder(): VoiceRecorder {
  // The recorder emits the final file URL when it stops on its own (5-minute cap).
  const finishedUri = useRef<string | null>(null);
  const recorder = useAudioRecorder(RECORDING_OPTIONS, (event: RecordingStatus) => {
    if (event.isFinished && event.url) finishedUri.current = event.url;
  });
  const recorderState = useAudioRecorderState(recorder, STATE_INTERVAL_MS);
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle');
  const startedAt = useRef(0);
  const busy = useRef(false);

  // Leaving the screen mid-recording: stop the mic and hand the audio session back.
  useEffect(
    () => () => {
      try {
        if (recorder.isRecording) {
          recorder.stop().catch(() => undefined);
          void restoreAudioMode();
        }
      } catch {
        // Recorder already released.
      }
    },
    [recorder],
  );

  const currentFileUri = (): string | null => {
    try {
      return recorder.uri || finishedUri.current;
    } catch {
      return finishedUri.current;
    }
  };

  const halt = async (): Promise<void> => {
    try {
      await recorder.stop();
    } catch {
      // Already stopped (e.g. it hit the 5-minute cap).
    }
  };

  const start = async (): Promise<void> => {
    if (busy.current || status === 'recording') return;
    busy.current = true;
    try {
      if (Platform.OS === 'web' && !webRecordingSupported()) {
        setStatus('denied');
        return;
      }
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setStatus('denied');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      finishedUri.current = null;
      recorder.record({ forDuration: MAX_RECORDING_MS / 1000 });
      startedAt.current = Date.now();
      setStatus('recording');
    } catch (error) {
      if (__DEV__) console.warn('[voice] Could not start recording.', error);
      await restoreAudioMode();
      setStatus('idle');
    } finally {
      busy.current = false;
    }
  };

  const stop = async (): Promise<VoiceRecording | null> => {
    if (busy.current || status !== 'recording') return null;
    busy.current = true;
    try {
      let measured = 0;
      try {
        measured = recorder.getStatus().durationMillis;
      } catch {
        // fall back to wall-clock time
      }
      const durationMs = Math.round(Math.min(MAX_RECORDING_MS, measured > 0 ? measured : Date.now() - startedAt.current));
      await halt();
      const rawUri = currentFileUri();
      if (!rawUri) return null;
      return { uri: await persistFile(rawUri, 'voice'), durationMs };
    } catch (error) {
      if (__DEV__) console.warn('[voice] Could not save recording.', error);
      return null;
    } finally {
      busy.current = false;
      setStatus('idle');
      await restoreAudioMode();
    }
  };

  const cancel = async (): Promise<void> => {
    if (busy.current || status !== 'recording') return;
    busy.current = true;
    try {
      await halt();
      await deleteFile(currentFileUri() ?? undefined);
    } finally {
      busy.current = false;
      setStatus('idle');
      await restoreAudioMode();
    }
  };

  const recording = status === 'recording';
  return {
    status,
    durationMs: recording ? Math.min(MAX_RECORDING_MS, Math.max(0, recorderState.durationMillis)) : 0,
    level: recording && recorderState.isRecording ? meteringToLevel(recorderState.metering) : 0,
    start,
    stop,
    cancel,
  };
}

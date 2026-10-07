import {
  Accessibility,
  AudioLines,
  CircleUser,
  Info,
  LogOut,
  Music,
  ScrollText,
  Trash2,
  UserPlus,
  Vibrate,
  Volume2,
} from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { navigate } from '../app/router';
import type { ScreenProps } from '../app/screens';
import { APP_VERSION, AuthorCredit } from '../components/AuthorCredit';
import { AppSheet, SheetActions, SheetField, SheetHead, SheetInput } from '../components/meta/AppSheet';
import { Group, Row } from '../components/meta/RowGroup';
import { Toggle } from '../components/meta/Toggle';
import { Pill } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Screen } from '../components/ui/Screen';
import { TopBar } from '../components/ui/TopBar';
import { audio } from '../services/audio';
import { AuthError } from '../services/auth';
import { haptic } from '../services/haptics';
import { useSession } from '../state/session';
import { useSettings } from '../state/settings';
import s from './SettingsScreen.module.css';

function errorMessage(e: unknown): string {
  if (e instanceof AuthError) {
    if (e.code === 'LOCKED' && e.retryAfterMs) return `${e.message} (${Math.ceil(e.retryAfterMs / 1000)}s)`;
    return e.message;
  }
  return 'Something went wrong. Please try again.';
}

export default function SettingsScreen(_props: ScreenProps) {
  const { sound, music, haptics, reduceMotion, volume, set } = useSettings();
  const status = useSession((st) => st.status);
  const user = useSession((st) => st.user);
  const logout = useSession((st) => st.logout);
  const deleteAccount = useSession((st) => st.deleteAccount);

  const guest = status !== 'user';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const volPct = Math.round(volume * 100);

  const doLogout = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await logout();
      navigate('/welcome', { replace: true, transition: 'fade' });
    } catch {
      setLeaving(false);
    }
  };

  const openConfirm = () => {
    setPassword('');
    setError(null);
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    if (busy) return;
    if (!guest && !password) {
      setError('Enter your password to confirm.');
      audio.play('error');
      haptic('warning');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      audio.play('glitch');
      haptic('heavy');
      navigate('/welcome', { replace: true, transition: 'glitch' });
    } catch (e) {
      setError(errorMessage(e));
      audio.play('error');
      haptic('error');
      setBusy(false);
    }
  };

  return (
    <Screen header={<TopBar title="Settings" backTo="/profile" />}>
      <div className={s.body}>
        <Group title="Audio">
          <Row
            icon={<Volume2 size={18} />}
            label="Sound effects"
            sub="Taps, alerts and trial stingers"
            subId="set-sound"
            right={<Toggle checked={sound} onChange={(v) => set({ sound: v })} label="Sound effects" describedBy="set-sound" />}
          />
          <Row
            icon={<Music size={18} />}
            label="Ambient soundscape"
            sub="Rain, wind and the city's low hum"
            subId="set-music"
            right={<Toggle checked={music} onChange={(v) => set({ music: v })} label="Ambient soundscape" describedBy="set-music" />}
          />
          <Row
            icon={<AudioLines size={18} />}
            label="Master volume"
            right={<span className={s.volValue}>{volPct}%</span>}
            stacked={
              <input
                type="range"
                className={s.slider}
                min={0}
                max={100}
                step={5}
                value={volPct}
                aria-label="Master volume"
                aria-valuetext={`${volPct} percent`}
                style={{ '--pct': `${volPct}%` } as CSSProperties}
                onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
                onPointerUp={() => audio.play('tick')}
                onKeyUp={() => audio.play('tick')}
              />
            }
          />
        </Group>

        <Group title="Gameplay">
          <Row
            icon={<Vibrate size={18} />}
            label="Haptics"
            sub="Vibration on supported devices"
            subId="set-haptics"
            right={<Toggle checked={haptics} onChange={(v) => set({ haptics: v })} label="Haptics" describedBy="set-haptics" />}
          />
          <Row
            icon={<Accessibility size={18} />}
            label="Reduce motion"
            sub="Calmer transitions, no glitch bursts"
            subId="set-motion"
            right={
              <Toggle checked={reduceMotion} onChange={(v) => set({ reduceMotion: v })} label="Reduce motion" describedBy="set-motion" />
            }
          />
        </Group>

        <Group title="Account">
          <Row
            icon={<CircleUser size={18} />}
            label={guest ? 'Playing as guest' : 'Signed in as'}
            sub={guest ? 'Saved on this device only' : 'Secured on this device'}
            right={<Pill tone={guest ? 'amber' : 'red'} className={guest ? undefined : s.handle}>
                {guest ? 'Guest' : `@${user?.username ?? ''}`}
              </Pill>}
          />
          {guest && (
            <Row
              icon={<UserPlus size={18} />}
              label="Create account"
              sub="Lock in your progress with a password"
              tone="accent"
              onClick={() => navigate('/register')}
            />
          )}
          <Row
            icon={<LogOut size={18} />}
            label={guest ? 'Leave guest mode' : 'Log out'}
            sub={guest ? 'Guest progress stays on this device' : undefined}
            right={leaving ? <span className={s.spinner} aria-label="Signing out" /> : undefined}
            onClick={doLogout}
          />
          <Row
            icon={<Trash2 size={18} />}
            label={guest ? 'Reset guest data' : 'Delete account'}
            sub={guest ? 'Erase every guest trial and badge' : 'Permanently erase account and progress'}
            tone="danger"
            onClick={openConfirm}
          />
        </Group>

        <Group title="About">
          <Row icon={<Info size={18} />} label="About & credits" sub="The story and the people behind it" onClick={() => navigate('/about')} />
          <Row icon={<ScrollText size={18} />} label="App information" sub="Version, platform, security, licenses" onClick={() => navigate('/info')} />
        </Group>

        <footer className={s.footer}>
          <AuthorCredit variant="compact" />
          <p className={s.version}>
            Border Trials · v{APP_VERSION} · Release
          </p>
        </footer>
      </div>

      <AppSheet open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} label={guest ? 'Reset guest data' : 'Delete account'}>
        <div className={s.dangerIcon} aria-hidden>
          <Trash2 size={24} />
        </div>
        <SheetHead kicker="Danger zone" title={guest ? 'Reset guest data' : 'Delete account'}>
          {guest
            ? "Every guest trial, badge and point on this device will be erased and you'll return to the gate. This cannot be undone."
            : `@${user?.username ?? ''} and all of its progress will be erased from this device. This cannot be undone.`}
        </SheetHead>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doDelete();
          }}
        >
          {!guest && (
            <SheetField label="Confirm with your password" error={error}>
              <SheetInput
                type="password"
                value={password}
                autoComplete="current-password"
                aria-invalid={!!error}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
              />
            </SheetField>
          )}
          {guest && error && (
            <p className={s.sheetError} role="alert">
              {error}
            </p>
          )}
          <SheetActions>
            <Button type="submit" variant="danger" block loading={busy} sfx={false}>
              {guest ? 'Reset data' : 'Delete forever'}
            </Button>
            <Button variant="ghost" block sfx="back" disabled={busy} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
          </SheetActions>
        </form>
      </AppSheet>
    </Screen>
  );
}

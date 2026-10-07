import {
  Database,
  Fingerprint,
  HardDrive,
  KeyRound,
  MonitorSmartphone,
  Package,
  Radio,
  ShieldCheck,
  Tag,
  WifiOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ScreenProps } from '../app/screens';
import { APP_NAME, APP_VERSION, AUTHOR } from '../components/AuthorCredit';
import { AppEmblem } from '../components/meta/AppEmblem';
import { CreatorPlate } from '../components/meta/CreatorPlate';
import { Group, Row } from '../components/meta/RowGroup';
import { formatBytes } from '../components/meta/time';
import { Pill } from '../components/ui/Bits';
import { Screen } from '../components/ui/Screen';
import { TopBar } from '../components/ui/TopBar';
import { useSession } from '../state/session';
import s from './AppInfoScreen.module.css';

const LICENSES: { name: string; use: string; license: string }[] = [
  { name: 'React', use: 'Interface runtime', license: 'MIT' },
  { name: 'Motion', use: 'Animation', license: 'MIT' },
  { name: 'Zustand', use: 'State', license: 'MIT' },
  { name: 'idb', use: 'IndexedDB storage', license: 'ISC' },
  { name: 'Lucide', use: 'Icons', license: 'ISC' },
  { name: 'Capacitor', use: 'Native shell', license: 'MIT' },
  { name: 'Vite', use: 'Build tooling', license: 'MIT' },
  { name: 'Typefaces', use: 'Orbitron, Rajdhani, Inter, Share Tech Mono', license: 'OFL 1.1' },
];

type CapacitorGlobal = { Capacitor?: { getPlatform?: () => string } };

function detectPlatform(): { label: string; sub: string } {
  const native = (window as unknown as CapacitorGlobal).Capacitor?.getPlatform?.();
  if (native === 'android') return { label: 'Android app', sub: 'Native build via Capacitor' };
  if (native === 'ios') return { label: 'iOS app', sub: 'Native build via Capacitor' };
  const standalone =
    typeof matchMedia !== 'undefined' &&
    (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches);
  if (standalone) return { label: 'Installed PWA', sub: 'Running standalone' };
  return { label: 'Browser', sub: 'Installable as an app' };
}

interface StorageInfo {
  used: number;
  quota: number;
}

function useStorageEstimate(): StorageInfo | null | 'unavailable' {
  const [info, setInfo] = useState<StorageInfo | null | 'unavailable'>(() =>
    typeof navigator.storage?.estimate === 'function' ? null : 'unavailable',
  );
  useEffect(() => {
    if (typeof navigator.storage?.estimate !== 'function') return;
    let alive = true;
    navigator.storage
      .estimate()
      .then((e) => alive && setInfo({ used: e.usage ?? 0, quota: e.quota ?? 0 }))
      .catch(() => alive && setInfo('unavailable'));
    return () => {
      alive = false;
    };
  }, []);
  return info;
}

export default function AppInfoScreen(_props: ScreenProps) {
  const status = useSession((st) => st.status);
  const signedIn = status === 'user' || status === 'guest';
  const [platform] = useState(detectPlatform);
  const [offlineReady] = useState(() => !!navigator.serviceWorker?.controller);
  const storage = useStorageEstimate();

  const storageValue =
    storage === null ? '…' : storage === 'unavailable' ? 'Unavailable' : formatBytes(storage.used);
  const storageSub =
    storage && storage !== 'unavailable' && storage.quota > 0
      ? `of ${formatBytes(storage.quota)} available on this device`
      : 'Progress, accounts and settings';

  return (
    <Screen header={<TopBar title="App Information" backTo={signedIn ? '/settings' : '/welcome'} />}>
      {/* ── Identity ─────────────────────────────────────────── */}
      <section className={s.hero}>
        <AppEmblem size={92} />
        <h2 className={s.appName}>{APP_NAME}</h2>
        <p className={s.tagline}>Survive · Solve · Escape</p>
        <div className={s.pills}>
          <Pill tone="red">v{APP_VERSION}</Pill>
          <Pill>Release</Pill>
          <Pill tone={offlineReady ? 'green' : 'neutral'}>{offlineReady ? 'Offline ready' : 'Online'}</Pill>
        </div>
      </section>

      <CreatorPlate serial={`${APP_NAME} // v${APP_VERSION}`} delay={0.1} />

      <div className={s.groups}>
        <Group title="Build">
          <Row icon={<Tag size={17} />} label="Version" right={<span className={s.mono}>{APP_VERSION}</span>} />
          <Row icon={<Package size={17} />} label="Build channel" right={<span className={s.mono}>Release</span>} />
          <Row icon={<MonitorSmartphone size={17} />} label="Platform" sub={platform.sub} right={platform.label} />
          <Row
            icon={offlineReady ? <WifiOff size={17} /> : <Radio size={17} />}
            label="Offline status"
            sub={offlineReady ? 'Playable without a connection' : 'Offline cache arms after install'}
            right={
              <span className={[s.status, offlineReady && s.statusOn].filter(Boolean).join(' ')}>
                {offlineReady ? 'Offline ready' : 'Online'}
              </span>
            }
          />
          <Row icon={<HardDrive size={17} />} label="Storage used" sub={storageSub} right={<span className={s.mono}>{storageValue}</span>} />
        </Group>

        <Group title="Security">
          <Row icon={<KeyRound size={17} />} label="Passwords" sub="PBKDF2-SHA256, 600,000 iterations, per‑account salt" />
          <Row icon={<Database size={17} />} label="Storage" sub="On-device IndexedDB, never uploaded" />
          <Row icon={<Fingerprint size={17} />} label="Sessions" sub="Random 256-bit tokens, auto-expire" />
          <Row icon={<ShieldCheck size={17} />} label="Sign-in protection" sub="Constant-time checks, lockout on repeat failures" />
        </Group>

        <Group title="Open-source licenses" aside={`${LICENSES.length} packages`}>
          {LICENSES.map((l) => (
            <Row
              key={l.name}
              label={l.name}
              sub={l.use}
              right={<span className={s.license}>{l.license}</span>}
              className={s.licenseRow}
            />
          ))}
        </Group>
      </div>

      <footer className={s.footer}>
        <p>
          {APP_NAME} © 2026 {AUTHOR}. All rights reserved.
        </p>
        <p className={s.footNote}>Original fan-made work. Not affiliated with any existing series, film or publisher.</p>
      </footer>
    </Screen>
  );
}

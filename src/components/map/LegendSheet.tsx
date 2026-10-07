import { Hand } from 'lucide-react';
import type { ReactNode } from 'react';
import { ProgressBar } from '../ui/Bits';
import { Sheet } from '../ui/Sheet';
import { PlayerDot, SignalGlyph } from './MapMarkers';
import type { PinKind } from './mapModel';
import { PinMarker } from './PinMarker';
import s from './LegendSheet.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  cleared: number;
  total: number;
  counts: Record<PinKind, number>;
  signals: number;
}

interface Row {
  key: string;
  icon: ReactNode;
  title: string;
  body: string;
  count?: number;
  tone?: string;
}

/** Marker key + zone progress for the BORDER MAP. */
export function LegendSheet({ open, onClose, cleared, total, counts, signals }: Props) {
  const rows: Row[] = [
    { key: 'available', icon: <PinMarker kind="available" />, title: 'Available', body: 'Trials open to you right now.', count: counts.available, tone: s.available },
    { key: 'completed', icon: <PinMarker kind="completed" />, title: 'Completed', body: 'Every trial here survived.', count: counts.completed, tone: s.completed },
    { key: 'locked', icon: <PinMarker kind="locked" />, title: 'Locked', body: 'Reach the zone’s level to enter.', count: counts.locked, tone: s.locked },
    { key: 'discovered', icon: <PinMarker kind="discovered" />, title: 'Discovered', body: 'A hidden zone revealed by a scan.', count: counts.discovered, tone: s.discovered },
    { key: 'you', icon: <PlayerDot />, title: 'You', body: 'Your last known position.' },
    { key: 'signal', icon: <SignalGlyph />, title: 'Unknown signal', body: 'Hidden zone in range — SCAN it.', count: signals || undefined },
  ];

  return (
    <Sheet open={open} onClose={onClose} label="Map legend">
      <div className={s.wrap}>
        <p className={s.kicker}>Border City · Survival Grid</p>
        <h2 className={s.title}>Map Legend</h2>

        <div className={s.progress}>
          <div className={s.progressHead}>
            <span>Zones cleared</span>
            <strong className="tabular">
              {cleared} <em>/ {total}</em>
            </strong>
          </div>
          <ProgressBar value={total ? cleared / total : 0} tone="green" height={5} label="Zones cleared" />
        </div>

        <ul className={s.list}>
          {rows.map((r) => (
            <li key={r.key} className={s.row}>
              <span className={[s.icon, r.tone].filter(Boolean).join(' ')}>{r.icon}</span>
              <span className={s.text}>
                <strong>{r.title}</strong>
                <span>{r.body}</span>
              </span>
              {r.count !== undefined && <span className={`${s.count} tabular`}>{r.count}</span>}
            </li>
          ))}
        </ul>

        <p className={s.hint}>
          <Hand size={14} strokeWidth={2} aria-hidden />
          Drag to move · pinch or double-tap to zoom
        </p>
      </div>
    </Sheet>
  );
}

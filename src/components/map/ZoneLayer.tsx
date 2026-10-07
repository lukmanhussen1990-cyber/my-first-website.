import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import type { Zone } from '../../data/types';
import { useCamera } from './camera';
import { PlayerMarker, RadarSweep, SignalMarker } from './MapMarkers';
import { layoutLabels, PIN_PRIORITY, type Box, type LabelSlot, type PinKind } from './mapModel';
import { ZonePin } from './ZonePin';

export interface PlottedZone {
  zone: Zone;
  kind: PinKind;
}

interface Props {
  pins: PlottedZone[];
  here: Zone;
  /** hidden zones a scan would reveal right now ("?" signals) */
  signals: Zone[];
  /** ids revealed by the last scan */
  fresh: string[];
  selectedId: string | null;
  /** active radar sweep (key restarts the animation) */
  sweep: { key: number; reach: number } | null;
  onOpen: (zone: Zone) => void;
  /** viewport-space boxes of floating UI that labels should keep clear of */
  avoid?: () => Box[];
}

const sameSlots = (a: Record<string, LabelSlot>, b: Record<string, LabelSlot>) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => b[k] && a[k].side === b[k].side && a[k].hidden === b[k].hidden);
};

/** Everything plotted over the art: signals, the player, the radar sweep and the zone pins. */
export function ZoneLayer({ pins, here, signals, fresh, selectedId, sweep, onOpen, avoid }: Props) {
  const { engine, base } = useCamera();
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [slots, setSlots] = useState<Record<string, LabelSlot>>({});

  const onMeasure = useCallback((id: string, w: number) => {
    setWidths((prev) => (Math.abs((prev[id] ?? 0) - w) < 0.5 ? prev : { ...prev, [id]: w }));
  }, []);

  // Label slots (right / left / folded) are solved against the visible viewport whenever the
  // camera comes to rest (and when pins, their measured widths or the geometry change) — never per frame.
  // Layout effect: the first solve lands before the first paint.
  useLayoutEffect(() => {
    const solve = () => {
      if (!engine.ready) return;
      const z = engine.z.get();
      const tx = engine.tx.get();
      const ty = engine.ty.get();
      const items = pins.map(({ zone, kind }) => ({
        id: zone.id,
        x: tx + Math.round(z * (zone.x / 100) * base.w),
        y: ty + Math.round(z * (zone.y / 100) * base.h),
        w: widths[zone.id] ?? 40 + zone.name.length * 8,
        priority: PIN_PRIORITY[kind] + (zone.id === here.id ? 10 : 0),
      }));
      const frame = { w: engine.size.w, h: engine.size.h, obstacles: avoid?.() };
      setSlots((prev) => {
        const next = layoutLabels(items, frame, prev);
        return sameSlots(prev, next) ? prev : next;
      });
    };
    solve();
    return engine.onRest(solve);
  }, [engine, pins, widths, base, here.id, avoid]);

  // entrance cascades top → bottom
  const order = useMemo(() => {
    const ids = [...pins].sort((a, b) => a.zone.y - b.zone.y).map((p) => p.zone.id);
    return Object.fromEntries(ids.map((id, i) => [id, i]));
  }, [pins]);

  return (
    <>
      {signals.map((z, i) => (
        <SignalMarker key={`sig-${z.id}`} x={z.x} y={z.y} index={i} />
      ))}
      <PlayerMarker x={here.x} y={here.y} />
      {sweep && <RadarSweep key={sweep.key} x={here.x} y={here.y} reach={sweep.reach} />}
      {pins.map(({ zone, kind }) => (
        <ZonePin
          key={zone.id}
          zone={zone}
          kind={kind}
          side={slots[zone.id]?.side ?? 'right'}
          folded={slots[zone.id]?.hidden ?? false}
          index={order[zone.id] ?? 0}
          here={zone.id === here.id}
          fresh={fresh.includes(zone.id)}
          selected={zone.id === selectedId}
          onOpen={onOpen}
          onMeasure={onMeasure}
        />
      ))}
    </>
  );
}

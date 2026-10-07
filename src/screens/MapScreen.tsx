import { LocateFixed, Map as MapIcon, Minus, Plus, Radar } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScreenProps } from '../app/screens';
import { ART } from '../assets/art';
import type { View } from '../components/map/camera';
import type { Box } from '../components/map/mapModel';
import { LegendSheet } from '../components/map/LegendSheet';
import { MapViewport, type MapViewportHandle } from '../components/map/MapViewport';
import { currentZoneId, MIN_ZOOM, nextHiddenZone, pinKind, zonesCleared, type PinKind } from '../components/map/mapModel';
import { ZoneLayer, type PlottedZone } from '../components/map/ZoneLayer';
import { ZoneSheet } from '../components/map/ZoneSheet';
import { IconButton } from '../components/ui/Button';
import { Screen } from '../components/ui/Screen';
import { TopBar } from '../components/ui/TopBar';
import type { Zone } from '../data/types';
import { getZone, ZONES } from '../data/zones';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useGame, useProgress } from '../state/game';
import { formatNumber, scannableZones } from '../state/selectors';
import { useSettings } from '../state/settings';
import { toast } from '../state/toasts';
import s from './MapScreen.module.css';

/** Camera kept across visits (tab switches, trips into a trial) while the player stays put. */
let lastCamera: { here: string; view: View } | null = null;

const SWEEP_MS = 1900;
const REVEAL_MS = 1550;

export default function MapScreen(_props: ScreenProps) {
  const progress = useProgress();
  const reduceMotion = useSettings((st) => st.reduceMotion);
  const map = useRef<MapViewportHandle>(null);
  const timers = useRef<number[]>([]);

  const hereId = currentZoneId(progress);
  const here = getZone(hereId) ?? ZONES[0];

  const [initialView] = useState<View>(() =>
    lastCamera && lastCamera.here === hereId ? lastCamera.view : { cx: here.x / 100, cy: here.y / 100, z: MIN_ZOOM },
  );

  const pins = useMemo<PlottedZone[]>(
    () =>
      ZONES.flatMap((zone) => {
        const kind = pinKind(zone, progress);
        return kind ? [{ zone, kind }] : [];
      }),
    [progress],
  );
  const signals = useMemo(() => scannableZones(progress), [progress]);
  const { cleared, total } = zonesCleared(progress);
  const counts = useMemo(() => {
    const c: Record<PinKind, number> = { available: 0, completed: 0, locked: 0, discovered: 0 };
    for (const p of pins) c[p.kind] += 1;
    return c;
  }, [pins]);

  /* ── sheets ───────────────────────────────────────────────────── */
  const [sheetZone, setSheetZone] = useState<Zone | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const openZone = useCallback((zone: Zone) => {
    audio.play('select');
    haptic('light');
    setLegendOpen(false);
    setSheetZone(zone);
    setSheetOpen(true);
    // bring the pin into the clear area above the sheet
    const cam = map.current;
    if (cam) cam.flyTo({ cx: zone.x / 100, cy: zone.y / 100, z: Math.max(cam.view().z, 1.3) }, { ay: 0.3, duration: 0.65 });
  }, []);
  const closeZone = useCallback(() => setSheetOpen(false), []);
  const closeLegend = useCallback(() => setLegendOpen(false), []);

  /* ── zoom controls ────────────────────────────────────────────── */
  const [limits, setLimits] = useState({ min: true, max: false });
  const onZoomLimits = useCallback((min: boolean, max: boolean) => setLimits({ min, max }), []);
  const onLeave = useCallback(
    (view: View) => {
      lastCamera = { here: hereId, view };
    },
    [hereId],
  );

  const zoom = (f: number, blocked: boolean) => {
    if (blocked) return;
    audio.play('tap');
    haptic('light');
    map.current?.zoomBy(f);
  };
  const recenter = () => {
    audio.play('whoosh', { volume: 0.5 });
    haptic('light');
    map.current?.flyTo({ cx: here.x / 100, cy: here.y / 100, z: MIN_ZOOM }, { duration: 0.7 });
  };

  /* ── floating HUD: zone labels keep clear of it ──────────────── */
  const stage = useRef<HTMLDivElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const avoid = useCallback((): Box[] => {
    const root = stage.current?.getBoundingClientRect();
    if (!root || !hud.current) return [];
    return [...hud.current.children].map((el) => {
      const r = el.getBoundingClientRect();
      return { l: r.left - root.left - 6, r: r.right - root.left + 6, t: r.top - root.top - 6, b: r.bottom - root.top + 6 };
    });
  }, []);

  /* ── scan ─────────────────────────────────────────────────────── */
  const [scanning, setScanning] = useState(false);
  const [sweep, setSweep] = useState<{ key: number; reach: number } | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const scan = () => {
    if (scanning) return;
    audio.unlock();
    audio.play('scan');
    haptic('medium');
    setScanning(true);
    setSheetOpen(false);
    setLegendOpen(false);
    if (!reduceMotion) {
      const size = map.current?.size() ?? { w: 400, h: 800 };
      setSweep({ key: Date.now(), reach: Math.hypot(size.w, size.h) });
      later(() => setSweep(null), SWEEP_MS);
    }
    later(
      () => {
        const before = useGame.getState().progress;
        // mark the pins as fresh before they mount so they glitch in instead of dropping
        if (before) setFresh(scannableZones(before).map((z) => z.id));
        const { revealed, bonus } = useGame.getState().scanMap();
        setScanning(false);
        if (revealed.length > 0) {
          audio.play('reveal');
          haptic('success');
          later(() => setFresh([]), 1600);
          toast({
            kind: 'reward',
            title: revealed.length === 1 ? `Zone discovered: ${revealed[0].name}` : `${revealed.length} hidden zones discovered`,
            body: `Signal bonus +${formatNumber(bonus)} survival points`,
          });
          const first = revealed[0];
          const cam = map.current;
          if (cam) cam.flyTo({ cx: first.x / 100, cy: first.y / 100, z: Math.max(cam.view().z, 1.2) }, { duration: 0.9 });
        } else {
          haptic('light');
          const p = useGame.getState().progress;
          const next = p ? nextHiddenZone(p) : undefined;
          toast(
            next
              ? { kind: 'info', title: 'No signal in range', body: `The next hidden zone answers at level ${next.unlockLevel}.` }
              : { kind: 'info', title: 'No signals left', body: 'Every hidden zone on the map has been found.' },
          );
        }
      },
      reduceMotion ? 250 : REVEAL_MS,
    );
  };

  const hasSignal = signals.length > 0;

  return (
    <Screen
      nav
      bleed
      scroll={false}
      shade="none"
      header={
        <TopBar
          title="Border Map"
          showBack={false}
          variant="glass"
          right={
            <IconButton
              label="Map legend"
              onClick={() => {
                setSheetOpen(false);
                setLegendOpen(true);
              }}
            >
              <MapIcon size={22} strokeWidth={1.75} />
            </IconButton>
          }
        />
      }
    >
      <div className={s.stage} ref={stage}>
        <MapViewport
          ref={map}
          image={ART.mapCity}
          initialView={initialView}
          onZoomLimits={onZoomLimits}
          onLeave={onLeave}
          label="Border City map. Drag to pan; pinch, scroll or use plus and minus to zoom."
        >
          <ZoneLayer
            pins={pins}
            here={here}
            signals={signals}
            fresh={fresh}
            selectedId={sheetOpen && sheetZone ? sheetZone.id : null}
            sweep={sweep}
            onOpen={openZone}
            avoid={avoid}
          />
        </MapViewport>

        {/* HUD */}
        <div className={s.hud} ref={hud}>
          <div className={s.cleared} role="status" aria-label={`Zones cleared ${cleared} of ${total}`}>
            <span className={s.clearedLabel}>Zones cleared</span>
            <span className={s.clearedValue}>
              {cleared}
              <em> / {total}</em>
            </span>
            <span className={s.clearedBar} aria-hidden>
              <i style={{ transform: `scaleX(${total ? cleared / total : 0})` }} />
            </span>
          </div>

          <div className={s.controls}>
            <button type="button" className={s.round} onClick={recenter} aria-label="Recenter on your position" title="Recenter">
              <LocateFixed size={20} strokeWidth={1.9} />
            </button>
            <div className={s.zoom} role="group" aria-label="Zoom">
              {/* aria-disabled (not disabled) so keyboard focus stays put at either end of the range */}
              <button type="button" onClick={() => zoom(1 / 1.4, limits.min)} aria-disabled={limits.min} aria-label="Zoom out" title="Zoom out">
                <Minus size={20} strokeWidth={2} />
              </button>
              <span className={s.zoomRule} aria-hidden />
              <button type="button" onClick={() => zoom(1.4, limits.max)} aria-disabled={limits.max} aria-label="Zoom in" title="Zoom in">
                <Plus size={20} strokeWidth={2} />
              </button>
            </div>
          </div>

          <button
            type="button"
            className={[s.scan, scanning && s.scanning].filter(Boolean).join(' ')}
            onClick={scan}
            aria-disabled={scanning || undefined}
            aria-busy={scanning || undefined}
            aria-label={hasSignal ? 'Scan the map — unknown signal detected' : 'Scan the map for hidden zones'}
          >
            <span className={s.scanIcon} aria-hidden>
              <Radar size={20} strokeWidth={2} />
            </span>
            <span className={s.scanText}>{scanning ? 'Scanning' : 'Scan'}</span>
            {hasSignal && !scanning && <span className={s.scanBadge} aria-hidden />}
          </button>
        </div>

        <div className={s.sheetHost}>
          <ZoneSheet zone={sheetZone} open={sheetOpen} onClose={closeZone} progress={progress} hereId={hereId} />
          <LegendSheet open={legendOpen} onClose={closeLegend} cleared={cleared} total={total} counts={counts} signals={signals.length} />
        </div>
      </div>
    </Screen>
  );
}

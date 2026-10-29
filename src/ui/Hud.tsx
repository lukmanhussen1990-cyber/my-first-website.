import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { fullscreenSupported, isFullscreen, onFullscreenChange, toggleFullscreen } from '../lib/fullscreen';
import {
  BEAM_MAX_DEG,
  BEAM_MIN_DEG,
  BEAM_MODES,
  BEAM_PROFILES,
  emittedLumens,
  formatCandela,
  formatRuntime,
  peakCandela,
  runtimeSeconds,
  throwMeters,
} from '../lib/photometry';
import { useTorch } from '../state/store';
import { useUi } from '../state/ui';
import { BoltIcon, CollapseIcon, ExpandIcon, KeyboardIcon, PowerIcon, ResetIcon } from './icons';

const fmt = new Intl.NumberFormat('en-US');

function PowerSwitch() {
  const on = useTorch((s) => s.on);
  const battery = useTorch((s) => s.battery);
  const toggle = useTorch((s) => s.toggle);
  const empty = battery <= 0;
  return (
    <div className="dock__cell dock__power">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Flashlight power"
        aria-describedby={empty ? 'power-empty' : undefined}
        className="power"
        data-on={on}
        onClick={() => toggle('ui')}
      >
        <span className="power__ring" aria-hidden="true" />
        <PowerIcon />
      </button>
      <div className="dock__text">
        <span className="label">Power</span>
        <span className="value value--state">{on ? 'On' : 'Off'}</span>
        {empty && (
          <span id="power-empty" className="sub sub--warn">
            Battery empty
          </span>
        )}
      </div>
    </div>
  );
}

function Slider({
  id,
  className,
  label,
  min,
  max,
  step,
  value,
  onChange,
  display,
  sub,
  valueText,
}: {
  id: string;
  className: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  display: string;
  sub: string;
  valueText: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className={`dock__cell dock__slider ${className}`}>
      <div className="slider__head">
        <label className="label" htmlFor={id}>
          {label}
        </label>
        <span className="value" aria-hidden="true">
          {display}
        </span>
      </div>
      <input
        id={id}
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      <span className="sub" aria-hidden="true">
        {sub}
      </span>
    </div>
  );
}

function BrightnessControl() {
  const brightness = useTorch((s) => s.brightness);
  const battery = useTorch((s) => s.battery);
  const setBrightness = useTorch((s) => s.setBrightness);
  const pct = Math.round(brightness * 100);
  const lumens = Math.round(emittedLumens(brightness, battery));
  return (
    <Slider
      id="brightness"
      className="dock__brightness"
      label="Brightness"
      min={0}
      max={100}
      step={1}
      value={pct}
      onChange={(v) => setBrightness(v / 100)}
      display={`${pct}%`}
      sub={`${fmt.format(lumens)} lm`}
      valueText={`${pct} percent, ${lumens} lumens`}
    />
  );
}

function BeamControl() {
  const angle = useTorch((s) => s.beamAngle);
  const mode = useTorch((s) => s.mode);
  const brightness = useTorch((s) => s.brightness);
  const battery = useTorch((s) => s.battery);
  const setBeamAngle = useTorch((s) => s.setBeamAngle);
  const lumens = emittedLumens(brightness, battery);
  const cd = peakCandela(Math.max(lumens, 1e-6), angle, BEAM_PROFILES[mode]);
  const throwM = lumens > 0 ? Math.round(throwMeters(cd)) : 0;
  return (
    <Slider
      id="beam-width"
      className="dock__beam"
      label="Beam width"
      min={BEAM_MIN_DEG}
      max={BEAM_MAX_DEG}
      step={1}
      value={Math.round(angle)}
      onChange={setBeamAngle}
      display={`${Math.round(angle)}°`}
      sub={lumens > 0 ? `${formatCandela(cd)} · ${fmt.format(throwM)} m throw` : 'No output'}
      valueText={`${Math.round(angle)} degrees, throw ${throwM} metres`}
    />
  );
}

function ModeSelector() {
  const mode = useTorch((s) => s.mode);
  const setMode = useTorch((s) => s.setMode);
  const index = BEAM_MODES.indexOf(mode);
  return (
    <fieldset className="dock__cell dock__modes">
      <legend className="label">Mode</legend>
      <div className="segmented" style={{ '--index': index } as CSSProperties}>
        <span className="segmented__thumb" aria-hidden="true" />
        {BEAM_MODES.map((m) => (
          <label key={m} className="segmented__option" data-active={m === mode}>
            <input type="radio" name="beam-mode" value={m} checked={m === mode} onChange={() => setMode(m)} />
            <span>{BEAM_PROFILES[m].label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Battery() {
  const battery = useTorch((s) => s.battery);
  const charging = useTorch((s) => s.charging);
  const on = useTorch((s) => s.on);
  const brightness = useTorch((s) => s.brightness);
  const startCharging = useTorch((s) => s.startCharging);
  const pct = Math.round(battery * 100);
  const level = battery < 0.1 ? 'critical' : battery < 0.3 ? 'low' : 'ok';
  const runtime = formatRuntime(runtimeSeconds(battery, emittedLumens(brightness, battery)));
  let sub = on ? `≈ ${runtime} left` : `${runtime} at this output`;
  if (charging) sub = 'Charging';
  else if (battery <= 0) sub = 'Empty';
  return (
    <div className="dock__cell dock__battery">
      <span className="label" id="battery-label">
        Battery
      </span>
      <div className="battery__row">
        <div
          className="battery"
          role="meter"
          aria-labelledby="battery-label"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${pct} percent${charging ? ', charging' : ''}`}
          data-level={level}
          data-active={on || charging}
          data-charging={charging}
        >
          <span className="battery__fill" style={{ width: `${Math.max(2, battery * 100)}%` }} />
          {charging && (
            <span className="battery__bolt">
              <BoltIcon />
            </span>
          )}
        </div>
        <span className="value">{pct}%</span>
      </div>
      <div className="battery__sub">
        <span className="sub">{sub}</span>
        {!on && !charging && battery < 0.995 && (
          <button type="button" className="chip" onClick={startCharging}>
            Charge
          </button>
        )}
      </div>
    </div>
  );
}

export function ControlDock() {
  const ref = useRef<HTMLDivElement>(null);
  const setInsetBottom = useUi((s) => s.setInsetBottom);

  // Tell the camera how much of the screen the dock covers so it can frame the torch above it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setInsetBottom(Math.max(0, window.innerHeight - el.getBoundingClientRect().top));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [setInsetBottom]);

  return (
    <section ref={ref} className="dock panel" aria-label="Flashlight controls">
      <PowerSwitch />
      <span className="dock__divider" aria-hidden="true" />
      <BrightnessControl />
      <BeamControl />
      <span className="dock__divider" aria-hidden="true" />
      <ModeSelector />
      <span className="dock__divider" aria-hidden="true" />
      <Battery />
    </section>
  );
}

const SHORTCUTS: [string, string][] = [
  ['Drag torch', 'Aim the light'],
  ['Drag background', 'Orbit camera'],
  ['Scroll / pinch', 'Zoom'],
  ['Click switch', 'Power on / off'],
  ['← ↑ → ↓', 'Aim (Shift: faster)'],
  ['+ / −', 'Zoom'],
  ['L or Space', 'Power'],
  ['1 · 2 · 3', 'Focused · Standard · Wide'],
  ['R', 'Reset view'],
  ['F', 'Full screen'],
];

export function TopBar() {
  const fullscreen = useUi((s) => s.fullscreen);
  const setFullscreen = useUi((s) => s.setFullscreen);
  const shortcutsOpen = useUi((s) => s.shortcutsOpen);
  const setShortcutsOpen = useUi((s) => s.setShortcutsOpen);
  const requestReset = useTorch((s) => s.requestReset);
  const canFullscreen = fullscreenSupported();

  useEffect(() => onFullscreenChange(() => setFullscreen(isFullscreen())), [setFullscreen]);

  useEffect(() => {
    if (!shortcutsOpen) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShortcutsOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [shortcutsOpen, setShortcutsOpen]);

  return (
    <>
      <header className="brand">
        <span className="brand__mark">NYXEN</span>
        <span className="brand__model">TX-1</span>
        <span className="brand__tag">Tactical Illuminator · 1800 lm</span>
      </header>
      <nav className="actions" aria-label="View">
        <button
          type="button"
          className="icon-btn"
          aria-label="Keyboard shortcuts"
          aria-expanded={shortcutsOpen}
          aria-controls="shortcuts"
          title="Shortcuts (?)"
          onClick={() => setShortcutsOpen(!shortcutsOpen)}
        >
          <KeyboardIcon />
        </button>
        <button type="button" className="icon-btn" aria-label="Reset view" title="Reset view (R)" onClick={requestReset}>
          <ResetIcon />
          <span className="icon-btn__label">Reset</span>
        </button>
        {canFullscreen && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Full screen"
            aria-pressed={fullscreen}
            title="Full screen (F)"
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? <CollapseIcon /> : <ExpandIcon />}
          </button>
        )}
      </nav>
      {shortcutsOpen && (
        <div id="shortcuts" className="shortcuts panel" role="dialog" aria-label="Keyboard and pointer shortcuts">
          <dl>
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="shortcuts__row">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}

export function Hint() {
  const interacted = useTorch((s) => s.interacted);
  const coarse = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);
  return (
    <p className="hint" data-faded={interacted} aria-hidden="true">
      {coarse ? 'Drag the torch to aim · Drag around it to orbit · Pinch to zoom · Tap the switch' : 'Drag the torch to aim · Drag the background to orbit · Scroll to zoom · Click the switch on the head'}
    </p>
  );
}

export function LiveRegion() {
  const announcement = useTorch((s) => s.announcement);
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
}

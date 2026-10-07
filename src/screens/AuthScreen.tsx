/*
 * Log in / create account (routes /login and /register).
 *
 * Device-local accounts (see services/auth.ts): PBKDF2 hashing takes ~0.5–1 s,
 * so the submit button shows a "securing" state. Every AuthError maps to an
 * inline, screen-reader-associated message; a locked account shows a live
 * countdown and keeps submit disabled until it expires.
 */
import { AlertTriangle, Eye, EyeOff, KeyRound, Lock, ShieldCheck, User } from 'lucide-react';
import { motion, useAnimate } from 'motion/react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { getRouter, navigate } from '../app/router';
import type { ScreenProps } from '../app/screens';
import { ART } from '../assets/art';
import { Rain } from '../components/fx/Rain';
import { Button, IconButton } from '../components/ui/Button';
import { GlitchText } from '../components/ui/GlitchText';
import { Screen } from '../components/ui/Screen';
import { SuitIcon } from '../components/ui/SuitIcon';
import { TopBar } from '../components/ui/TopBar';
import { AuthError, passwordStrength, validateUsername } from '../services/auth';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useSession } from '../state/session';
import { useSettings } from '../state/settings';
import { toast } from '../state/toasts';
import s from './AuthScreen.module.css';

type Mode = 'login' | 'register';
type FieldKey = 'name' | 'pw' | 'pw2';
type Errors = Partial<Record<FieldKey, string>>;

const EASE = [0.16, 1, 0.3, 1] as const;

const COPY = {
  register: {
    kicker: 'New player',
    title: 'Create account',
    subtitle: 'Your name will echo through the city.',
    submit: 'Create account',
    switchQ: 'Already a player?',
    switchA: 'Log in',
    switchTo: '/login',
  },
  login: {
    kicker: 'Returning player',
    title: 'Welcome back',
    subtitle: 'The game remembers you.',
    submit: 'Log in',
    switchQ: 'New here?',
    switchA: 'Create account',
    switchTo: '/register',
  },
} as const;

/** wall clock for the lock countdown (event handlers / timers only) */
const wallClock = () => Date.now();

function clock(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/**
 * Navigate home the instant the session flips to signed-in, inside the store
 * update — before the shell's auth guard can redirect with its plain fade.
 */
function homeOnSignIn(): () => void {
  const unsub = useSession.subscribe((st, prev) => {
    if (st.status === prev.status || (st.status !== 'guest' && st.status !== 'user')) return;
    unsub();
    navigate('/home', { replace: true, transition: 'glitch' });
  });
  return unsub;
}

/* ── Field ──────────────────────────────────────────────────── */

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: ReactNode;
  error?: string;
  /** extra ids for aria-describedby (hints, meters) */
  describedBy?: string;
  trailing?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  children?: ReactNode;
}

function Field({ id, label, icon, error, describedBy, trailing, inputRef, children, ...input }: FieldProps) {
  const errId = `${id}-err`;
  const desc = [error ? errId : null, describedBy].filter(Boolean).join(' ') || undefined;
  return (
    <div className={s.field} data-invalid={error ? true : undefined}>
      <label htmlFor={id} className={s.label}>
        {label}
      </label>
      <div className={s.control}>
        <span className={s.fieldIcon} aria-hidden>
          {icon}
        </span>
        <input
          id={id}
          ref={inputRef}
          className={s.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={desc}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          {...input}
        />
        {trailing}
      </div>
      {children}
      {error && (
        <p id={errId} className={s.error}>
          <AlertTriangle size={13} strokeWidth={2.2} aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/* ── Strength meter ─────────────────────────────────────────── */

function StrengthMeter({ id, password, username, error }: { id: string; password: string; username: string; error?: string }) {
  const st = passwordStrength(password, username);
  const empty = password.length === 0;
  const lit = empty ? 0 : Math.max(1, st.score);
  const tone = st.score <= 1 ? 'red' : st.score === 2 ? 'amber' : 'green';
  const hint = empty
    ? 'Use 8+ characters with letters and numbers.'
    : st.issues[0] ?? (st.score < 4 ? 'Longer, with symbols and mixed case, is stronger.' : 'Unbreakable. Nice.');
  return (
    <div className={s.strength} id={id}>
      <div className={s.strengthRow}>
        <div className={s.segs} aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={s.seg} data-on={i < lit ? tone : undefined} />
          ))}
        </div>
        <span className={s.strengthLabel} data-tone={empty ? undefined : tone} aria-live="polite">
          {empty ? 'Strength' : st.label}
        </span>
      </div>
      {!error && <p className={s.hint}>{hint}</p>}
    </div>
  );
}

/* ── Screen ─────────────────────────────────────────────────── */

export default function AuthScreen(_props: ScreenProps) {
  // Freeze the mode at mount: the exiting layer keeps rendering while the
  // router already points at the next route.
  const [mode] = useState<Mode>(() => (getRouter().route.name === 'register' ? 'register' : 'login'));
  const isReg = mode === 'register';
  const copy = COPY[mode];
  const reduceMotion = useSettings((st) => st.reduceMotion);

  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lock, setLock] = useState<{ until: number; seconds: number } | null>(null);
  const [now, setNow] = useState(wallClock);

  const [panel, animate] = useAnimate<HTMLDivElement>();
  const nameRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const pw2Ref = useRef<HTMLInputElement>(null);
  const focusField = (key: FieldKey) => (key === 'name' ? nameRef : key === 'pw' ? pwRef : pw2Ref).current?.focus();

  const uid = useId();
  const ids = {
    name: `${uid}-name`,
    pw: `${uid}-pw`,
    pw2: `${uid}-pw2`,
    meter: `${uid}-meter`,
    remember: `${uid}-rem`,
    rememberSub: `${uid}-rem-sub`,
  };

  /* live lock countdown */
  const lockLeft = lock ? lock.until - now : 0;
  const locked = lockLeft > 0;
  useEffect(() => {
    if (!lock) return;
    const id = window.setInterval(() => {
      const t = wallClock();
      setNow(t);
      if (t >= lock.until) {
        window.clearInterval(id);
        setLock(null);
        setFormError(null);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [lock]);

  /* ── validation ── */
  const check = (key: FieldKey, v = { name, pw, pw2 }): string | undefined => {
    if (key === 'name') return validateUsername(v.name.trim()) ?? undefined;
    if (key === 'pw') {
      if (!v.pw) return isReg ? 'Choose a password.' : 'Enter your password.';
      if (!isReg) return undefined;
      const st = passwordStrength(v.pw, v.name.trim());
      return st.acceptable ? undefined : st.issues[0];
    }
    if (!isReg) return undefined;
    if (!v.pw2) return 'Confirm your password.';
    return v.pw2 === v.pw ? undefined : "Passwords don't match.";
  };

  const keys: FieldKey[] = isReg ? ['name', 'pw', 'pw2'] : ['name', 'pw'];

  const onBlur = (key: FieldKey) => () => {
    const value = key === 'name' ? name : key === 'pw' ? pw : pw2;
    if (!value && !submitted) return;
    setErrors((e) => ({ ...e, [key]: check(key) }));
  };

  /** Re-validate live once a field is showing an error, so it clears as the player fixes it. */
  const update = (key: FieldKey, value: string) => {
    const next = { name, pw, pw2, [key]: value };
    if (key === 'name') setName(value);
    else if (key === 'pw') setPw(value);
    else setPw2(value);
    if (formError && !locked) setFormError(null);
    setErrors((e) => {
      const out = { ...e };
      if (e[key]) out[key] = check(key, next);
      // keep the confirmation in sync when the first password changes
      if (key === 'pw' && e.pw2) out.pw2 = check('pw2', next);
      return out;
    });
  };

  const fail = () => {
    audio.play('error');
    haptic('error');
    if (!reduceMotion && panel.current) {
      void animate(panel.current, { x: [0, -11, 9, -6, 4, -2, 0] }, { duration: 0.45, ease: 'easeOut' });
    }
  };

  const nextOnEnter = (to: FieldKey) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    focusField(to);
  };

  const handleError = (err: unknown) => {
    if (!(err instanceof AuthError)) {
      console.error('[border-trials] auth failed', err);
      setFormError('Something went wrong. Please try again.');
      return;
    }
    switch (err.code) {
      case 'INVALID_USERNAME':
      case 'USERNAME_TAKEN':
        setErrors({ name: err.message });
        focusField('name');
        break;
      case 'WEAK_PASSWORD':
        setErrors({ pw: err.message });
        focusField('pw');
        break;
      case 'LOCKED': {
        const ms = err.retryAfterMs ?? 30_000;
        const t = wallClock();
        setNow(t);
        setLock({ until: t + ms, seconds: Math.ceil(ms / 1000) });
        setFormError('Too many attempts. This account is temporarily locked.');
        break;
      }
      case 'INVALID_CREDENTIALS':
        setFormError(err.message);
        setPw('');
        focusField('pw');
        break;
      default:
        setFormError(err.message);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || locked) return;
    setSubmitted(true);
    setFormError(null);
    const errs: Errors = {};
    for (const k of keys) errs[k] = check(k);
    setErrors(errs);
    const first = keys.find((k) => errs[k]);
    if (first) {
      focusField(first);
      fail();
      return;
    }

    setBusy(true);
    const unsub = homeOnSignIn();
    try {
      if (isReg) {
        const { carriedGuestProgress } = await useSession.getState().register(name.trim(), pw);
        if (carriedGuestProgress) toast({ kind: 'info', title: 'Guest progress saved to your account' });
      } else {
        await useSession.getState().login(name.trim(), pw, remember);
      }
      unsub();
      audio.play('unlock');
      haptic('success');
      if (getRouter().route.name !== 'home') navigate('/home', { replace: true, transition: 'glitch' });
    } catch (err) {
      unsub();
      setBusy(false);
      handleError(err);
      fail();
    }
  };

  const switchMode = () => {
    audio.play('tap');
    haptic('light');
    navigate(copy.switchTo, { replace: true, transition: 'fade' });
  };

  const eye = (shown: boolean, toggle: () => void) => (
    <IconButton
      label={shown ? 'Hide password' : 'Show password'}
      aria-pressed={shown}
      className={s.eye}
      onMouseDown={(e) => e.preventDefault()}
      onClick={toggle}
    >
      {shown ? <EyeOff size={19} strokeWidth={1.8} /> : <Eye size={19} strokeWidth={1.8} />}
    </IconButton>
  );

  const suit = isReg ? 'diamond' : 'heart';
  const intro = (i: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay: 0.12 + i * 0.07, ease: EASE },
  });

  return (
    <Screen
      bg={ART.welcomeCity}
      shade="none"
      scroll={false}
      bleed
      className={s.root}
      contentClassName={s.content}
      header={<TopBar backTo="/welcome" />}
    >
      {/* rain sits outside the scroller so it stays put while the form scrolls */}
      <Rain intensity={0.32} angle={8} splashes={false} />

      <div className={s.scroller}>
        <div className={[s.stage, isReg ? s.reg : s.login].join(' ')}>
          <div className={s.growTop} aria-hidden />
          <motion.header className={s.head} {...intro(0)}>
            <p className={s.kicker}>
              <span className={s.rule} aria-hidden />
              <SuitIcon suit={suit} size={11} />
              <span>{copy.kicker}</span>
              <span className={s.rule} aria-hidden />
            </p>
            <h1 className={s.title}>
              <GlitchText text={copy.title.toUpperCase()} every={7000} />
            </h1>
            <p className={s.subtitle}>{copy.subtitle}</p>
          </motion.header>

          <form className={s.form} onSubmit={onSubmit} noValidate aria-label={copy.title}>
            <motion.div {...intro(1)}>
              <div ref={panel} className={`glass ${s.panel}`}>
                <span className={s.corner} aria-hidden>
                  <b>A</b>
                  <SuitIcon suit={suit} size={10} />
                </span>
                <span className={[s.corner, s.cornerBr].join(' ')} aria-hidden>
                  <b>A</b>
                  <SuitIcon suit={suit} size={10} />
                </span>

                <Field
                  id={ids.name}
                  inputRef={nameRef}
                  label="Player name"
                  icon={<User size={18} strokeWidth={1.8} />}
                  name="username"
                  type="text"
                  autoComplete="username"
                  enterKeyHint="next"
                  inputMode="text"
                  maxLength={16}
                  placeholder="e.g. Ghost_07"
                  value={name}
                  error={errors.name}
                  onChange={(e) => update('name', e.target.value)}
                  onBlur={onBlur('name')}
                  onKeyDown={nextOnEnter('pw')}
                  readOnly={busy}
                />

                <Field
                  id={ids.pw}
                  inputRef={pwRef}
                  label="Password"
                  icon={<Lock size={18} strokeWidth={1.8} />}
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete={isReg ? 'new-password' : 'current-password'}
                  enterKeyHint={isReg ? 'next' : 'go'}
                  maxLength={128}
                  placeholder={isReg ? 'At least 8 characters' : 'Your password'}
                  value={pw}
                  error={errors.pw}
                  describedBy={isReg ? ids.meter : undefined}
                  onChange={(e) => update('pw', e.target.value)}
                  onBlur={onBlur('pw')}
                  onKeyDown={isReg ? nextOnEnter('pw2') : undefined}
                  readOnly={busy}
                  trailing={eye(showPw, () => setShowPw((v) => !v))}
                >
                  {isReg && <StrengthMeter id={ids.meter} password={pw} username={name.trim()} error={errors.pw} />}
                </Field>

                {isReg && (
                  <Field
                    id={ids.pw2}
                    inputRef={pw2Ref}
                    label="Confirm password"
                    icon={<KeyRound size={18} strokeWidth={1.8} />}
                    name="confirm-password"
                    type={showPw2 ? 'text' : 'password'}
                    autoComplete="new-password"
                    enterKeyHint="go"
                    maxLength={128}
                    placeholder="Repeat password"
                    value={pw2}
                    error={errors.pw2}
                    onChange={(e) => update('pw2', e.target.value)}
                    onBlur={onBlur('pw2')}
                    readOnly={busy}
                    trailing={eye(showPw2, () => setShowPw2((v) => !v))}
                  />
                )}

                {!isReg && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={remember}
                    aria-labelledby={ids.remember}
                    aria-describedby={ids.rememberSub}
                    className={s.switchRow}
                    onClick={() => {
                      audio.play('select');
                      haptic('light');
                      setRemember((v) => !v);
                    }}
                  >
                    <span className={s.switchText}>
                      <span className={s.switchLabel} id={ids.remember}>
                        Remember me
                      </span>
                      <span className={s.switchSub} id={ids.rememberSub}>
                        {remember ? 'Stay signed in for 30 days' : 'Sign out after 12 hours'}
                      </span>
                    </span>
                    <span className={s.switch} data-on={remember || undefined} aria-hidden>
                      <span className={s.knob} />
                    </span>
                  </button>
                )}
              </div>
            </motion.div>

            {formError && (
              <div className={s.alert} role="alert" data-locked={locked || undefined}>
                {locked ? <Lock size={16} strokeWidth={2} aria-hidden /> : <AlertTriangle size={16} strokeWidth={2} aria-hidden />}
                <p>
                  {formError}
                  {locked && lock && (
                    <>
                      <span className="sr-only"> Try again in {lock.seconds} seconds.</span>
                      <span className={s.countdown} aria-hidden>
                        Try again in <b>{clock(lockLeft)}</b>
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}

            <motion.div className={s.submit} {...intro(2)}>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                loading={busy}
                disabled={locked}
                icon={locked ? <Lock size={17} strokeWidth={2.2} /> : undefined}
              >
                {busy ? 'Securing…' : locked ? `Locked · ${clock(lockLeft)}` : copy.submit}
              </Button>
            </motion.div>
          </form>

          <motion.div className={s.below} {...intro(3)}>
            <button type="button" className={s.switchLink} onClick={switchMode}>
              {copy.switchQ} <strong>{copy.switchA}</strong>
            </button>
            <p className={s.trust}>
              <ShieldCheck size={15} strokeWidth={1.8} aria-hidden />
              <span>Your password is hashed and stored only on this device.</span>
            </p>
          </motion.div>
        </div>
      </div>
    </Screen>
  );
}

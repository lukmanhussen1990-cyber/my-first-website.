import { useEffect, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Sheet } from '../ui/Sheet';
import s from './AppSheet.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  /** move focus to (and select) the first text field instead of the sheet itself */
  focusInput?: boolean;
}

/**
 * The shared <Sheet>, portalled into the app container so it layers above the
 * bottom tab bar (a screen's own layer sits below the nav in the stacking
 * order). Falls back to rendering in place if the container can't be found.
 *
 * Also handles dialog focus: on open, focus moves into the sheet (or its first
 * text field); on close, it returns to whatever opened the sheet.
 */
export function AppSheet({ open, onClose, label, children, focusInput }: Props) {
  const anchor = useRef<HTMLSpanElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    // Walk up to the isolated app root (the element that also hosts the nav).
    let el: HTMLElement | null = anchor.current?.parentElement ?? null;
    while (el && getComputedStyle(el).isolation !== 'isolate') el = el.parentElement;
    setHost(el);
  }, []);

  useEffect(() => {
    if (open) {
      const active = document.activeElement;
      returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
      // wait a frame for the sheet to mount; preventScroll keeps the app
      // container from scrolling while the sheet is still sliding in
      const raf = requestAnimationFrame(() => {
        const el = body.current;
        if (!el || el.contains(document.activeElement)) return;
        const field = focusInput ? el.querySelector<HTMLInputElement>('input:not([type="hidden"])') : null;
        if (field) {
          field.focus({ preventScroll: true });
          field.select();
        } else el.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(raf);
    }
    const back = returnTo.current;
    returnTo.current = null;
    if (back?.isConnected) back.focus({ preventScroll: true });
  }, [open, focusInput]);

  const sheet = (
    <Sheet open={open} onClose={onClose} label={label}>
      <div ref={body} className={s.body} tabIndex={-1}>
        {children}
      </div>
    </Sheet>
  );

  return (
    <>
      <span ref={anchor} hidden />
      {host ? createPortal(sheet, host) : sheet}
    </>
  );
}

/** Sheet heading: small crimson kicker over a wide-tracked title. */
export function SheetHead({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) {
  return (
    <header className={s.head}>
      {kicker && <p className={s.kicker}>{kicker}</p>}
      <h2 className={s.title}>{title}</h2>
      {children && <p className={s.sub}>{children}</p>}
    </header>
  );
}

/** Labelled text field styled for sheets. */
export function SheetField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className={s.field}>
      <span className={s.fieldLabel}>{label}</span>
      {children}
      {error ? (
        <span className={s.error} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className={s.hint}>{hint}</span>
      ) : null}
    </label>
  );
}

/** Text input styled for sheets. */
export function SheetInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={[s.input, className].filter(Boolean).join(' ')} {...rest} />;
}

/** Stacked sheet buttons (primary over secondary). */
export function SheetActions({ children }: { children: ReactNode }) {
  return <div className={s.actions}>{children}</div>;
}

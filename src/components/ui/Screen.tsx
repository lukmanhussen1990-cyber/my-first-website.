import type { CSSProperties, ReactNode } from 'react';
import s from './Screen.module.css';

interface Props {
  children: ReactNode;
  /** full-bleed background image URL */
  bg?: string;
  /** CSS background-position for the image */
  bgPosition?: string;
  /**
   * gradient shade over the background:
   *   cinematic — image clear at top, fading to black at the bottom (loading / welcome)
   *   heavy     — dark overall, image as atmosphere only (content screens)
   *   top       — image visible in the top third only (detail headers)
   */
  shade?: 'cinematic' | 'heavy' | 'top' | 'none';
  /** reserve space for the bottom tab bar */
  nav?: boolean;
  /** scroll the content (default true) */
  scroll?: boolean;
  /** remove the side gutters */
  bleed?: boolean;
  /** optional fixed header (TopBar) rendered above the scroll area */
  header?: ReactNode;
  /** optional fixed footer (sticky CTA) rendered below the scroll area */
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
}

/**
 * Base layout for every screen: background art + shade, optional fixed header
 * and footer, and a scrolling content column with safe-area padding.
 */
export function Screen({
  children,
  bg,
  bgPosition = 'center',
  shade = 'heavy',
  nav,
  scroll = true,
  bleed,
  header,
  footer,
  className,
  contentClassName,
  style,
}: Props) {
  return (
    <div className={[s.screen, className].filter(Boolean).join(' ')} style={style}>
      {bg && (
        <div className={s.bg} aria-hidden>
          <img src={bg} alt="" style={{ objectPosition: bgPosition }} decoding="async" />
        </div>
      )}
      {shade !== 'none' && <div className={[s.shade, s[`shade_${shade}`]].join(' ')} aria-hidden />}
      {header && <div className={s.header}>{header}</div>}
      <div
        className={[s.content, scroll && s.scroll, nav && s.withNav, bleed && s.bleed, !header && s.noHeader, footer && s.withFooter, contentClassName]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
      {footer && <div className={[s.footer, nav && s.footerNav].filter(Boolean).join(' ')}>{footer}</div>}
    </div>
  );
}

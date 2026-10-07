import { motion } from 'motion/react';
import type { ScreenProps } from '../app/screens';
import { ART } from '../assets/art';
import { APP_VERSION, AUTHOR } from '../components/AuthorCredit';
import { CreatorPlate } from '../components/meta/CreatorPlate';
import { Logo } from '../components/ui/Logo';
import { Screen } from '../components/ui/Screen';
import { SuitIcon } from '../components/ui/SuitIcon';
import { TopBar } from '../components/ui/TopBar';
import type { SuitId } from '../data/types';
import { useSession } from '../state/session';
import { useSettings } from '../state/settings';
import s from './AboutScreen.module.css';

interface Credit {
  role: string;
  name: string;
  /** the creator's own credits get the display face */
  creator?: boolean;
  note?: string;
}

const CREDIT_GROUPS: { suit: SuitId; credits: Credit[] }[] = [
  {
    suit: 'spade',
    credits: [
      { role: 'Created by', name: AUTHOR, creator: true },
      { role: 'Concept & Direction', name: AUTHOR, creator: true },
      { role: 'Game Design', name: AUTHOR, creator: true },
    ],
  },
  {
    suit: 'heart',
    credits: [
      { role: 'Technology', name: 'React · TypeScript · Vite · Web Audio' },
      { role: 'Art & Sound', name: 'Original, procedurally generated for Border Trials' },
    ],
  },
  {
    suit: 'diamond',
    credits: [
      { role: 'Typefaces', name: 'Orbitron, Rajdhani, Inter, Share Tech Mono', note: 'SIL Open Font License' },
      { role: 'Icons', name: 'Lucide', note: 'ISC License' },
    ],
  },
];

export default function AboutScreen(_props: ScreenProps) {
  const status = useSession((st) => st.status);
  const reduce = useSettings((st) => st.reduceMotion);
  const signedIn = status === 'user' || status === 'guest';

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.3 },
          transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <Screen
      bg={ART.welcomeCity}
      bgPosition="center 30%"
      shade="heavy"
      header={<TopBar title="About & Credits" backTo={signedIn ? '/profile' : '/welcome'} />}
      contentClassName={s.content}
    >
      <motion.header className={s.hero} {...rise(0)}>
        <Logo size="md" />
      </motion.header>

      <motion.blockquote className={s.premise} {...rise(0.08)}>
        <p>
          You wake up in a silent city. Every street is a game board. The only way out is to play —{' '}
          <em>and to win.</em>
        </p>
      </motion.blockquote>

      <CreatorPlate className={s.plate} delay={0.25} />

      <section className={s.roll} aria-labelledby="credits-title">
        <h2 id="credits-title" className={s.rollTitle}>
          <span />
          Credits
          <span />
        </h2>

        {CREDIT_GROUPS.map((g, gi) => (
          <motion.div key={g.suit} className={s.group} {...rise(0.05 * gi)}>
            <span className={[s.groupMark, (g.suit === 'heart' || g.suit === 'diamond') && s.groupMarkRed].filter(Boolean).join(' ')} aria-hidden>
              <SuitIcon suit={g.suit} size={12} />
            </span>
            <dl className={s.credits}>
              {g.credits.map((c) => (
                <div key={c.role} className={s.credit}>
                  <dt>{c.role}</dt>
                  <dd className={c.creator ? s.creator : undefined}>
                    {c.name}
                    {c.note && <small>{c.note}</small>}
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>
        ))}
      </section>

      <motion.aside className={['glass', s.disclaimer].join(' ')} {...rise(0)}>
        <span className={s.disclaimerKicker}>Disclaimer</span>
        <p>
          Border Trials is an original fan-made work inspired by the survival-thriller genre. It is not affiliated with or
          endorsed by any existing series, film or publisher.
        </p>
      </motion.aside>

      <footer className={s.footer}>
        <span className={s.footSuits} aria-hidden>
          <SuitIcon suit="spade" size={10} />
          <SuitIcon suit="heart" size={10} />
          <SuitIcon suit="diamond" size={10} />
          <SuitIcon suit="club" size={10} />
        </span>
        <p>
          © 2026 {AUTHOR} · Border Trials v{APP_VERSION}
        </p>
      </footer>
    </Screen>
  );
}

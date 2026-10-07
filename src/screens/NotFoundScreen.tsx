import { Radio } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { back, navigate, useRoute } from '../app/router';
import type { ScreenProps } from '../app/screens';
import { ART } from '../assets/art';
import { Button } from '../components/ui/Button';
import { GlitchText } from '../components/ui/GlitchText';
import { Screen } from '../components/ui/Screen';
import { audio } from '../services/audio';
import { useSession } from '../state/session';
import { useSettings } from '../state/settings';
import s from './NotFoundScreen.module.css';

export default function NotFoundScreen(_props: ScreenProps) {
  const route = useRoute();
  const status = useSession((st) => st.status);
  const reduce = useSettings((st) => st.reduceMotion);
  const signedIn = status === 'user' || status === 'guest';
  const home = signedIn ? '/home' : '/welcome';

  // one stinger per visit (StrictMode re-runs effects in dev)
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    audio.play('glitch');
  }, []);

  return (
    <Screen bg={ART.loadingHero} bgPosition="center 20%" shade="heavy" contentClassName={s.content}>
      <div className={s.fx} aria-hidden>
        {!reduce && <div className={s.static} style={{ backgroundImage: `url(${ART.noise})` }} />}
        <div className={['scanlines', s.scan].join(' ')} />
      </div>

      <p className={s.status}>
        <span className={s.live} aria-hidden />
        ERR 404 <i>//</i> Sector not found
      </p>

      <div className={s.stage}>
        {/* a card back torn in two */}
        <div className={[s.card, !reduce && s.cardDrift].filter(Boolean).join(' ')} aria-hidden>
          <img className={[s.half, s.halfA].join(' ')} src={ART.cardBack} alt="" decoding="async" />
          <img className={[s.half, s.halfB].join(' ')} src={ART.cardBack} alt="" decoding="async" />
          <span className={s.tear} />
        </div>

        <h1 className={s.code}>
          <GlitchText text="404" every={2600} />
        </h1>
        <h2 className={s.title}>
          <Radio size={18} strokeWidth={2} aria-hidden />
          <GlitchText text="SIGNAL LOST" every={3400} />
        </h2>
        <p className={s.reason}>This sector of the city doesn't exist.</p>
        <code className={s.path} title={route.path}>
          #{route.path}
        </code>
      </div>

      <div className={s.actions}>
        <Button block size="lg" onClick={() => navigate(home, { replace: true, transition: 'glitch' })}>
          {signedIn ? 'Return to the city' : 'Back to the gate'}
        </Button>
        <Button block variant="ghost" sfx="back" onClick={() => back(home)}>
          Go back
        </Button>
      </div>
    </Screen>
  );
}

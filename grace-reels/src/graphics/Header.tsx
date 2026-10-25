import { BRAND, SANS } from "./brand";
import { Logo } from "./Logo";

// Small series header at y ~ 150: logo + GRACE IN MOTION left, episode code + title right.

export const Header: React.FC<{ episode: string; title: string; onLight: number; opacity?: number }> = ({ episode, title, onLight, opacity = 1 }) => {
  const color = onLight > 0.5 ? BRAND.ink : BRAND.cream;
  const logo = onLight > 0.5 ? BRAND.deepGold : BRAND.gold;
  const text: React.CSSProperties = {
    fontFamily: SANS,
    fontWeight: 600,
    fontSize: 22,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color,
    whiteSpace: "nowrap",
  };
  return (
    <div style={{ position: "absolute", left: 72, right: 120, top: 134, height: 34, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.75 * opacity }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Logo size={30} color={logo} />
        <span style={text}>{BRAND.name}</span>
      </div>
      <span style={text}>{`${episode} · ${title}`}</span>
    </div>
  );
};

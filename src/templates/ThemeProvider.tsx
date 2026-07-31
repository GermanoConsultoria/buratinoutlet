'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ALL_TEMPLATES,
  TEMPLATE_MAP,
  applyTheme,
  getSavedThemeId,
  type ThemeAnimation,
  type ThemeTemplate,
} from './index';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ThemeContextType {
  activeTheme: ThemeTemplate;
  setTheme: (id: string) => void;
  templates: ThemeTemplate[];
}

const ThemeContext = createContext<ThemeContextType>({
  activeTheme: ALL_TEMPLATES[0],
  setTheme: () => {},
  templates: ALL_TEMPLATES,
});

export function useTheme() {
  return useContext(ThemeContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState('default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = getSavedThemeId();
    setActiveId(saved);
    applyTheme(saved);
  }, []);

  const setTheme = useCallback((id: string) => {
    setActiveId(id);
    applyTheme(id);
  }, []);

  const activeTheme = TEMPLATE_MAP[activeId] ?? ALL_TEMPLATES[0];

  return (
    <ThemeContext.Provider value={{ activeTheme, setTheme, templates: ALL_TEMPLATES }}>
      {children}
      {mounted && <ThemeAnimation animation={activeTheme.animation ?? null} />}
    </ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Animation overlay — pointer-events:none, above everything
// ---------------------------------------------------------------------------

const ANIMATION_CSS = `
@keyframes pdv-snowfall {
  0%   { transform: translateY(-20px) rotate(0deg);   opacity: 0; }
  5%   { opacity: 0.8; }
  95%  { opacity: 0.6; }
  100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
}
@keyframes pdv-confetti-fall {
  0%   { transform: translateY(-20px) rotate(0deg)   scaleX(1); opacity: 0; }
  5%   { opacity: 1; }
  95%  { opacity: 0.8; }
  100% { transform: translateY(105vh) rotate(540deg) scaleX(-1); opacity: 0; }
}
@keyframes pdv-firework-burst {
  0%   { transform: scale(0) rotate(0deg);   opacity: 1; }
  60%  { opacity: 0.9; }
  100% { transform: scale(1.8) rotate(45deg); opacity: 0; }
}
@keyframes pdv-firework-spark {
  0%   { transform: translateY(0)    scale(1); opacity: 1; }
  100% { transform: translateY(-40px) scale(0); opacity: 0; }
}
`;

function ThemeAnimation({ animation }: { animation: ThemeAnimation }) {
  if (!animation) return null;

  return (
    <>
      <style>{ANIMATION_CSS}</style>
      {animation === 'snow' && <SnowOverlay />}
      {animation === 'confetti' && <ConfettiOverlay />}
      {animation === 'fireworks' && <FireworksOverlay />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Snow
// ---------------------------------------------------------------------------

const SNOWFLAKES = Array.from({ length: 30 }, (_, i) => ({
  left: `${(i * 3.4 + 1.7) % 100}%`,
  delay: `${((i * 0.73) % 6).toFixed(2)}s`,
  duration: `${(4 + (i * 0.45) % 6).toFixed(2)}s`,
  fontSize: `${10 + (i * 0.9) % 14}px`,
  opacity: 0.45 + (i * 0.018) % 0.5,
}));

function SnowOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      {SNOWFLAKES.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: '-20px',
            left: s.left,
            fontSize: s.fontSize,
            opacity: s.opacity,
            userSelect: 'none',
            animation: `pdv-snowfall ${s.duration} ${s.delay} infinite linear`,
          }}
        >
          ❄
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confetti
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = ['#f1c40f', '#e91e8c', '#8e44ad', '#3498db', '#27ae60', '#e74c3c', '#ff9800'];

const CONFETTI_PIECES = Array.from({ length: 40 }, (_, i) => ({
  left: `${(i * 2.55 + 0.5) % 100}%`,
  delay: `${((i * 0.55) % 7).toFixed(2)}s`,
  duration: `${(3.5 + (i * 0.38) % 5).toFixed(2)}s`,
  size: `${6 + (i * 0.6) % 10}px`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '0',
}));

function ConfettiOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      {CONFETTI_PIECES.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: '-20px',
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.borderRadius,
            animation: `pdv-confetti-fall ${p.duration} ${p.delay} infinite linear`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fireworks
// ---------------------------------------------------------------------------

const FIREWORK_POSITIONS = [
  { top: '15%', left: '20%' },
  { top: '25%', left: '75%' },
  { top: '10%', left: '50%' },
  { top: '30%', left: '35%' },
  { top: '20%', left: '85%' },
  { top: '40%', left: '60%' },
  { top: '12%', left: '10%' },
  { top: '35%', left: '90%' },
];

const SPARK_OFFSETS = [
  { x: -18, y: -18 }, { x: 0, y: -24 }, { x: 18, y: -18 },
  { x: 24, y: 0 },   { x: 18, y: 18 },  { x: 0, y: 24 },
  { x: -18, y: 18 }, { x: -24, y: 0 },
];

function FireworksOverlay() {
  const bursts = useMemo(
    () =>
      FIREWORK_POSITIONS.map((pos, i) => ({
        ...pos,
        delay: `${((i * 1.3) % 5).toFixed(1)}s`,
        duration: `${(1.8 + (i * 0.35) % 1.2).toFixed(2)}s`,
        color: ['#c9a227', '#e0e0f0', '#d4af37', '#b8b8d0', '#f0c060', '#c0c0e0'][i % 6],
      })),
    [],
  );

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      {bursts.map((burst, bi) => (
        <div
          key={bi}
          style={{
            position: 'absolute',
            top: burst.top,
            left: burst.left,
          }}
        >
          {/* Centre burst ring */}
          <div
            style={{
              position: 'absolute',
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: `2px solid ${burst.color}`,
              transform: 'translate(-50%, -50%)',
              animation: `pdv-firework-burst ${burst.duration} ${burst.delay} infinite ease-out`,
            }}
          />
          {/* Sparks */}
          {SPARK_OFFSETS.map((sp, si) => (
            <div
              key={si}
              style={{
                position: 'absolute',
                width: 4,
                height: 4,
                borderRadius: '50%',
                backgroundColor: burst.color,
                left: `calc(50% + ${sp.x}px)`,
                top: `calc(50% + ${sp.y}px)`,
                animation: `pdv-firework-spark ${burst.duration} ${burst.delay} infinite ease-out`,
                animationDelay: `${parseFloat(burst.delay) + si * 0.04}s`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

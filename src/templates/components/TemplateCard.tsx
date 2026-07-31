import { Check, Zap } from 'lucide-react';
import { ILLUSTRATIONS } from '../illustrations';
import type { ThemeTemplate, ThemeCategory } from '../types';

const CATEGORY_LABELS: Record<ThemeCategory, string> = {
  padrao: 'Clássico',
  sazonal: 'Sazonal',
  festivo: 'Festivo',
  premium: 'Premium',
};

const CATEGORY_BG: Record<ThemeCategory, string> = {
  padrao:  'rgba(59,130,246,0.22)',
  sazonal: 'rgba(34,197,94,0.22)',
  festivo: 'rgba(236,72,153,0.22)',
  premium: 'rgba(245,158,11,0.22)',
};
const CATEGORY_COLOR: Record<ThemeCategory, string> = {
  padrao:  '#60a5fa',
  sazonal: '#4ade80',
  festivo: '#f472b6',
  premium: '#fbbf24',
};

interface TemplateCardProps {
  template: ThemeTemplate;
  isActive: boolean;
  onApply: () => void;
}

function ThemeIllustration({ templateId }: { templateId: string }) {
  const cfg = ILLUSTRATIONS[templateId];
  if (!cfg) return <div className="absolute inset-0 bg-muted" />;

  const mx = cfg.mainEmojiX ?? '50%';
  const my = cfg.mainEmojiY ?? '45%';

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: cfg.gradient }}>
      {/* Main emoji */}
      <span
        style={{
          position: 'absolute',
          left: mx,
          top: my,
          fontSize: cfg.mainEmojiSize,
          transform: 'translate(-50%, -50%)',
          lineHeight: 1,
          filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.5))',
          userSelect: 'none',
          zIndex: 2,
        }}
      >
        {cfg.mainEmoji}
      </span>

      {/* Optional text overlay (e.g. "2025") */}
      {cfg.overlayText && (
        <span
          style={{
            position: 'absolute',
            right: '6%',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '42px',
            fontWeight: 900,
            fontFamily: 'system-ui, sans-serif',
            background: 'linear-gradient(135deg, #ffd700, #c9a227)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-1px',
            filter: 'drop-shadow(0 0 12px rgba(201,162,39,0.6))',
            lineHeight: 1,
            userSelect: 'none',
            zIndex: 2,
          }}
        >
          {cfg.overlayText}
        </span>
      )}

      {/* Decorative emojis */}
      {cfg.decor?.map((d, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: d.x,
            top: d.y,
            fontSize: d.size ?? '20px',
            transform: d.rotate ? `rotate(${d.rotate})` : undefined,
            opacity: d.opacity ?? 1,
            lineHeight: 1,
            userSelect: 'none',
            zIndex: 1,
          }}
        >
          {d.emoji}
        </span>
      ))}

      {/* Subtle vignette at bottom for text readability */}
      <div
        className="absolute bottom-0 left-0 right-0 h-10"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.35), transparent)' }}
      />
    </div>
  );
}

export function TemplateCard({ template, isActive, onApply }: TemplateCardProps) {
  const cfg = ILLUSTRATIONS[template.id];
  const btnColor = cfg?.buttonColor ?? '#3b6ad4';
  const btnTextColor = cfg?.buttonTextColor ?? '#fff';

  return (
    <div
      className={`
        group flex flex-col rounded-2xl overflow-hidden cursor-pointer
        transition-all duration-300
        ${isActive
          ? 'ring-2 shadow-2xl scale-[1.02]'
          : 'hover:shadow-xl hover:scale-[1.015] hover:-translate-y-0.5 shadow-md'
        }
      `}
      style={{
        background: 'var(--color-card)',
        border: isActive ? `2px solid ${btnColor}` : '1px solid rgba(128,128,128,0.15)',
        boxShadow: isActive ? `0 8px 40px -8px ${btnColor}66` : undefined,
      }}
      onClick={!isActive ? onApply : undefined}
    >
      {/* Illustration area */}
      <div className="relative h-48 overflow-hidden">
        <ThemeIllustration templateId={template.id} />

        {/* Active badge */}
        {isActive && (
          <div
            className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-lg"
            style={{ backgroundColor: btnColor, color: btnTextColor }}
          >
            <Check className="h-3 w-3" strokeWidth={3} />
            Ativo
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2.5 p-4" style={{ background: 'var(--color-card)' }}>
        {/* Name + category */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-base leading-tight" style={{ color: 'var(--color-foreground)' }}>
            {template.name}
          </h3>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              backgroundColor: CATEGORY_BG[template.category],
              color: CATEGORY_COLOR[template.category],
            }}
          >
            {CATEGORY_LABELS[template.category]}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--color-muted-foreground)' }}>
          {template.description}
        </p>

        {/* Color swatches */}
        <div className="flex items-center gap-1.5">
          {template.palette.map((c, i) => (
            <div
              key={i}
              className="h-4 w-4 rounded-full shadow-sm"
              style={{ backgroundColor: c, border: '2px solid rgba(255,255,255,0.25)' }}
            />
          ))}
        </div>

        {/* Apply button */}
        <button
          onClick={(e) => { e.stopPropagation(); if (!isActive) onApply(); }}
          disabled={isActive}
          className={`
            mt-0.5 w-full flex items-center justify-center gap-2 rounded-xl py-2.5
            text-sm font-bold transition-all duration-200
            ${isActive ? 'cursor-default opacity-80' : 'hover:brightness-110 active:scale-[0.97]'}
          `}
          style={{
            backgroundColor: isActive ? `${btnColor}28` : btnColor,
            color: isActive ? btnColor : btnTextColor,
            border: isActive ? `1.5px solid ${btnColor}55` : 'none',
          }}
        >
          {isActive ? (
            <><Check className="h-4 w-4" strokeWidth={2.5} /> Em uso</>
          ) : (
            <><Zap className="h-4 w-4" /> Aplicar template</>
          )}
        </button>
      </div>
    </div>
  );
}

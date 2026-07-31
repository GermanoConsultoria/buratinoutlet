import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ThemeTemplate, ThemeCategory } from '../types';

const CATEGORY_LABELS: Record<ThemeCategory, string> = {
  padrao: 'Padrão',
  sazonal: 'Sazonal',
  festivo: 'Festivo',
  premium: 'Premium',
};

const CATEGORY_COLORS: Record<ThemeCategory, string> = {
  padrao: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  sazonal: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  festivo: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  premium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

interface TemplateCardProps {
  template: ThemeTemplate;
  isActive: boolean;
  onApply: () => void;
}

export function TemplateCard({ template, isActive, onApply }: TemplateCardProps) {
  return (
    <div
      className={`
        relative flex flex-col rounded-xl border bg-card overflow-hidden
        transition-all duration-200
        ${isActive ? 'ring-2 ring-primary shadow-lg scale-[1.02]' : 'hover:shadow-md hover:border-primary/30'}
      `}
    >
      {/* Palette preview strip */}
      <div className="h-24 w-full flex overflow-hidden">
        {template.palette.map((color, i) => (
          <div
            key={i}
            className="flex-1 transition-all duration-300"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      {/* Sidebar preview overlay on the left of strip */}
      <div
        className="absolute top-0 left-0 w-8 h-24 opacity-90"
        style={{ backgroundColor: template.palette[2] }}
      />

      {/* Active badge */}
      {isActive && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-primary text-primary-foreground text-[11px] font-semibold px-2 py-0.5 rounded-full shadow">
          <Check className="h-3 w-3" />
          Em uso
        </div>
      )}

      {/* Card body */}
      <div className="flex flex-col gap-3 p-4 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none" role="img" aria-label={template.name}>
              {template.emoji}
            </span>
            <div>
              <h3 className="font-semibold text-sm text-card-foreground leading-tight">
                {template.name}
              </h3>
              <span
                className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${CATEGORY_COLORS[template.category]}`}
              >
                {CATEGORY_LABELS[template.category]}
              </span>
            </div>
          </div>
          {template.animation && (
            <span title="Animação ativa" aria-label="Animação ativa">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
          {template.description}
        </p>

        {/* Palette swatches */}
        <div className="flex gap-1.5">
          {template.palette.map((color, i) => (
            <div
              key={i}
              className="h-4 w-4 rounded-full border border-black/10 shadow-sm shrink-0"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>

        <Button
          size="sm"
          variant={isActive ? 'secondary' : 'default'}
          className="w-full mt-auto"
          onClick={onApply}
          disabled={isActive}
        >
          {isActive ? (
            <><Check className="h-3.5 w-3.5 mr-1.5" /> Aplicado</>
          ) : (
            'Aplicar'
          )}
        </Button>
      </div>
    </div>
  );
}

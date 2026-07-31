import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { Info, RotateCcw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useTheme } from '@/templates/ThemeProvider';
import { TemplateCard } from '@/templates/components/TemplateCard';
import { ILLUSTRATIONS } from '@/templates/illustrations';
import type { ThemeCategory } from '@/templates/types';

export const Route = createFileRoute('/_app/templates')({
  component: TemplatesPage,
});

type FilterCategory = 'todos' | ThemeCategory;

const FILTER_LABELS: Record<FilterCategory, string> = {
  todos:   'Todos',
  padrao:  'Clássicos',
  sazonal: 'Sazonais',
  festivo: 'Festivos',
  premium: 'Premium',
};

const FILTERS: FilterCategory[] = ['todos', 'sazonal', 'festivo', 'padrao', 'premium'];

function TemplatesPage() {
  const { activeTheme, setTheme, templates } = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterCategory>('todos');

  const activeCfg = ILLUSTRATIONS[activeTheme.id];

  const visible = useMemo(
    () =>
      templates.filter((t) => {
        const matchesCategory = filter === 'todos' || t.category === filter;
        const matchesSearch =
          !search ||
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
      }),
    [templates, filter, search],
  );

  function handleApply(id: string) {
    const tpl = templates.find((t) => t.id === id);
    setTheme(id);
    toast.success(`${tpl?.emoji ?? ''} Template "${tpl?.name ?? id}" aplicado!`);
  }

  function handleHowItWorks() {
    toast.info('Escolha um template e clique em "Aplicar template". A troca é instantânea e salva automaticamente para o próximo acesso.', { duration: 6000 });
  }

  return (
    <div className="space-y-6">
      {/* Page title row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
            Templates
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            Personalize completamente a aparência do sistema com temas incríveis e imersivos.
          </p>
        </div>
        <button
          onClick={handleHowItWorks}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
        >
          <Info className="h-4 w-4" />
          Como funciona
        </button>
      </div>

      {/* Active theme banner */}
      <div
        className="flex items-center gap-4 rounded-2xl border px-5 py-4"
        style={{
          background: 'var(--color-card)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Theme icon circle */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-inner"
          style={{
            background: activeCfg
              ? activeCfg.gradient.slice(0, activeCfg.gradient.indexOf(',') + 20)
              : 'var(--color-accent)',
            backgroundSize: 'cover',
          }}
        >
          {activeTheme.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>
            Tema Ativo
          </p>
          <p className="text-lg font-bold leading-tight" style={{ color: 'var(--color-foreground)' }}>
            {activeTheme.name}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>
            {activeTheme.description}
          </p>
        </div>

        {/* Reset button — only if not already on default */}
        {activeTheme.id !== 'default' && (
          <button
            onClick={() => handleApply('default')}
            className="flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all hover:bg-accent active:scale-95"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Voltar ao Padrão
          </button>
        )}
      </div>

      {/* Search + filter row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-muted-foreground)' }} />
          <Input
            placeholder="Buscar template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* "Todos" tab first, then the category filters */}
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`
                  rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200
                  ${active ? 'shadow-md' : 'hover:opacity-80'}
                `}
                style={
                  active
                    ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }
                    : { backgroundColor: 'var(--color-secondary)', color: 'var(--color-secondary-foreground)' }
                }
              >
                {FILTER_LABELS[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards grid */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20" style={{ color: 'var(--color-muted-foreground)' }}>
          <Search className="h-12 w-12 opacity-20" />
          <p className="text-sm">Nenhum template encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visible.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isActive={activeTheme.id === template.id}
              onApply={() => handleApply(template.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

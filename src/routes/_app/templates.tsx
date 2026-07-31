import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { Palette, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useTheme } from '@/templates/ThemeProvider';
import { TemplateCard } from '@/templates/components/TemplateCard';
import type { ThemeCategory } from '@/templates/types';

export const Route = createFileRoute('/_app/templates')({
  component: TemplatesPage,
});

type FilterCategory = 'todos' | ThemeCategory;

const FILTER_LABELS: Record<FilterCategory, string> = {
  todos: 'Todos',
  padrao: 'Padrão',
  sazonal: 'Sazonais',
  festivo: 'Festivos',
  premium: 'Premium',
};

const FILTERS: FilterCategory[] = ['todos', 'padrao', 'sazonal', 'festivo', 'premium'];

function TemplatesPage() {
  const { activeTheme, setTheme, templates } = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterCategory>('todos');

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
    const name = templates.find((t) => t.id === id)?.name ?? id;
    setTheme(id);
    toast.success(`Template "${name}" aplicado com sucesso!`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Palette className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Personalize a aparência do sistema — a mudança é instantânea e salva automaticamente.
          </p>
        </div>
      </div>

      {/* Active theme banner */}
      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <span className="text-2xl">{activeTheme.emoji}</span>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Template ativo: {activeTheme.name}
          </p>
          <p className="text-xs text-muted-foreground">{activeTheme.description}</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                rounded-full px-3 py-1 text-xs font-medium transition-all
                ${filter === f
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }
              `}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Palette className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum template encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

      {/* Footer hint */}
      <p className="text-center text-xs text-muted-foreground pb-4">
        {templates.length} templates disponíveis · Selecione "Padrão" para restaurar o visual original
      </p>
    </div>
  );
}

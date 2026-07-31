export type { ThemeTemplate, ThemeVars, ThemeCategory, ThemeAnimation } from './types';

export { defaultTheme } from './themes/default';
export { christmasTheme } from './themes/christmas';
export { carnavalTheme } from './themes/carnaval';
export { halloweenTheme } from './themes/halloween';
export { newYearTheme } from './themes/newYear';
export { easterTheme } from './themes/easter';
export { winterTheme } from './themes/winter';
export { summerTheme } from './themes/summer';
export { darkPremiumTheme } from './themes/darkPremium';

import { defaultTheme } from './themes/default';
import { christmasTheme } from './themes/christmas';
import { carnavalTheme } from './themes/carnaval';
import { halloweenTheme } from './themes/halloween';
import { newYearTheme } from './themes/newYear';
import { easterTheme } from './themes/easter';
import { winterTheme } from './themes/winter';
import { summerTheme } from './themes/summer';
import { darkPremiumTheme } from './themes/darkPremium';
import type { ThemeTemplate } from './types';

// Add new themes here only — everything else auto-updates
export const ALL_TEMPLATES: ThemeTemplate[] = [
  defaultTheme,
  christmasTheme,
  carnavalTheme,
  halloweenTheme,
  newYearTheme,
  easterTheme,
  winterTheme,
  summerTheme,
  darkPremiumTheme,
];

export const TEMPLATE_MAP: Record<string, ThemeTemplate> = Object.fromEntries(
  ALL_TEMPLATES.map((t) => [t.id, t]),
);

// All CSS vars this system manages — used to clean up between theme switches
const MANAGED_VARS = [
  'background', 'foreground',
  'card', 'card-foreground',
  'popover', 'popover-foreground',
  'primary', 'primary-foreground',
  'secondary', 'secondary-foreground',
  'muted', 'muted-foreground',
  'accent', 'accent-foreground',
  'destructive', 'destructive-foreground',
  'border', 'input', 'ring',
  'brand', 'brand-foreground', 'brand-pink',
  'sidebar', 'sidebar-foreground',
  'sidebar-primary', 'sidebar-primary-foreground',
  'sidebar-accent', 'sidebar-accent-foreground',
  'sidebar-border', 'sidebar-ring',
  'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5',
] as const;

export function applyTheme(templateId: string): void {
  if (typeof document === 'undefined') return;

  const template = TEMPLATE_MAP[templateId] ?? defaultTheme;
  const root = document.documentElement;

  // Clear all previously injected vars so default theme always restores CSS file values
  MANAGED_VARS.forEach((v) => root.style.removeProperty(`--${v}`));

  // Tag the active theme on <html> for future CSS targeting
  root.setAttribute('data-theme', template.id);

  // Apply the new vars (for default, vars is empty so this loop is a no-op)
  Object.entries(template.vars).forEach(([key, value]) => {
    if (value) root.style.setProperty(`--${key}`, value);
  });

  try {
    localStorage.setItem('pdvgtech-theme', templateId);
  } catch {
    // localStorage unavailable (private browsing, etc.) — silently ignore
  }
}

export function getSavedThemeId(): string {
  if (typeof localStorage === 'undefined') return 'default';
  try {
    return localStorage.getItem('pdvgtech-theme') ?? 'default';
  } catch {
    return 'default';
  }
}

export type ThemeCategory = 'padrao' | 'sazonal' | 'festivo' | 'premium';
export type ThemeAnimation = 'snow' | 'confetti' | 'fireworks' | null;

export interface ThemeVars {
  background?: string;
  foreground?: string;
  card?: string;
  'card-foreground'?: string;
  popover?: string;
  'popover-foreground'?: string;
  primary?: string;
  'primary-foreground'?: string;
  secondary?: string;
  'secondary-foreground'?: string;
  muted?: string;
  'muted-foreground'?: string;
  accent?: string;
  'accent-foreground'?: string;
  destructive?: string;
  'destructive-foreground'?: string;
  border?: string;
  input?: string;
  ring?: string;
  brand?: string;
  'brand-foreground'?: string;
  'brand-pink'?: string;
  sidebar?: string;
  'sidebar-foreground'?: string;
  'sidebar-primary'?: string;
  'sidebar-primary-foreground'?: string;
  'sidebar-accent'?: string;
  'sidebar-accent-foreground'?: string;
  'sidebar-border'?: string;
  'sidebar-ring'?: string;
  'chart-1'?: string;
  'chart-2'?: string;
  'chart-3'?: string;
  'chart-4'?: string;
  'chart-5'?: string;
}

export interface ThemeTemplate {
  id: string;
  name: string;
  description: string;
  category: ThemeCategory;
  emoji: string;
  /** 4 hex colors used only for the visual swatches preview */
  palette: [string, string, string, string];
  vars: ThemeVars;
  animation?: ThemeAnimation;
}

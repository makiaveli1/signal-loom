'use client';

export const SIGNAL_THEME_STORAGE_KEY = 'signal-loom-theme-v1';

export const SIGNAL_THEMES = [
  {
    id: 'midnight-broadcast',
    label: 'Midnight',
    description: 'Carbon, brass, teal — the original command room.',
    preview: ['#0c0e12', '#3dc9c4', '#c9a03a'],
  },
  {
    id: 'nero-ember',
    label: 'Nero Ember',
    description: 'Warmer command-chair energy with ember and brass accents.',
    preview: ['#110c0a', '#ff6a3d', '#f0bd58'],
  },
  {
    id: 'oracle-teal',
    label: 'Oracle Teal',
    description: 'Cooler observatory glass for long reading sessions.',
    preview: ['#071112', '#56eadf', '#8ea7ff'],
  },
  {
    id: 'papyrus-dawn',
    label: 'Papyrus Dawn',
    description: 'A soft daylight theme for calmer daytime work.',
    preview: ['#f0e6d8', '#0b8b84', '#8f650c'],
  },
] as const;

export type SignalThemeId = (typeof SIGNAL_THEMES)[number]['id'];

export const DEFAULT_SIGNAL_THEME: SignalThemeId = 'midnight-broadcast';

export function isSignalThemeId(value: string | null | undefined): value is SignalThemeId {
  return SIGNAL_THEMES.some((theme) => theme.id === value);
}

export function applySignalTheme(themeId: SignalThemeId) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.signalTheme = themeId;
}

export function getStoredSignalTheme(): SignalThemeId {
  if (typeof window === 'undefined') return DEFAULT_SIGNAL_THEME;
  const stored = window.localStorage.getItem(SIGNAL_THEME_STORAGE_KEY);
  return isSignalThemeId(stored) ? stored : DEFAULT_SIGNAL_THEME;
}

export function persistSignalTheme(themeId: SignalThemeId) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SIGNAL_THEME_STORAGE_KEY, themeId);
}

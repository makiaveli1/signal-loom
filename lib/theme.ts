export const SIGNAL_THEME_STORAGE_KEY = 'signal-loom-theme-v1';

export type SignalThemeTone = 'dark' | 'warm' | 'cool' | 'light' | 'contrast';

export type SignalTheme = {
  id: string;
  label: string;
  shortLabel: string;
  tone: SignalThemeTone;
  intent: string;
  description: string;
  preview: readonly [string, string, string];
};

export const SIGNAL_THEMES = [
  {
    id: 'midnight-broadcast',
    label: 'Midnight Broadcast',
    shortLabel: 'Midnight',
    tone: 'dark',
    intent: 'Default command-room theme for everyday operation.',
    description: 'Carbon command room with teal signal energy and brass decision accents.',
    preview: ['#0c0e12', '#3dc9c4', '#c9a03a'],
  },
  {
    id: 'nero-ember',
    label: 'Nero Ember',
    shortLabel: 'Ember',
    tone: 'warm',
    intent: 'Warmer night mode for decisive triage and review sessions.',
    description: 'Deep ember surfaces, hot orange action cues, and brass highlights.',
    preview: ['#110c0a', '#ff6a3d', '#f0bd58'],
  },
  {
    id: 'oracle-teal',
    label: 'Oracle Teal',
    shortLabel: 'Oracle',
    tone: 'cool',
    intent: 'Cool observatory mode for long reading and research passes.',
    description: 'Low-glare teal glass with blue-violet secondary signals.',
    preview: ['#071112', '#56eadf', '#8ea7ff'],
  },
  {
    id: 'papyrus-dawn',
    label: 'Papyrus Dawn',
    shortLabel: 'Dawn',
    tone: 'light',
    intent: 'Daylight reading mode with softer contrast and paper warmth.',
    description: 'Warm paper surfaces, ink text, teal activity, and restrained brass.',
    preview: ['#f0e6d8', '#0b8b84', '#8f650c'],
  },
  {
    id: 'sentry-high-contrast',
    label: 'Sentry Contrast',
    shortLabel: 'Sentry',
    tone: 'contrast',
    intent: 'Maximum-legibility mode for glare, tired eyes, and accessibility checks.',
    description: 'Near-black surfaces, crisp white text, cyan focus, amber warnings, zero-mystery contrast.',
    preview: ['#030506', '#00f5ff', '#ffd166'],
  },
] as const satisfies readonly SignalTheme[];

export type SignalThemeId = (typeof SIGNAL_THEMES)[number]['id'];

export const SIGNAL_THEME_IDS = SIGNAL_THEMES.map((theme) => theme.id) as SignalThemeId[];
export const DEFAULT_SIGNAL_THEME: SignalThemeId = 'midnight-broadcast';

export function isSignalThemeId(value: string | null | undefined): value is SignalThemeId {
  return SIGNAL_THEME_IDS.includes(value as SignalThemeId);
}

export function applySignalTheme(themeId: SignalThemeId) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.signalTheme = themeId;
  document.documentElement.style.colorScheme = themeId === 'papyrus-dawn' ? 'light' : 'dark';
}

export function getStoredSignalTheme(): SignalThemeId {
  if (typeof window === 'undefined') return DEFAULT_SIGNAL_THEME;
  const stored = window.localStorage.getItem(SIGNAL_THEME_STORAGE_KEY);
  return isSignalThemeId(stored) ? stored : DEFAULT_SIGNAL_THEME;
}

export function persistSignalTheme(themeId: SignalThemeId) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SIGNAL_THEME_STORAGE_KEY, themeId);
  document.cookie = `${SIGNAL_THEME_STORAGE_KEY}=${encodeURIComponent(themeId)}; path=/; max-age=31536000; SameSite=Lax`;
}

export const SIGNAL_THEME_STORAGE_KEY = 'signal-loom-theme-v1';

export type SignalThemeTone = 'dark' | 'warm' | 'cool' | 'light' | 'contrast';
export type SignalThemeRadius = 'sharp' | 'standard' | 'soft';
export type SignalThemeDensity = 'compact' | 'balanced' | 'spacious';
export type SignalThemeMaterial = 'matte' | 'paper' | 'obsidian' | 'high-contrast';
export type SignalThemeMotion = 'signal' | 'calm' | 'minimal' | 'none';
export type SignalThemeTexture =
  | 'broadcast-grid'
  | 'ember-routing'
  | 'oracle-field'
  | 'paper-trace'
  | 'sentry-scan'
  | 'monoline-terminal'
  | 'glass-command'
  | 'green-grid'
  | 'ivory-map'
  | 'violet-wires';
export type SignalThemeControl = 'console-cut' | 'pill-soft' | 'keycap' | 'mono-block' | 'paper-tab';
export type SignalThemeDepth = 'flat' | 'inset' | 'raised' | 'paper' | 'wire';
export type SignalThemeRhythm = 'operator' | 'instrument' | 'terminal' | 'editorial';

export type SignalThemePreview = {
  canvas: string;
  surface: string;
  accent: string;
  decision: string;
  danger: string;
};

export type SignalTheme = {
  id: string;
  label: string;
  shortLabel: string;
  tone: SignalThemeTone;
  intent: string;
  description: string;
  radius: SignalThemeRadius;
  density: SignalThemeDensity;
  material: SignalThemeMaterial;
  motion: SignalThemeMotion;
  texture: SignalThemeTexture;
  control: SignalThemeControl;
  depth: SignalThemeDepth;
  rhythm: SignalThemeRhythm;
  preview: SignalThemePreview;
};

export const SIGNAL_THEMES = [
  {
    id: 'midnight-broadcast',
    label: 'Midnight Broadcast',
    shortLabel: 'Midnight',
    tone: 'dark',
    intent: 'Default command room: calm carbon, teal signal traces, brass decisions.',
    description: 'Broadcast-desk baseline: boxed console cuts, faint radar grid, teal routes, brass confirmations, and enough restraint to stay usable all day.',
    radius: 'sharp',
    density: 'balanced',
    material: 'matte',
    motion: 'signal',
    texture: 'broadcast-grid',
    control: 'console-cut',
    depth: 'flat',
    rhythm: 'operator',
    preview: { canvas: '#0c0e12', surface: '#181c28', accent: '#3dc9c4', decision: '#c9a03a', danger: '#e8603a' },
  },
  {
    id: 'operator-ember',
    label: 'Operator Ember',
    shortLabel: 'Ember',
    tone: 'warm',
    intent: 'Heat-map triage: burnt obsidian, amber routing, tactile keycaps.',
    description: 'A late-night incident desk with ember-black panels, diagonal heat routes, sunken keycap controls, and warmer pressure without going nightclub orange.',
    radius: 'sharp',
    density: 'compact',
    material: 'obsidian',
    motion: 'signal',
    texture: 'ember-routing',
    control: 'keycap',
    depth: 'inset',
    rhythm: 'instrument',
    preview: { canvas: '#110c0a', surface: '#241914', accent: '#ff9a5f', decision: '#f0bd58', danger: '#e65f4f' },
  },
  {
    id: 'oracle-teal',
    label: 'Oracle Teal',
    shortLabel: 'Oracle',
    tone: 'cool',
    intent: 'Deep observatory: spacious teal glass for reading and research.',
    description: 'Oceanic telescope room: low-glare teal panels, pill controls, aurora field texture, raised cards, and slower rhythm for long thinking passes.',
    radius: 'standard',
    density: 'spacious',
    material: 'matte',
    motion: 'calm',
    texture: 'oracle-field',
    control: 'pill-soft',
    depth: 'raised',
    rhythm: 'editorial',
    preview: { canvas: '#071112', surface: '#102124', accent: '#56eadf', decision: '#d9b66d', danger: '#f07050' },
  },
  {
    id: 'papyrus-dawn',
    label: 'Papyrus Dawn',
    shortLabel: 'Dawn',
    tone: 'light',
    intent: 'Aged-paper day mode: warm, muted, and no retina violence.',
    description: 'Tamed parchment desk with ink text, copper/teal marginalia, paper-tab controls, soft printed rules, and deliberately lower brightness than the previous dawn pass.',
    radius: 'standard',
    density: 'spacious',
    material: 'paper',
    motion: 'minimal',
    texture: 'paper-trace',
    control: 'paper-tab',
    depth: 'paper',
    rhythm: 'editorial',
    preview: { canvas: '#e2d2bd', surface: '#f1e3cf', accent: '#0a766f', decision: '#7b560e', danger: '#9f3a25' },
  },
  {
    id: 'sentry-high-contrast',
    label: 'Sentry Contrast',
    shortLabel: 'Sentry',
    tone: 'contrast',
    intent: 'Hard-read mode: stark contrast, scanlines, zero decoration debt.',
    description: 'Accessibility-first sentinel desk with near-black slabs, crisp white text, cyan focus, amber decisions, mono-block controls, and intentionally stripped atmosphere.',
    radius: 'sharp',
    density: 'compact',
    material: 'high-contrast',
    motion: 'minimal',
    texture: 'sentry-scan',
    control: 'mono-block',
    depth: 'wire',
    rhythm: 'terminal',
    preview: { canvas: '#030506', surface: '#0b1114', accent: '#00f5ff', decision: '#ffd166', danger: '#ff6b6b' },
  },
  {
    id: 'monoline-terminal',
    label: 'Monoline Terminal',
    shortLabel: 'Mono',
    tone: 'dark',
    intent: 'Brutalist terminal: graphite, white wireframes, no glow.',
    description: 'xAI-style monoline command room with square geometry, white-on-graphite rails, uppercase controls, scanline texture, and exactly one decorative trick: restraint.',
    radius: 'sharp',
    density: 'compact',
    material: 'matte',
    motion: 'minimal',
    texture: 'monoline-terminal',
    control: 'mono-block',
    depth: 'wire',
    rhythm: 'terminal',
    preview: { canvas: '#1f2228', surface: '#292d34', accent: '#ffffff', decision: '#b8c0cc', danger: '#ff8f8f' },
  },
  {
    id: 'glass-command',
    label: 'Glass Command',
    shortLabel: 'Glass',
    tone: 'cool',
    intent: 'Mac-native command palette: blue-black glass and soft lift.',
    description: 'Raycast/Linear-inspired glass cockpit with cool navy depth, soft luminous cards, pill controls, pane reflections, and presentation-friendly polish.',
    radius: 'soft',
    density: 'balanced',
    material: 'matte',
    motion: 'signal',
    texture: 'glass-command',
    control: 'pill-soft',
    depth: 'raised',
    rhythm: 'instrument',
    preview: { canvas: '#070b18', surface: '#121a32', accent: '#8fb8ff', decision: '#d2b5ff', danger: '#ff6f93' },
  },
  {
    id: 'greenroom-grid',
    label: 'Greenroom Grid',
    shortLabel: 'Greenroom',
    tone: 'cool',
    intent: 'Developer grid: emerald database room for systems work.',
    description: 'Supabase/Postgres-flavored integration console with black-green slabs, emerald identity lines, compact instrument rhythm, and border-defined depth.',
    radius: 'standard',
    density: 'compact',
    material: 'obsidian',
    motion: 'calm',
    texture: 'green-grid',
    control: 'keycap',
    depth: 'wire',
    rhythm: 'instrument',
    preview: { canvas: '#0f1714', surface: '#17211d', accent: '#3ecf8e', decision: '#a7d96d', danger: '#ff7a5f' },
  },
  {
    id: 'ivory-map',
    label: 'Ivory Map',
    shortLabel: 'Ivory',
    tone: 'light',
    intent: 'Field notebook: muted ivory mapping, not white SaaS glare.',
    description: 'Notion/field-map planning board with dulled ivory paper, slate-blue links, warm whisper borders, topographic traces, and roomy editorial spacing.',
    radius: 'soft',
    density: 'spacious',
    material: 'paper',
    motion: 'minimal',
    texture: 'ivory-map',
    control: 'paper-tab',
    depth: 'paper',
    rhythm: 'editorial',
    preview: { canvas: '#eee6d8', surface: '#f7f1e6', accent: '#315f86', decision: '#87642c', danger: '#9e4638' },
  },
  {
    id: 'violet-wiretap',
    label: 'Violet Wiretap',
    shortLabel: 'Wiretap',
    tone: 'dark',
    intent: 'Investigation mode: violet wire routes, cyan pings, anomaly pink.',
    description: 'Sentry-adjacent wiretap room with violet-black panels, magenta/cyan route overlays, compact comparison rhythm, and suspicious little anomaly markers.',
    radius: 'standard',
    density: 'balanced',
    material: 'obsidian',
    motion: 'signal',
    texture: 'violet-wires',
    control: 'console-cut',
    depth: 'inset',
    rhythm: 'operator',
    preview: { canvas: '#100b1f', surface: '#1a1330', accent: '#b79cff', decision: '#6ee7f9', danger: '#ff5fa2' },
  },
] as const satisfies readonly SignalTheme[];

export type SignalThemeId = (typeof SIGNAL_THEMES)[number]['id'];

export const SIGNAL_THEME_IDS = SIGNAL_THEMES.map((theme) => theme.id) as SignalThemeId[];
export const DEFAULT_SIGNAL_THEME: SignalThemeId = 'midnight-broadcast';

export function isSignalThemeId(value: string | null | undefined): value is SignalThemeId {
  return SIGNAL_THEME_IDS.includes(value as SignalThemeId);
}

export function getSignalTheme(themeId: SignalThemeId): SignalTheme {
  return SIGNAL_THEMES.find((theme) => theme.id === themeId) ?? SIGNAL_THEMES[0];
}

export function applySignalTheme(themeId: SignalThemeId) {
  if (typeof document === 'undefined') return;
  const theme = getSignalTheme(themeId);
  document.documentElement.dataset.signalTheme = theme.id;
  document.documentElement.dataset.signalTone = theme.tone;
  document.documentElement.dataset.signalRadius = theme.radius;
  document.documentElement.dataset.signalDensity = theme.density;
  document.documentElement.dataset.signalMaterial = theme.material;
  document.documentElement.dataset.signalMotion = theme.motion;
  document.documentElement.dataset.signalTexture = theme.texture;
  document.documentElement.dataset.signalControl = theme.control;
  document.documentElement.dataset.signalDepth = theme.depth;
  document.documentElement.dataset.signalRhythm = theme.rhythm;
  document.documentElement.style.colorScheme = theme.tone === 'light' ? 'light' : 'dark';
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

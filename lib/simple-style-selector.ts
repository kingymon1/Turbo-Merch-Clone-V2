/**
 * Simple Style Selector for Simple Autopilot
 *
 * Implements weighted random selection from evidence-backed design options.
 * - 70% chance: Evergreen (E) options - proven performers
 * - 30% chance: Emerging (M) options - trending styles
 *
 * Reference: /docs/simple-style-selector.md
 */

// Mood Options (for user selection)
export const MOOD_OPTIONS = [
  'Funny',
  'Inspirational',
  'Sarcastic',
  'Wholesome',
  'Edgy',
  'Proud',
  'Nostalgic',
  'Rebellious',
] as const;

// Typography Styles
export const TYPOGRAPHY_EVERGREEN = [
  'Bold condensed sans (all caps)',
  'Wide bold sans (headline style)',
  'Rounded sans (friendly/soft humor)',
  'Classic collegiate/varsity slab serif',
  'Script headline + small caps subline',
  'Stacked mixed-weight block text',
  'Outline + fill mix (inline/knockout)',
  'Gothic/blackletter',
];

export const TYPOGRAPHY_EMERGING = [
  'Minimal narrow grotesk (small caps)',
  '3D/puff/extruded display type',
];

// Visual Effects
export const EFFECT_EVERGREEN = [
  'No-effect high contrast (pure white or light color)',
  'Mild distressed/grunge texture on type',
  'Vintage sunset/horizon shapes',
  'Halftone shading',
  'Flat silhouettes + 1-2 accent colors',
  'Circular/shield badge framing',
];

export const EFFECT_EMERGING = [
  'Neon glow/outer glow outlines',
  'Glitch/scanline/CRT texture',
  'High-contrast color blocking/stripes',
  'Faux vintage wash/faded ink',
];

// Aesthetic Categories
export const AESTHETIC_EVERGREEN = [
  'Retro/nostalgia (70s-Y2K)',
  'Funny/relatable text',
  'Minimalist/clean branding',
  'Streetwear/bold graphic',
  'Outdoors/adventure/national parks',
  'Anime/manga/K-pop inspired',
];

export const AESTHETIC_EMERGING = [
  'Cottagecore/nature romanticism',
  'Whimsigothic/occult-cute',
  'AI/cyber/tech aesthetics',
  'Hyper-personalized identity tees',
];

/**
 * Weighted random selection: 70% Evergreen, 30% Emerging
 */
function selectFromPool<T>(evergreen: T[], emerging: T[]): T {
  const useEvergreen = Math.random() < 0.7;
  const pool = useEvergreen ? evergreen : emerging;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Select a random typography style
 */
export function selectTypography(): string {
  return selectFromPool(TYPOGRAPHY_EVERGREEN, TYPOGRAPHY_EMERGING);
}

/**
 * Select a random visual effect
 */
export function selectEffect(): string {
  return selectFromPool(EFFECT_EVERGREEN, EFFECT_EMERGING);
}

/**
 * Select a random aesthetic category
 */
export function selectAesthetic(): string {
  return selectFromPool(AESTHETIC_EVERGREEN, AESTHETIC_EMERGING);
}

/**
 * Select all three style components at once
 */
export function selectAllStyles(): {
  typography: string;
  effect: string;
  aesthetic: string;
} {
  return {
    typography: selectTypography(),
    effect: selectEffect(),
    aesthetic: selectAesthetic(),
  };
}

/**
 * Build the final image prompt from all components
 * Simplified: single phrase, no forced positioning, bold effects
 */
export function buildImagePrompt(params: {
  typography: string;
  effect: string;
  aesthetic: string;
  textTop: string;
  textBottom?: string; // Now optional, not used in prompt
  imageDescription: string;
}): string {
  const { typography, effect, aesthetic, textTop, imageDescription } = params;

  return `${typography} t-shirt design (no mockup) featuring '${textTop}'. ${aesthetic} style with bold ${effect} effects. Add ${imageDescription}. 4500x5400px, black shirt.`;
}

/**
 * Get all typography options (evergreen + emerging) for UI dropdowns
 */
export function getAllTypographyOptions(): string[] {
  return [...TYPOGRAPHY_EVERGREEN, ...TYPOGRAPHY_EMERGING];
}

/**
 * Get all effect options (evergreen + emerging) for UI dropdowns
 */
export function getAllEffectOptions(): string[] {
  return [...EFFECT_EVERGREEN, ...EFFECT_EMERGING];
}

/**
 * Get all aesthetic options (evergreen + emerging) for UI dropdowns
 */
export function getAllAestheticOptions(): string[] {
  return [...AESTHETIC_EVERGREEN, ...AESTHETIC_EMERGING];
}

/**
 * Get all mood options for UI dropdowns
 */
export function getAllMoodOptions(): readonly string[] {
  return MOOD_OPTIONS;
}

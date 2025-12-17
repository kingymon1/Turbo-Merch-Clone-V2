/**
 * Simple Style Selector for Simple Autopilot
 *
 * Implements weighted random selection from evidence-backed design options.
 * - 70% chance: Evergreen (E) options - proven performers
 * - 30% chance: Emerging (M) options - trending styles
 *
 * Reference: /docs/simple-style-selector.md
 */

// Typography Styles
const TYPOGRAPHY_EVERGREEN = [
  'Bold condensed sans (all caps)',
  'Wide bold sans (headline style)',
  'Rounded sans (friendly/soft humor)',
  'Classic collegiate/varsity slab serif',
  'Script headline + small caps subline',
  'Stacked mixed-weight block text',
  'Outline + fill mix (inline/knockout)',
  'Gothic/blackletter',
];

const TYPOGRAPHY_EMERGING = [
  'Minimal narrow grotesk (small caps)',
  '3D/puff/extruded display type',
];

// Visual Effects
const EFFECT_EVERGREEN = [
  'No-effect high contrast (pure white or light color)',
  'Mild distressed/grunge texture on type',
  'Vintage sunset/horizon shapes',
  'Halftone shading',
  'Flat silhouettes + 1-2 accent colors',
  'Circular/shield badge framing',
];

const EFFECT_EMERGING = [
  'Neon glow/outer glow outlines',
  'Glitch/scanline/CRT texture',
  'High-contrast color blocking/stripes',
  'Faux vintage wash/faded ink',
];

// Aesthetic Categories
const AESTHETIC_EVERGREEN = [
  'Retro/nostalgia (70s-Y2K)',
  'Funny/relatable text',
  'Minimalist/clean branding',
  'Streetwear/bold graphic',
  'Outdoors/adventure/national parks',
  'Anime/manga/K-pop inspired',
];

const AESTHETIC_EMERGING = [
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
 */
export function buildImagePrompt(params: {
  typography: string;
  effect: string;
  aesthetic: string;
  textTop: string;
  textBottom: string;
  imageDescription: string;
}): string {
  const { typography, effect, aesthetic, textTop, textBottom, imageDescription } = params;

  return `${typography} t-shirt design (no mockup) ${effect} style typography with the words '${textTop}' at the top and '${textBottom}' at the bottom. Make it in a ${aesthetic} style using big typography and ${effect} effects. Add ${imageDescription} in the middle of the design. 4500x5400px use all the canvas. Make it for a black shirt.`;
}

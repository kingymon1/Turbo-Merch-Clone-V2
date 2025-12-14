/**
 * Style Intelligence Types
 *
 * TypeScript types for the Style Miner system.
 * These types define the structure of style knowledge extracted from design guides,
 * template galleries, and market examples.
 *
 * Follows repo conventions: camelCase properties, optional fields for flexibility.
 */

// =============================================================================
// STYLE RECIPE (Complete Design Direction)
// =============================================================================

/**
 * Typography specification for a style recipe
 */
export interface TypographyStyle {
  /** Primary font category: 'serif' | 'sans-serif' | 'script' | 'display' | 'monospace' */
  fontCategory: string;
  /** Font weight guidance: 'light' | 'regular' | 'medium' | 'bold' | 'black' */
  fontWeight: string;
  /** Suggested font families (not specific fonts, but styles) */
  fontFamilySuggestions?: string[];
  /** Letter spacing: 'tight' | 'normal' | 'wide' | 'extra-wide' */
  letterSpacing?: string;
  /** Text transform: 'uppercase' | 'lowercase' | 'capitalize' | 'mixed' */
  textTransform?: string;
  /** Line height: 'tight' | 'normal' | 'relaxed' */
  lineHeight?: string;
  /** Text alignment: 'left' | 'center' | 'right' | 'justified' */
  alignment?: string;
  /** Max recommended word count for primary text */
  maxWordCount?: number;
}

/**
 * Layout composition for a style recipe
 */
export interface LayoutStyle {
  /** Overall composition: 'centered' | 'asymmetric' | 'stacked' | 'diagonal' | 'circular' */
  composition: string;
  /** Text positioning: 'top' | 'center' | 'bottom' | 'split' */
  textPlacement: string;
  /** Hierarchy type: 'single-line' | 'two-line' | 'three-line' | 'badge' | 'emblem' */
  hierarchyType?: string;
  /** White space usage: 'minimal' | 'balanced' | 'generous' */
  whiteSpace?: string;
  /** Visual weight distribution: 'top-heavy' | 'bottom-heavy' | 'balanced' | 'asymmetric' */
  visualWeight?: string;
  /** Icon/graphic integration: 'none' | 'accent' | 'supporting' | 'dominant' */
  iconUsage?: string;
  /** Icon style when present */
  iconStyle?: string;
}

/**
 * Color palette guidance for a style recipe
 */
export interface ColorStyle {
  /** Color scheme type: 'monochromatic' | 'complementary' | 'analogous' | 'triadic' | 'high-contrast' */
  schemeType: string;
  /** Primary color suggestions (color families, not hex codes) */
  primaryColors?: string[];
  /** Accent color suggestions */
  accentColors?: string[];
  /** Recommended shirt colors this works on */
  recommendedGarmentColors?: string[];
  /** Contrast requirements: 'high' | 'medium' | 'low' */
  contrastLevel?: string;
  /** Color mood: 'warm' | 'cool' | 'neutral' | 'vibrant' | 'muted' */
  colorMood?: string;
}

/**
 * Visual effects that can be applied to a design
 */
export interface DesignEffects {
  /** Halftone effect usage */
  halftone?: {
    enabled: boolean;
    style?: 'dots' | 'lines' | 'crosshatch';
    density?: 'light' | 'medium' | 'heavy';
  };
  /** Gradient effect usage */
  gradient?: {
    enabled: boolean;
    type?: 'linear' | 'radial' | 'angular';
    subtlety?: 'subtle' | 'moderate' | 'dramatic';
  };
  /** Text outline/stroke */
  outline?: {
    enabled: boolean;
    weight?: 'thin' | 'medium' | 'thick';
    style?: 'solid' | 'double';
  };
  /** Texture overlay */
  texture?: {
    enabled: boolean;
    type?: 'distressed' | 'grain' | 'noise' | 'fabric' | 'paper';
    intensity?: 'subtle' | 'moderate' | 'heavy';
  };
  /** Drop shadow or depth effects */
  shadow?: {
    enabled: boolean;
    type?: 'drop' | 'inner' | '3d' | 'long';
    intensity?: 'subtle' | 'moderate' | 'dramatic';
  };
  /** Vintage/distressed aging effects */
  aging?: {
    enabled: boolean;
    style?: 'worn' | 'faded' | 'cracked' | 'scratched';
  };
}

/**
 * Imagery guidance for when graphics are included
 */
export interface ImageryStyle {
  /** Illustration style: 'line-art' | 'flat' | 'detailed' | 'hand-drawn' | 'photographic' */
  illustrationStyle?: string;
  /** Icon style: 'outlined' | 'filled' | 'detailed' | 'minimal' */
  iconStyle?: string;
  /** Subject positioning: 'centered' | 'left' | 'right' | 'background' */
  subjectPlacement?: string;
  /** Level of detail: 'minimal' | 'moderate' | 'detailed' */
  detailLevel?: string;
}

/**
 * Print-specific constraints and recommendations
 */
export interface PrintConstraints {
  /** Maximum recommended colors for cost-effective printing */
  maxColors?: number;
  /** Minimum text size (points) for readability */
  minTextSize?: number;
  /** Recommended print area size: 'small' | 'medium' | 'large' | 'full-front' */
  printAreaSize?: string;
  /** Print technique considerations: 'screen-print-friendly' | 'dtg-preferred' | 'either' */
  printTechnique?: string;
}

/**
 * Metadata about a style recipe
 */
export interface RecipeMeta {
  /** Unique identifier for this recipe */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** Style category */
  category: string;
  /** Niche hints - niches this recipe works well for */
  nicheHints: string[];
  /** Tone keywords */
  tone: string[];
  /** Complexity level: 'simple' | 'moderate' | 'complex' */
  complexity: 'simple' | 'moderate' | 'complex';
  /** Brief description */
  description?: string;
}

/**
 * Complete style recipe - a reusable design direction
 */
export interface StyleRecipe {
  meta: RecipeMeta;
  typography: TypographyStyle;
  layout: LayoutStyle;
  color: ColorStyle;
  effects: DesignEffects;
  imagery?: ImageryStyle;
  printConstraints?: PrintConstraints;
}

// =============================================================================
// STYLE PRINCIPLE (Contextual Design Rules)
// =============================================================================

/**
 * Context in which a principle applies
 */
export interface PrincipleContext {
  /** Text length this applies to: 'short' (1-3 words) | 'medium' (4-6 words) | 'long' (7+ words) */
  textLength?: 'short' | 'medium' | 'long' | 'any';
  /** Garment colors this applies to */
  garmentColors?: string[];
  /** Niche risk level: 'low' (evergreen) | 'medium' (trending) | 'high' (moonshot) */
  nicheRisk?: 'low' | 'medium' | 'high' | 'any';
  /** Specific niches this applies to */
  niches?: string[];
  /** Design complexity */
  complexity?: 'simple' | 'moderate' | 'complex' | 'any';
}

/**
 * Recommendations within a principle
 */
export interface PrincipleRecommendations {
  /** Typography recommendations */
  typography?: Partial<TypographyStyle>;
  /** Layout recommendations */
  layout?: Partial<LayoutStyle>;
  /** Color recommendations */
  color?: Partial<ColorStyle>;
  /** Effects recommendations */
  effects?: Partial<DesignEffects>;
  /** General do's */
  dos?: string[];
  /** General don'ts */
  donts?: string[];
  /** Priority level: how important is this principle */
  priority?: 'critical' | 'important' | 'suggested';
}

/**
 * A design principle - contextual rule extracted from authoritative sources
 */
export interface StylePrinciple {
  /** Stable identifier (e.g., "contrast-readability-rule") */
  id: string;
  /** Context when this principle applies */
  context: PrincipleContext;
  /** What to do in this context */
  recommendations: PrincipleRecommendations;
  /** Why this principle matters */
  rationale?: string;
  /** URLs that support this principle */
  sourceReferences: string[];
}

// =============================================================================
// MINING RESULT TYPES
// =============================================================================

/**
 * Result from mining a single URL
 */
export interface MiningResult {
  /** Recipes extracted from this URL */
  recipes: StyleRecipe[];
  /** Principles extracted from this URL */
  principles: StylePrinciple[];
}

/**
 * Result from the LLM mining call
 */
export interface LLMMiningResponse {
  recipes: StyleRecipe[];
  principles: StylePrinciple[];
}

// =============================================================================
// SOURCE CONFIGURATION TYPES
// =============================================================================

/**
 * Source groups configuration
 */
export interface StyleIntelSources {
  /** URLs to design guide articles */
  design_guides: string[];
  /** URLs to template gallery pages */
  template_galleries: string[];
  /** URLs to inspiration gallery pages */
  inspiration_galleries: string[];
  /** URLs to market example pages (Amazon, Etsy searches) */
  market_examples: string[];
}

/**
 * Valid source group names
 */
export type SourceGroup = keyof StyleIntelSources;

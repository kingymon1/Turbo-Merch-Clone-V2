# Image Quality Overhaul - Implementation Plan

## Problem Statement

The current merch generator produces lower quality images than direct model prompts because:
1. **Over-engineered prompts**: 5+ transformation layers bloat 26-word prompts into 1200+ words
2. **Conflicting instructions**: Different layers give contradictory style guidance
3. **Risk level degrades quality**: Higher risk = lower confidence thresholds = worse prompts
4. **Manual mode outperforms autopilot**: Simpler path = better results

## Solution: Form-Based Architecture

Instead of complex prompt engineering, the AI fills a simple form (like a human would in manual mode), with strict character limits forcing brevity and clarity.

**Working reference prompt (26 words):**
```
a t-shirt design on black background. Ugly Christmas style. The text 'Chillin' With My Snowmies' featuring 3 snowmen enjoying a winter scene. No Mockup
```

---

## Agreed Decisions

| Decision | Choice |
|----------|--------|
| Form-filling model | GPT-4.1-nano ($0.10/1M tokens) |
| Form type | Universal with optional model overrides |
| Style database | Both (cron for top niches + on-demand for long-tail) |
| "No text" option | Allowed as explicit design choice |
| Character limits | Aggressive (total ~200 chars) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: RESEARCH (existing agents - unchanged)                 │
│ Grok, Perplexity, Brave, Google agents                          │
│ Output: TrendData { phrase, niche, audience, visualHints... }   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: STYLE CONTEXT (new)                                    │
│ Fetch from NicheStyleProfile database                           │
│ If missing → trigger on-demand research                         │
│ Output: StyleContext { typography, colors, aesthetic }          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: FORM-FILLING (new - GPT-4.1-nano)                      │
│ Input: TrendData + StyleContext + RiskLevel                     │
│ Output: DesignForm (6 fields, ~200 chars total)                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: PROMPT BUILDING (new - simplified)                     │
│ Input: DesignForm                                               │
│ Output: Clean prompt (~40-60 words)                             │
│ Template-based, no AI, deterministic                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: IMAGE GENERATION (existing - unchanged)                │
│ GPT Image 1, Ideogram, Imagen 4, DALL-E 3                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. DesignForm Interface

**File:** `lib/merch/types.ts`

```typescript
/**
 * The form that AI fills to create a design.
 * Character limits enforce brevity.
 * This replaces complex DesignBrief for prompt generation.
 */
export interface DesignForm {
  // Text to render (null = no text, explicit design choice)
  exactText: string | null;           // max 40 chars (~6 words)

  // Visual style
  style: string;                      // max 25 chars (e.g., "Ugly Christmas")

  // Optional visual element
  imageFeature: string | null;        // max 50 chars (e.g., "3 snowmen in winter scene")

  // Context
  niche: string;                      // max 15 chars (e.g., "christmas")
  tone: string;                       // max 10 chars (e.g., "funny")

  // Technical/additional
  additionalInstructions: string | null; // max 60 chars (e.g., "on black background")

  // Model-specific overrides (optional)
  modelOverrides?: {
    ideogram?: {
      styleType?: 'DESIGN' | 'GENERAL' | 'REALISTIC';
      magicPrompt?: 'ON' | 'OFF';
    };
    gptImage?: {
      background?: 'black' | 'white' | 'transparent';
    };
  };
}

// Character limits constant
export const DESIGN_FORM_LIMITS = {
  exactText: 40,
  style: 25,
  imageFeature: 50,
  niche: 15,
  tone: 10,
  additionalInstructions: 60,
} as const;
```

### 2. Form-Filling Service

**File:** `lib/merch/form-filler.ts` (new)

```typescript
/**
 * Uses GPT-4.1-nano to fill the DesignForm from research data.
 * Forces structured decisions with character limits.
 */

import OpenAI from 'openai';
import { DesignForm, DESIGN_FORM_LIMITS } from './types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface FormFillerInput {
  // From research phase
  trendData: {
    phrase?: string;
    topic?: string;
    niche?: string;
    audienceProfile?: string;
    visualStyle?: string;
    sentiment?: string;
  };

  // From style database
  styleContext?: {
    dominantTypography?: string;
    colorPalette?: string[];
    moodAesthetic?: string;
  };

  // User settings
  riskLevel: number;  // 0-100 (affects idea selection, not quality)
}

export async function fillDesignForm(input: FormFillerInput): Promise<DesignForm> {
  const { trendData, styleContext, riskLevel } = input;

  const systemPrompt = `You are a t-shirt design decision maker.
Fill out a design form based on the research data provided.

CRITICAL RULES:
1. Be CONCISE. Every character counts.
2. Respect character limits EXACTLY.
3. Make DECISIONS, don't hedge or explain.
4. exactText can be null if design works better without text.
5. style should be 1-3 descriptive words max.
6. imageFeature describes ONE visual element, not a scene description.

Risk level ${riskLevel}/100 means:
- 0-30: Safe, proven ideas with existing market
- 30-70: Balanced, some creativity allowed
- 70-100: Experimental, first-mover opportunities

Higher risk = more creative/novel choices, NOT lower quality.`;

  const userPrompt = `Research data:
${JSON.stringify(trendData, null, 2)}

${styleContext ? `Style context from database:
${JSON.stringify(styleContext, null, 2)}` : 'No style context available.'}

Fill the design form. Return ONLY valid JSON matching the schema.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-nano',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'design_form',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            exactText: {
              type: ['string', 'null'],
              description: `Text to display (max ${DESIGN_FORM_LIMITS.exactText} chars) or null for no text`
            },
            style: {
              type: 'string',
              description: `Visual style in 1-3 words (max ${DESIGN_FORM_LIMITS.style} chars)`
            },
            imageFeature: {
              type: ['string', 'null'],
              description: `One visual element (max ${DESIGN_FORM_LIMITS.imageFeature} chars) or null`
            },
            niche: {
              type: 'string',
              description: `Target niche (max ${DESIGN_FORM_LIMITS.niche} chars)`
            },
            tone: {
              type: 'string',
              description: `Emotional tone (max ${DESIGN_FORM_LIMITS.tone} chars)`
            },
            additionalInstructions: {
              type: ['string', 'null'],
              description: `Technical notes (max ${DESIGN_FORM_LIMITS.additionalInstructions} chars) or null`
            }
          },
          required: ['exactText', 'style', 'imageFeature', 'niche', 'tone', 'additionalInstructions'],
          additionalProperties: false
        }
      }
    },
    temperature: 0.7,
    max_tokens: 300,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('Empty response from form filler');

  const form = JSON.parse(content) as DesignForm;

  // Enforce character limits (truncate if model exceeded)
  return enforceCharacterLimits(form);
}

function enforceCharacterLimits(form: DesignForm): DesignForm {
  return {
    exactText: form.exactText?.slice(0, DESIGN_FORM_LIMITS.exactText) ?? null,
    style: form.style.slice(0, DESIGN_FORM_LIMITS.style),
    imageFeature: form.imageFeature?.slice(0, DESIGN_FORM_LIMITS.imageFeature) ?? null,
    niche: form.niche.slice(0, DESIGN_FORM_LIMITS.niche),
    tone: form.tone.slice(0, DESIGN_FORM_LIMITS.tone),
    additionalInstructions: form.additionalInstructions?.slice(0, DESIGN_FORM_LIMITS.additionalInstructions) ?? null,
  };
}
```

### 3. Simplified Prompt Builder

**File:** `lib/merch/simple-prompt-builder.ts` (new)

```typescript
/**
 * Builds clean, short prompts from DesignForm.
 * No AI involved - pure template-based construction.
 * Target: 40-60 words, like the working reference prompt.
 */

import { DesignForm } from './types';

interface PromptOptions {
  targetModel?: 'gpt-image-1' | 'ideogram' | 'imagen' | 'dalle3';
}

export function buildSimplePrompt(form: DesignForm, options: PromptOptions = {}): string {
  const { targetModel = 'gpt-image-1' } = options;

  const parts: string[] = [];

  // Start with base
  parts.push('a t-shirt design');

  // Background (from additionalInstructions or default)
  const bgMatch = form.additionalInstructions?.match(/on (black|white|transparent) background/i);
  if (bgMatch) {
    parts.push(`on ${bgMatch[1]} background`);
  } else {
    parts.push('on black background');
  }

  // Style
  if (form.style) {
    parts.push(`${form.style} style`);
  }

  // Text (if present)
  if (form.exactText) {
    parts.push(`The text '${form.exactText}'`);
  }

  // Image feature (if present)
  if (form.imageFeature) {
    parts.push(`featuring ${form.imageFeature}`);
  }

  // Additional instructions (excluding background which we handled)
  if (form.additionalInstructions) {
    const cleanedInstructions = form.additionalInstructions
      .replace(/on (black|white|transparent) background/gi, '')
      .trim();
    if (cleanedInstructions) {
      parts.push(cleanedInstructions);
    }
  }

  // End with "No Mockup" to prevent t-shirt renders
  parts.push('No Mockup');

  return parts.filter(p => p).join('. ').replace(/\.\./g, '.').trim();
}

/**
 * Build prompt with model-specific adjustments
 */
export function buildModelSpecificPrompt(
  form: DesignForm,
  model: 'gpt-image-1' | 'ideogram' | 'imagen' | 'dalle3'
): string {
  const basePrompt = buildSimplePrompt(form, { targetModel: model });

  // Model-specific adjustments
  switch (model) {
    case 'ideogram':
      // Ideogram excels with explicit text instruction
      if (form.exactText) {
        return basePrompt.replace(
          `The text '${form.exactText}'`,
          `with bold readable text that says "${form.exactText}"`
        );
      }
      return basePrompt;

    case 'gpt-image-1':
      // GPT Image handles text well, can request transparency
      if (form.modelOverrides?.gptImage?.background === 'transparent') {
        return basePrompt.replace('on black background', 'on transparent background');
      }
      return basePrompt;

    case 'dalle3':
      // DALL-E benefits from slightly more descriptive style
      return basePrompt;

    case 'imagen':
    default:
      return basePrompt;
  }
}
```

### 4. Style Research Operations

**File:** `lib/merch/style-research.ts` (new)

```typescript
/**
 * Populates NicheStyleProfile database with style intelligence.
 * Two modes: cron (bulk) and on-demand (single niche).
 */

import { prisma } from '@/lib/prisma';

// Top niches for cron job (expand as needed)
export const TOP_NICHES = [
  'fishing', 'nurse', 'teacher', 'mom', 'dad', 'grandma', 'grandpa',
  'dog lover', 'cat lover', 'coffee', 'beer', 'camping', 'hiking',
  'golf', 'basketball', 'football', 'baseball', 'soccer',
  'christmas', 'halloween', 'valentines', 'easter',
  'birthday', 'retirement', 'graduation',
  'engineer', 'programmer', 'accountant', 'lawyer', 'doctor',
  'truck driver', 'construction', 'electrician', 'plumber',
  'veteran', 'military', 'firefighter', 'police',
  'yoga', 'gym', 'running', 'cycling',
  'gaming', 'anime', 'music', 'art',
];

interface StyleResearchResult {
  niche: string;
  dominantTypography: {
    primary: string;
    secondary?: string;
    examples: string[];
  };
  colorPalette: {
    primary: string[];
    accent: string[];
    background: string[];
  };
  layoutPatterns: {
    dominant: string;
    alternatives: string[];
    textPlacement: string;
    iconUsage: 'common' | 'rare' | 'none';
  };
  moodAesthetic: {
    primary: string;
    secondary?: string;
    avoid: string[];
  };
  confidence: number;
  sampleSize: number;
}

/**
 * Research style for a single niche using web search + vision analysis
 */
export async function researchNicheStyle(niche: string): Promise<StyleResearchResult> {
  // Step 1: Web search for current trends
  const webResults = await searchStyleTrends(niche);

  // Step 2: Analyze actual MBA product images (if available)
  const imageAnalysis = await analyzeMarketplaceImages(niche);

  // Step 3: Synthesize into style profile
  const profile = await synthesizeStyleProfile(niche, webResults, imageAnalysis);

  return profile;
}

/**
 * Save style profile to database
 */
export async function saveStyleProfile(result: StyleResearchResult): Promise<void> {
  await prisma.nicheStyleProfile.upsert({
    where: { niche: result.niche },
    update: {
      dominantTypography: result.dominantTypography,
      colorPalette: result.colorPalette,
      layoutPatterns: result.layoutPatterns,
      moodAesthetic: result.moodAesthetic,
      confidence: result.confidence,
      sampleSize: result.sampleSize,
      lastAnalyzed: new Date(),
    },
    create: {
      niche: result.niche,
      dominantTypography: result.dominantTypography,
      colorPalette: result.colorPalette,
      layoutPatterns: result.layoutPatterns,
      moodAesthetic: result.moodAesthetic,
      confidence: result.confidence,
      sampleSize: result.sampleSize,
      lastAnalyzed: new Date(),
    },
  });
}

/**
 * Get style context for form-filler (fast database lookup)
 */
export async function getStyleContext(niche: string): Promise<{
  dominantTypography?: string;
  colorPalette?: string[];
  moodAesthetic?: string;
} | null> {
  const profile = await prisma.nicheStyleProfile.findUnique({
    where: { niche },
  });

  if (!profile) return null;

  // Check freshness (older than 7 days = stale)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (profile.lastAnalyzed < weekAgo) {
    // Trigger background refresh (non-blocking)
    refreshStyleProfile(niche).catch(console.error);
  }

  return {
    dominantTypography: (profile.dominantTypography as any)?.primary,
    colorPalette: (profile.colorPalette as any)?.primary,
    moodAesthetic: (profile.moodAesthetic as any)?.primary,
  };
}

/**
 * On-demand: Research if not in database
 */
export async function getOrResearchStyleContext(niche: string): Promise<{
  dominantTypography?: string;
  colorPalette?: string[];
  moodAesthetic?: string;
}> {
  const existing = await getStyleContext(niche);
  if (existing) return existing;

  // Not found - do on-demand research
  console.log(`[StyleResearch] On-demand research for: ${niche}`);
  const result = await researchNicheStyle(niche);
  await saveStyleProfile(result);

  return {
    dominantTypography: result.dominantTypography.primary,
    colorPalette: result.colorPalette.primary,
    moodAesthetic: result.moodAesthetic.primary,
  };
}

// Background refresh (fire-and-forget)
async function refreshStyleProfile(niche: string): Promise<void> {
  const result = await researchNicheStyle(niche);
  await saveStyleProfile(result);
}

// Placeholder implementations (to be filled in)
async function searchStyleTrends(niche: string): Promise<any> {
  // Use Perplexity or Grok web search
  // Search: "[niche] t-shirt design trends 2025"
  return {};
}

async function analyzeMarketplaceImages(niche: string): Promise<any> {
  // Use Claude Vision to analyze top MBA products
  return {};
}

async function synthesizeStyleProfile(
  niche: string,
  webResults: any,
  imageAnalysis: any
): Promise<StyleResearchResult> {
  // Combine web + image data into profile
  return {
    niche,
    dominantTypography: { primary: 'bold sans-serif', examples: [] },
    colorPalette: { primary: [], accent: [], background: [] },
    layoutPatterns: { dominant: 'centered', alternatives: [], textPlacement: 'center', iconUsage: 'common' },
    moodAesthetic: { primary: 'fun', avoid: [] },
    confidence: 0.7,
    sampleSize: 0,
  };
}
```

### 5. Cron Job for Style Population

**File:** `app/api/cron/style-research/route.ts` (new)

```typescript
/**
 * Cron job to populate style database for top niches.
 * Run daily or weekly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TOP_NICHES, researchNicheStyle, saveStyleProfile } from '@/lib/merch/style-research';

export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[StyleCron] Starting style research for ${TOP_NICHES.length} niches`);

  const results: { niche: string; success: boolean; error?: string }[] = [];

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < TOP_NICHES.length; i += batchSize) {
    const batch = TOP_NICHES.slice(i, i + batchSize);

    await Promise.all(batch.map(async (niche) => {
      try {
        const profile = await researchNicheStyle(niche);
        await saveStyleProfile(profile);
        results.push({ niche, success: true });
        console.log(`[StyleCron] ✓ ${niche}`);
      } catch (error) {
        results.push({ niche, success: false, error: String(error) });
        console.error(`[StyleCron] ✗ ${niche}:`, error);
      }
    }));

    // Small delay between batches
    if (i + batchSize < TOP_NICHES.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`[StyleCron] Complete: ${successCount}/${TOP_NICHES.length} succeeded`);

  return NextResponse.json({
    success: true,
    total: TOP_NICHES.length,
    succeeded: successCount,
    failed: TOP_NICHES.length - successCount,
    results,
  });
}
```

### 6. Updated Autopilot Flow

**File:** `lib/merch/autopilot-generator.ts` (modify)

```typescript
// Key changes to generateAutopilotConcept():

export async function generateAutopilotConcept(
  riskLevel: number,
  userId: string
): Promise<AutopilotResult> {

  // EXISTING: Research phase (unchanged)
  const trendData = await searchTrends(riskLevel, userId);

  // NEW: Get style context from database
  const styleContext = await getOrResearchStyleContext(trendData.niche);

  // NEW: Fill design form using GPT-4.1-nano
  const designForm = await fillDesignForm({
    trendData,
    styleContext,
    riskLevel,
  });

  // NEW: Build simple prompt from form
  const imagePrompt = buildSimplePrompt(designForm);

  // Return result with new structure
  return {
    concept: {
      phrase: designForm.exactText || '',
      niche: designForm.niche,
      style: designForm.style,
      tone: designForm.tone,
    },
    designForm,      // NEW: Include filled form
    imagePrompt,     // NEW: Clean prompt ready for image gen
    trend: trendData,
    // ... existing fields
  };
}
```

### 7. Updated API Route

**File:** `app/api/merch/generate/route.ts` (modify)

```typescript
// Key changes:

// STEP 2: Skip complex DesignBrief system, use form directly
if (mode === 'autopilot') {
  const autopilotResult = await generateAutopilotConcept(riskLevel!, userId);

  // Use the pre-built simple prompt
  imagePrompt = autopilotResult.imagePrompt;
  designForm = autopilotResult.designForm;

} else if (mode === 'manual') {
  // Manual mode already works well - keep it similar
  // But use the same simple prompt builder for consistency
  designForm = specsToDesignForm(specs);
  imagePrompt = buildSimplePrompt(designForm);
}

// STEP 3: Generate image with simple prompt
const imageResult = await generateMerchImageFromPrompt(
  imagePrompt,
  imageModel as ImageModel
);
```

---

## Migration Strategy

### Phase 1: Foundation (Week 1)
1. Create `DesignForm` interface and constants
2. Create `form-filler.ts` with GPT-4.1-nano integration
3. Create `simple-prompt-builder.ts`
4. Unit tests for form-filling and prompt building

### Phase 2: Style Database (Week 1-2)
1. Create `style-research.ts` with placeholder implementations
2. Implement web search integration (Perplexity)
3. Implement image analysis (Claude Vision) - reuse existing
4. Create cron endpoint
5. Run initial population for top 50 niches

### Phase 3: Integration (Week 2)
1. Update `autopilot-generator.ts` to use new flow
2. Update API route to use simple prompts
3. Add A/B testing flag to compare old vs new
4. Manual testing with various niches and risk levels

### Phase 4: Validation & Rollout (Week 3)
1. Compare image quality: old system vs new system
2. Compare prompt lengths and clarity
3. Monitor API costs (should decrease)
4. Full rollout if quality improves

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Average prompt length | ~1200 words | ~50 words |
| Image quality (subjective) | Variable | Consistent |
| API cost per generation | Higher (multiple AI calls) | Lower (single GPT-nano call) |
| Manual vs Autopilot quality gap | Manual better | Parity |
| Time to generate | Slower | Faster |

---

## Files to Create

1. `lib/merch/types.ts` - Add DesignForm interface
2. `lib/merch/form-filler.ts` - GPT-4.1-nano form filling
3. `lib/merch/simple-prompt-builder.ts` - Template-based prompt construction
4. `lib/merch/style-research.ts` - Style database operations
5. `app/api/cron/style-research/route.ts` - Cron job

## Files to Modify

1. `lib/merch/autopilot-generator.ts` - Use new flow
2. `app/api/merch/generate/route.ts` - Use simple prompts
3. `lib/merch/image-generator.ts` - Accept simple prompts directly

## Files to Deprecate (after validation)

1. `lib/merch/design-executor.ts` - Complex Claude execution
2. `lib/merch/image-prompter.ts` - Legacy prompt building (keep for fallback)
3. Complex DesignBrief flow in `image-generator.ts`

---

## Risk Mitigation

1. **A/B Testing**: Keep old system available via flag
2. **Fallback**: If form-filling fails, fall back to legacy
3. **Gradual Rollout**: Start with 10% traffic, monitor quality
4. **Easy Revert**: Feature flag to disable new system entirely

---

## Questions Resolved

- ✅ Character limits: Aggressive (~200 chars total)
- ✅ Style options: Hybrid (database categories + freeform modifier)
- ✅ Risk level: Affects idea selection only, not quality
- ✅ Form-filler model: GPT-4.1-nano
- ✅ Style database: Both (cron + on-demand)
- ✅ Model forms: Universal with optional overrides
- ✅ "No text" option: Allowed as explicit choice

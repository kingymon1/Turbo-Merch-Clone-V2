# Plan: Optional User Inputs for Simple Autopilot

## Overview

Add optional input fields that give users control over the generation while maintaining simplicity. All fields are optional - when blank, autopilot runs as-is. When filled, they guide research and/or override discovered values.

---

## Design Principles

1. **All fields optional** - Clear instruction that autopilot works without any input
2. **Dropdowns + custom text** - Each dropdown has an "Other..." option revealing a text field
3. **Use existing options** - Pull from code's existing style arrays
4. **Prompt-ready format** - Store values in format the prompt expects (display can differ)
5. **Always visible** - No collapsible sections, advanced options shown inline
6. **Additional notes field** - Free-form text for anything not covered by specific fields

---

## Existing Style Options (from `lib/simple-style-selector.ts`)

### Typography (10 options)
**Evergreen:**
- Bold condensed sans (all caps)
- Wide bold sans (headline style)
- Rounded sans (friendly/soft humor)
- Classic collegiate/varsity slab serif
- Script headline + small caps subline
- Stacked mixed-weight block text
- Outline + fill mix (inline/knockout)
- Gothic/blackletter

**Emerging:**
- Minimal narrow grotesk (small caps)
- 3D/puff/extruded display type

### Effects (10 options)
**Evergreen:**
- No-effect high contrast (pure white or light color)
- Mild distressed/grunge texture on type
- Vintage sunset/horizon shapes
- Halftone shading
- Flat silhouettes + 1-2 accent colors
- Circular/shield badge framing

**Emerging:**
- Neon glow/outer glow outlines
- Glitch/scanline/CRT texture
- High-contrast color blocking/stripes
- Faux vintage wash/faded ink

### Aesthetics (10 options)
**Evergreen:**
- Retro/nostalgia (70s-Y2K)
- Funny/relatable text
- Minimalist/clean branding
- Streetwear/bold graphic
- Outdoors/adventure/national parks
- Anime/manga/K-pop inspired

**Emerging:**
- Cottagecore/nature romanticism
- Whimsigothic/occult-cute
- AI/cyber/tech aesthetics
- Hyper-personalized identity tees

### Mood Options (new, for dropdown)
- Funny
- Inspirational
- Sarcastic
- Wholesome
- Edgy
- Proud
- Nostalgic
- Rebellious

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Simple Autopilot                                                 │
│ Find trends, generate designs, create listings - all in one click│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ℹ️ All fields are optional. Leave everything blank for fully     │
│    automatic trend discovery and design generation.              │
│                                                                  │
│ ─── Basic ───                                                    │
│                                                                  │
│ Category / Niche     [________________]                          │
│                      e.g., "gaming", "dogs", "fitness"           │
│                                                                  │
│ Image Model          [Ideogram 3.0 ▼]                            │
│                                                                  │
│ ─── Content ───                                                  │
│                                                                  │
│ Phrase               [________________]                          │
│                      The main text on the shirt (2-6 words)      │
│                                                                  │
│ Mood                 [Auto ▼] [________________]                 │
│                      ↳ Shows text field when "Other..." selected │
│                                                                  │
│ Target Audience      [________________]                          │
│                      Who would buy this shirt?                   │
│                                                                  │
│ ─── Style ───                                                    │
│                                                                  │
│ Typography           [Auto ▼] [________________]                 │
│                                                                  │
│ Effect               [Auto ▼] [________________]                 │
│                                                                  │
│ Aesthetic            [Auto ▼] [________________]                 │
│                                                                  │
│ ─── Additional ───                                               │
│                                                                  │
│ Additional Notes     [                                    ]      │
│                      [                                    ]      │
│                      Any other details to guide the design       │
│                                                                  │
│              [✨ Start]                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dropdown + Custom Text Component

Each style dropdown follows this pattern:

```tsx
// Options: "Auto", ...existing options..., "Other..."
// When "Other..." selected, text field appears

[Auto ▼]                    // Default - random selection
[Bold condensed sans ▼]     // User picked specific option
[Other... ▼] [custom text]  // User typing custom value
```

**Internal value logic:**
- "Auto" → `undefined` (triggers random selection)
- Specific option → exact string from options array
- "Other..." → value from text field

---

## Files to Modify

### 1. `lib/simple-style-selector.ts`

**Changes:**
- Export all option arrays for UI consumption
- Add MOOD_OPTIONS array
- Add helper to get all options as dropdown-ready format

```typescript
// New exports
export const MOOD_OPTIONS = [
  'Funny',
  'Inspirational',
  'Sarcastic',
  'Wholesome',
  'Edgy',
  'Proud',
  'Nostalgic',
  'Rebellious',
];

export function getAllTypographyOptions(): string[] { ... }
export function getAllEffectOptions(): string[] { ... }
export function getAllAestheticOptions(): string[] { ... }
```

### 2. `app/api/simple-autopilot/route.ts`

**Changes:**
- Extend `SimpleAutopilotRequest` interface
- Modify research functions to use user hints
- Modify style selection to respect user overrides
- Pass additional notes to Gemini for imageDescription

```typescript
interface SimpleAutopilotRequest {
  // Existing
  category?: string;
  imageModel: ImageModel;

  // New - Content
  phrase?: string;           // Exact phrase (skips discovery if set)
  mood?: string;             // Tone hint for research
  audience?: string;         // Target demographic

  // New - Style overrides
  typography?: string;       // Override random selection
  effect?: string;           // Override random selection
  aesthetic?: string;        // Override random selection

  // New - Additional context
  additionalNotes?: string;  // Free-form guidance
}
```

### 3. `components/SimpleAutopilot.tsx`

**Changes:**
- Add new state for all optional fields
- Create reusable `DropdownWithCustom` component
- Import options from style-selector
- Add Additional Notes textarea
- Add section headers and instructions
- Fix existing SlotValues type mismatch
- Update request body

---

## Data Flow

```
User Inputs (all optional)
         ↓
┌────────────────────────────────────────────────────────────────┐
│ PHRASE provided?                                                │
│   YES → Use as textTop, skip phrase discovery                   │
│   NO  → Perplexity discovers phrase                             │
│                                                                 │
│ MOOD provided?                                                  │
│   YES → Inject into Perplexity system prompt as constraint      │
│   NO  → Perplexity determines mood                              │
│                                                                 │
│ AUDIENCE provided?                                              │
│   YES → Inject into research + Gemini prompts                   │
│   NO  → Perplexity determines audience                          │
│                                                                 │
│ TYPOGRAPHY/EFFECT/AESTHETIC provided?                           │
│   YES → Use directly, skip random selection for that field      │
│   NO  → Weighted random selection (70% evergreen / 30% emerging)│
│                                                                 │
│ ADDITIONAL NOTES provided?                                      │
│   YES → Append to Gemini prompt for imageDescription            │
│   NO  → Standard Gemini prompt                                  │
└────────────────────────────────────────────────────────────────┘
         ↓
Final prompt built with:
  - User values (priority)
  - Research/random values (fallback)
```

---

## Implementation Steps

1. **Update `lib/simple-style-selector.ts`**
   - Export existing arrays
   - Add MOOD_OPTIONS
   - Add getter functions for dropdown options

2. **Update API types and logic** (`app/api/simple-autopilot/route.ts`)
   - Extend request interface
   - Modify `findTrendingInNiche()` to accept mood/audience hints
   - Modify style selection to check for user overrides first
   - Pass additionalNotes to Gemini

3. **Create DropdownWithCustom component**
   - Reusable dropdown that shows text field for "Other..."
   - Handles internal value management

4. **Update UI** (`components/SimpleAutopilot.tsx`)
   - Add all new fields with sections
   - Import and use options from style-selector
   - Add instruction text at top
   - Fix SlotValues type mismatch

5. **Test combinations**
   - All blank (current behavior)
   - Only phrase set
   - Only styles set
   - Mix of inputs
   - Custom "Other..." values

---

## API Request Example

```json
{
  "category": "fishing",
  "imageModel": "ideogram",
  "phrase": "Reel Dad Energy",
  "mood": "Funny",
  "audience": "fishing dads",
  "typography": null,
  "effect": "Vintage sunset/horizon shapes",
  "aesthetic": null,
  "additionalNotes": "Include a bass fish jumping out of water"
}
```

This would:
- Use "Reel Dad Energy" as the phrase (skip discovery)
- Guide research with "Funny" mood and "fishing dads" audience
- Random typography selection
- Use "Vintage sunset/horizon shapes" effect
- Random aesthetic selection
- Include fish imagery in the Gemini prompt for imageDescription

# T-Shirt Design System Reference

## Overview

This document contains evidence-backed design options for the Simple Autopilot feature. All options are proven performers on POD platforms, sourced from marketplace data, seller analytics, and trend research. Designs are optimized for black shirts.

## Template Structure

```
[TYPOGRAPHY] t-shirt design (no mockup) [EFFECT] style typography with the words '[TEXT_TOP]' at the top and '[TEXT_BOTTOM]' at the bottom. Make it in a [AESTHETIC] style using big typography and [EFFECT] effects. Add [IMAGE_DESCRIPTION] in the middle of the design. 4500x5400px use all the canvas. Make it for a black shirt.
```

## Selection Logic

Selection happens in code, not by the LLM.

**Weighted random selection:**
- 70% chance: pick from Evergreen (E) options
- 30% chance: pick from Emerging (M) options

The code randomly selects one TYPOGRAPHY, one EFFECT, and one AESTHETIC, then passes these to the LLM along with the trend data.

**The LLM's only job is to derive:**
- TEXT_TOP (from trend, contextually relevant)
- TEXT_BOTTOM (from trend, contextually relevant - never generic phrases like "Trending Now")
- IMAGE_DESCRIPTION (brief, plain human language with uplift descriptors)

---

## Typography Styles

### Evergreen (E)

| Style | Why It Works |
|-------|--------------|
| Bold condensed sans (all caps) | High x-height and condensed width keep long phrases readable at thumbnail size. Pure white on black gives maximum contrast and "wear your comment" impact. |
| Wide bold sans (headline style) | Width plus weight fills the chest area, reads clearly from distance, and pairs well with simple icons or badges over black. |
| Rounded sans (friendly/soft humor) | Soft edges visually communicate "cute/non-threatening," aligning with mental health and cozy niches while staying legible in white or light pastel on black. |
| Classic collegiate/varsity slab serif | Instantly signals sports, school, and gym themes. Heavy slab shapes hold up in white or yellow ink against black and accept subtle distress well. |
| Script headline + small caps subline | Script carries personality for the core word (brand, emotion, drink), while small caps sans or serif subline provides clarity. |
| Stacked mixed-weight block text | Vertical stacking fits phone viewports, lets you emphasize the punchline word, and maintains readability at small size on black. |
| Outline + fill mix (inline/knockout) | Creates "double contrast" edge on black, improving legibility while adding visual interest without extra colors. |
| Gothic/blackletter | Inherently reads "dark/heavy/alternative," aligns with metal, occult, whimsigothic, and tattoo-inspired graphics on black. |

### Emerging (M)

| Style | Why It Works |
|-------|--------------|
| Minimal narrow grotesk (small caps) | Looks like a fashion label or tech brand mark. On black reads as "elevated basics," particularly in streetwear and tech niches. |
| 3D/puff/extruded display type | Faux depth or puff print shading creates a premium "drop" vibe and stands out strongly on black, especially in neon or pastel colorways. |

---

## Visual Effects

### Evergreen (E)

| Effect | Why It Works |
|--------|--------------|
| No-effect high contrast (pure white or light color) | Fastest to read, cheapest to print, most robust across niches. Ideal default. |
| Mild distressed/grunge texture on type | Suggests age and authenticity without hurting legibility. Worn ink look feels natural on black cotton. |
| Vintage sunset/horizon shapes | Instantly communicates "retro/outdoors vibe," adds color contrast against black, frames silhouettes cleanly. |
| Halftone shading | Adds depth and texture while keeping solid fills limited. Halftone highlights are particularly visible on black with bright inks. |
| Flat silhouettes + 1-2 accent colors | Works well with low color counts and DTG. Silhouettes read instantly and adapt to many niches. |
| Circular/shield badge framing | Gives structure and a natural "logo" look, centers well on the chest, encapsulates type + icon predictably. |

### Emerging (M)

| Effect | Why It Works |
|--------|--------------|
| Neon glow/outer glow outlines | Glow edges look striking on black. Slim colored glow around white type boosts perceived brightness and "tech/club" energy. |
| Glitch/scanline/CRT texture | Appeals to gamers, tech workers, cyber aesthetics. Glitch lines and RGB offsets read clearly on dark backgrounds. |
| High-contrast color blocking/stripes | Simple shapes in 2-3 colors create strong graphic presence on black without detailed illustration. |
| Faux vintage wash/faded ink | Faded overlay makes new shirts feel like favorite band tees. Effective with retro music, sports, Americana on black. |

---

## Aesthetic Categories

### Evergreen (E)

| Aesthetic | Why It Works |
|-----------|--------------|
| Retro/nostalgia (70s-Y2K) | Nostalgia cuts across demographics. Black tees make bright retro palettes and sunsets pop. |
| Funny/relatable text | Viral potential and impulse buying. Clarity at thumbnail matters more than illustration, making black-background bold type ideal. |
| Minimalist/clean branding | Easy to pair with outfits, appeals to buyers who dislike busy art, gives store a "brand" feel. Black is default for this look. |
| Streetwear/bold graphic | Feels current and fashion-driven. Black serves as base for high contrast prints like mainstream streetwear brands. |
| Outdoors/adventure/national parks | Tied to strong identity (hiking, camping, van life). Badges and silhouettes over black give rugged, night-sky feel. |
| Anime/manga/K-pop inspired | High fandom engagement, repeat buyers. Visual styles (cel shading, bright hair colors) pop on black. |

### Emerging (M)

| Aesthetic | Why It Works |
|-----------|--------------|
| Cottagecore/nature romanticism | Serves cozy, slow-living themes. On black, adjust palette (warm creams, soft yellows) for contrast. |
| Whimsigothic/occult-cute | Perfect thematic match to black garments. Mixes gothic vibes with accessibility. |
| AI/cyber/tech aesthetics | Resonates with tech-savvy buyers. Glitch, neon lines, and grids look best on black, mimicking screens. |
| Hyper-personalized identity tees | Feels made for the buyer. Simple text or badge designs with targeted identity convert well on high-contrast black. |

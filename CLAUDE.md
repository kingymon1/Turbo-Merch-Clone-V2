# CLAUDE.md - Project Context for Claude Code

This file provides context and documentation references for Claude Code when working on this project.

## Project Overview

Turbo Merch is an AI-powered merchandise platform that helps discover trends, generate product listings, and manage inventory. Built with Next.js and integrates with multiple AI services.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Database**: Prisma ORM
- **AI Services**: Google Gemini, Grok, Perplexity, OpenAI, Anthropic Claude
- **Styling**: Tailwind CSS

## API Documentation References

When implementing or modifying API integrations, refer to these documentation files:

### Google Gemini API
- **Location**: `docs/gemini-api.md`
- **Use for**: Multimodal AI, text generation, search grounding, function calling
- **Key models**: `gemini-2.5-flash` (balanced), `gemini-2.5-pro` (complex), `gemini-2.5-flash-lite` (cheap)
- **Base URL**: `https://generativelanguage.googleapis.com/v1beta`
- **Env var**: `GEMINI_API_KEY`

### Perplexity API
- **Location**: `docs/perplexity-api.md`
- **Use for**: Web search with AI, trend research, real-time information queries
- **Key models**: `sonar` (fast/cheap), `sonar-pro` (detailed), `sonar-reasoning` (logic)
- **Base URL**: `https://api.perplexity.ai`
- **Env var**: `PERPLEXITY_API_KEY`

### Grok API (xAI)
- **Location**: `docs/grok-api.md`
- **Use for**: AI text generation, image understanding, image generation, real-time search
- **Key models**: `grok-4` (flagship), `grok-4-1-fast` (agentic), `grok-2-image` (image gen)
- **Base URL**: `https://api.x.ai/v1`
- **Env var**: `XAI_API_KEY`

### Brave Search API
- **Location**: `docs/brave-search-api-reference.md`
- **Use for**: Web search, news, images, videos, local search, AI summarization
- **Key endpoints**: `/web/search`, `/news/search`, `/videos/search`, `/summarizer/search`
- **Base URL**: `https://api.search.brave.com/res/v1`
- **Env var**: `BRAVE_API_KEY`

### Decodo API
- **Location**: `docs/decodo-api.md`
- **Use for**: Web scraping, eCommerce data extraction, batch processing
- **Key targets**: `amazon_product`, `google_search`, `universal`, `tiktok_post`
- **Base URL**: `https://scraper-api.decodo.com/v2`
- **Env vars**: `DECODO_USERNAME`, `DECODO_PASSWORD`

### Vectorizer.AI
- **Location**: `docs/vectorizer-api.md`
- **Use for**: Raster-to-vector image conversion, logo vectorization, AI-powered tracing
- **Key endpoints**: `/vectorize` (convert), `/download` (retrieve), `/delete` (cleanup), `/account` (usage)
- **Base URL**: `https://api.vectorizer.ai/api/v1`
- **Env vars**: `VECTORIZER_API_ID`, `VECTORIZER_API_SECRET`

### OpenAI API
- **Location**: `docs/openai-api.md`
- **Use for**: Text generation, image generation (DALL-E), embeddings, speech-to-text, text-to-speech, function calling
- **Key models**: `gpt-4.1` (flagship), `gpt-4.1-mini` (fast), `dall-e-3` (images), `text-embedding-3-small` (embeddings)
- **Base URL**: `https://api.openai.com/v1`
- **Env var**: `OPENAI_API_KEY`

### Anthropic Claude API
- **Location**: `docs/claude-api.md`
- **Use for**: Text generation, vision, PDF analysis, tool use, extended thinking, citations
- **Key models**: `claude-sonnet-4-5` (coding/agents), `claude-opus-4-5` (complex), `claude-haiku-4-5` (fast/cheap)
- **Base URL**: `https://api.anthropic.com/v1`
- **Env var**: `ANTHROPIC_API_KEY`

### Ideogram API
- **Location**: `docs/ideogram-api.md`
- **Use for**: AI image generation with best-in-class text/typography rendering
- **Key endpoints**: `/v1/ideogram-v3/generate`, `/v1/ideogram-v3/generate-transparent`, `/v1/ideogram-v3/remix`
- **Key features**: Superior text rendering, DESIGN style type, transparent backgrounds, 62 style presets
- **Base URL**: `https://api.ideogram.ai`
- **Env var**: `IDEOGRAM_API_KEY`

### Google Imagen 4 API
- **Location**: `docs/imagen4_api_reference.md`
- **Use for**: High-quality image generation with strong text rendering, photorealism
- **Key models**: `imagen-4.0-generate-001` (standard), `imagen-4.0-ultra-generate-001` (highest fidelity), `imagen-4.0-fast-generate-001` (speed-optimized)
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:predict`
- **Env var**: `GEMINI_API_KEY`
- **Key features**:
  - Uses `:predict` endpoint with `instances`/`parameters` format (NOT `:generateContent`)
  - Request format: `{ instances: [{ prompt }], parameters: { sampleCount, aspectRatio, personGeneration } }`
  - Response format: `predictions[0].bytesBase64Encoded` for base64 image
  - No native negative prompt - append "Avoid X, Y, Z" to prompt text
  - Supports aspectRatio: "1:1", "9:16", "16:9", "3:4", "4:3"
  - Max prompt: 480 tokens, English only

## Feature Documentation

### Autopilot (formerly Simple Autopilot)
- **API Route**: `app/api/simple-autopilot/route.ts`
- **UI Component**: `components/SimpleAutopilot.tsx`
- **Sidebar Label**: "Autopilot" (renamed from "Simple Autopilot")
- **Purpose**: One-click merch generation from trending topics with optional user guidance

### Merch Generator
- **Architecture**: `docs/merch-generator/ARCHITECTURE.md`
- **API Reference**: `docs/merch-generator/API_REFERENCE.md`
- **Development Guide**: `docs/merch-generator/DEVELOPMENT_GUIDE.md`
- **Background Jobs**: `docs/merch-generator/BACKGROUND_JOBS.md`
- **Learning System**: `docs/merch-generator/LEARNING_SYSTEM.md`
- **Quick Reference**: `docs/merch-generator/QUICK_REFERENCE.md`
- **Validation**: `docs/merch-generator/MERCH_VALIDATION.md`

### Emerging Trends Pipeline
- **Module**: `lib/emerging-trends/`
- **UI Component**: `components/EmergingTrends.tsx`
- **API Routes**: `app/api/emerging-trends/discover/`, `app/api/emerging-trends/signals/`
- **Cron Job**: `app/api/cron/collect-social-signals/` (runs daily at 3 AM)
- **Purpose**: Discover emerging trends from social platforms (Reddit, TikTok) using relative velocity scoring
- **Env vars**: `DECODO_USERNAME`, `DECODO_PASSWORD`, `CRON_SECRET` (optional)

### Proven Niches Pipeline
- **Module**: `lib/proven-niches/`
- **UI Component**: `components/ProvenNiches.tsx`
- **API Routes**: `app/api/proven-niches/`, `app/api/proven-niches/scan/`, `app/api/proven-niches/opportunities/`, `app/api/proven-niches/products/`
- **Cron Job**: `app/api/cron/scan-marketplace/` (runs daily at 6 AM)
- **Purpose**: Discover what's selling on Amazon, analyze competition, identify low-competition opportunities
- **Env vars**: `DECODO_USERNAME`, `DECODO_PASSWORD`, `CRON_SECRET` (optional)

## Environment Variables

Required environment variables for full functionality:
- `GEMINI_API_KEY` - Google Gemini AI
- `PERPLEXITY_API_KEY` - Perplexity search API
- `GROK_API_KEY` - Grok AI
- `BRAVE_API_KEY` - Brave Search
- `VECTORIZER_API_ID` - Vectorizer.AI API ID
- `VECTORIZER_API_SECRET` - Vectorizer.AI API Secret
- `OPENAI_API_KEY` - OpenAI API
- `ANTHROPIC_API_KEY` - Anthropic Claude API
- `IDEOGRAM_API_KEY` - Ideogram image generation API
- `DATABASE_URL` - Prisma database connection

Optional feature flags:
- `STYLE_INTEL_MERCH_ENABLED` - Enable StyleIntel integration in merch pipeline (default: false)
- `EMERGING_TRENDS_ENABLED` - Enable emerging trends cron job (default: true)
- `PROVEN_NICHES_ENABLED` - Enable proven niches cron job (default: true)

Emerging Trends & Proven Niches Pipelines (optional):
- `DECODO_USERNAME` - Decodo API username for web scraping
- `DECODO_PASSWORD` - Decodo API password
- `CRON_SECRET` - Optional secret for securing cron endpoints

## Common Commands

```bash
# Development
npm run dev

# Build
npm run build

# Database
npx prisma db push
npx prisma generate
npx prisma studio
```

## Implementation Notes

### Adding Perplexity API Features
1. Read `docs/perplexity-api.md` for complete API documentation
2. Use `sonar` model for simple queries, `sonar-pro` for complex research
3. Always enable `return_citations: true` for source verification
4. Use `search_domain_filter` to focus results on relevant sites
5. Apply `search_recency_filter` for time-sensitive queries

### Adding Grok API Features
1. Read `docs/grok-api.md` for complete API documentation
2. Use `grok-4` for complex reasoning, `grok-4-1-fast` for agentic tool calling
3. OpenAI SDK compatible - just change base URL to `https://api.x.ai/v1`
4. For real-time search, use agentic tools (`web_search`, `x_search`)
5. Image generation uses `grok-2-image` model at separate endpoint

### Adding Google Gemini API Features
1. Read `docs/gemini-api.md` for complete API documentation
2. Use `gemini-2.5-flash` for most tasks, `gemini-2.5-flash-lite` for high-volume
3. Enable Google Search grounding with `tools: [{ google_search: {} }]`
4. Use `responseMimeType: 'application/json'` with `responseSchema` for structured output
5. Implement context caching for repeated prompts (significant cost savings)

### Adding Brave Search API Features
1. Read `docs/brave-search-api-reference.md` for complete API documentation
2. Use `freshness` parameter (`pd`, `pw`, `pm`) for time-filtered results
3. Enable `extra_snippets: true` for more context (Pro plans)
4. Use `summary: true` + `/summarizer/search` endpoint for AI summaries
5. Leverage Goggles for custom result re-ranking

### Adding Decodo API Features
1. Read `docs/decodo-api.md` for complete API documentation
2. Use target templates (`amazon_product`, `google_search`) for best results
3. Set `parse: true` to get structured JSON instead of raw HTML
4. Use `markdown: true` when feeding results to LLMs (reduces tokens)
5. For batch operations, use async endpoints with up to 3000 URLs/queries

### Adding Vectorizer.AI Features
1. Read `docs/vectorizer-api.md` for complete API documentation
2. Use Basic Auth with API ID and Secret for authentication
3. Set `output.format` to `svg` for web use or `pdf`/`eps` for print
4. Use `mode: production` for high-quality output, `mode: preview` for testing
5. Enable `processing.palette` for limited color outputs (logos, icons)
6. Use async workflow with `/download` endpoint for large batch operations

### Adding OpenAI API Features
1. Read `docs/openai-api.md` for complete API documentation
2. Use `gpt-4.1-nano` for simple tasks, `gpt-4.1-mini` for medium, `gpt-4.1` for complex
3. Enable structured outputs with `strict: true` for reliable JSON responses
4. Use `gpt-image-1` for image generation (preferred), `dall-e-3` as legacy option
5. `gpt-image-1` supports native `background: "transparent"` - ideal for t-shirt designs
6. Leverage Batch API for 50% cost savings on non-urgent workloads
7. Use `text-embedding-3-small` for cost-effective similarity search

### Adding Anthropic Claude API Features
1. Read `docs/claude-api.md` for complete API documentation
2. Use `claude-haiku-4-5` for high-volume tasks, `claude-sonnet-4-5` for coding/production
3. Enable prompt caching with `cache_control: { type: "ephemeral" }` for 90% cost savings
4. Use `strict: true` in tool definitions for guaranteed JSON schema conformance
5. Enable extended thinking with `thinking: { type: "enabled", budget_tokens: N }` for complex analysis
6. Leverage Batch API for 50% cost savings on async workloads

### Adding Ideogram API Features
1. Read `docs/ideogram-api.md` for complete API documentation
2. Use `DESIGN` style type for t-shirt graphics and logos
3. Use `/v1/ideogram-v3/generate-transparent` for designs that need transparent backgrounds
4. Set `magic_prompt: OFF` to preserve exact text without AI modifications
5. Best-in-class text/typography rendering - preferred for text-heavy designs
6. Use negative prompts for quality floor: `"blurry, low quality, amateur, clipart"`
7. Rendering speeds: TURBO ($0.03) for drafts, DEFAULT ($0.06) for production, QUALITY ($0.09) for final
8. **Important**: Image URLs expire - always download immediately after generation

### Adding Google Imagen 4 API Features
1. Read `docs/imagen4_api_reference.md` for complete API documentation
2. Use `:predict` endpoint with `instances`/`parameters` format (NOT `:generateContent`)
3. Request body format:
   ```json
   {
     "instances": [{"prompt": "your prompt here"}],
     "parameters": {
       "sampleCount": 1,
       "aspectRatio": "3:4",
       "personGeneration": "DONT_ALLOW"
     }
   }
   ```
4. Response parsing: `predictions[0].bytesBase64Encoded` for base64 image
5. No native `negativePrompt` parameter - append to prompt text instead:
   ```
   "Your prompt here. Avoid blurry, deformed, low-res, diagram, clipart."
   ```
6. Available aspectRatio values: "1:1", "9:16", "16:9", "3:4", "4:3"
7. Model variants: `imagen-4.0-generate-001` (standard), `imagen-4.0-ultra-generate-001` (quality), `imagen-4.0-fast-generate-001` (speed)
8. Max prompt length: 480 tokens, English only
9. Pricing: ~$0.04/image (standard), $0.06 (ultra), $0.02 (fast)

## Merch Generator Image Pipeline

### Available Image Models
The merch generator supports multiple image generation models:
- **GPT-Image-1** (OpenAI) - Good text rendering, native transparent backgrounds
- **GPT-Image-1.5** (OpenAI) - 4x faster, superior text rendering, transparent backgrounds, 20% cheaper
- **Ideogram** - Best-in-class typography, DESIGN style type, 62 style presets
- **Imagen 4** (Google) - Strong text rendering, enterprise-grade

### Prompt Structure
For t-shirt designs, prompts should follow this structure:
1. **Text requirement (first, non-negotiable)**: Exact text in quotes, positioned prominently
2. **Text layout**: Positioning, sizing, emphasis based on phrase meaning
3. **Style direction**: From research or niche-aware defaults
4. **Quality floor**: Negative constraints (NOT clipart, NOT amateur, etc.)
5. **Technical requirements**: Background color, composition, print-ready

### Text Length Limits
- **Autopilot mode**: Maximum 6 words enforced for reliable rendering
- **Manual mode**: User choice with optional warning for >10 words

### Research Data Flow
Research agents provide complete style data:
- `visualStyle` (min 80 chars)
- `typographyStyle`
- `colorPalette`
- `designEffects`
- `textLayout` (positioning, emphasis, sizing)

This data flows through uncompressed to model-specific prompt renderers.

### Niche Style Inference (Intelligent Research)
When research data is incomplete, the system uses **intelligent agent-based research** to discover current style patterns - NOT hardcoded defaults.

**Philosophy**:
- "We have access to all the information on the internet - use it."
- **Live research is PRIMARY** - always discover fresh patterns
- **Stored data is CONTEXT** - informs and validates, never replaces research
- **System makes autonomous decisions** - no user warnings, system decides everything

**Implementation** (`lib/merch/niche-style-researcher.ts`):

The research flow:
1. **Fetch stored context** (parallel, non-blocking) - NicheStyleProfile, NicheMarketData, ProvenInsight
2. **Build enriched prompt** - Stored data as BACKGROUND, not constraints
3. **Call Perplexity** (sonar model) - Always do live web research
4. **Score confidence** - Compare research with stored data (agreement = 0.9, novel = 0.75, disagrees = 0.65)
5. **Write back findings** - Fire-and-forget database update (don't block on writes)

**Database Integration**:
- `NicheStyleProfile` - Accumulated style intelligence per niche (typography, colors, mood)
- `NicheMarketData` - Market patterns and trends for niches
- `ProvenInsight` - Validated patterns from actual product success

**Why This Architecture**:
- Stored data provides context that improves research prompts
- Live research prevents system from getting lazy/repetitive
- Confidence scoring validates novel discoveries vs established patterns
- Write-back mechanism makes system smarter over time without getting stale
- Aligns with "agent decisions, not hardcoded options" principle

**Style Source Priority** (used in DesignBrief):
1. `discovered` - from Claude Vision image analysis
2. `researched` - from Gemini text-based research
3. `user-specified` - explicit user preference
4. `niche-researched` - from intelligent web research with database context
5. `niche-default` - minimal fallback if research fails completely

### Real-Time Style Discovery (Claude Vision)

**Implementation** (`lib/merch/style-discovery.ts`):

The system uses Claude Vision to analyze actual MBA product images and learn style patterns.

**Key Enhancement**: Now accepts phrase context for trend-relevant analysis:
- Old: Analyzed generic "fishing" products
- New: Analyzes "Fishing Dad" products when that's the trend

**Flow**:
1. **Search by phrase first** - More specific results (e.g., "Pickleball Dad" shirts)
2. **Fall back to niche** - If phrase yields insufficient results
3. **Analyze images** - Claude Vision extracts typography, colors, layout, aesthetic
4. **Write back learnings** - Every analysis updates NicheStyleProfile (fire-and-forget)

**Continuous Learning**:
- Every real-time analysis writes back to database
- New styles merge with existing (weighted by sample size)
- Confidence scores blend over time
- System gets smarter with each generation

**Cache Strategy**:
- Fresh cache (<1 week): Use immediately
- Stale cache: Trigger real-time analysis, use cache as fallback
- No cache: Real-time analysis, create new profile

### Style Miner (Pre-Mined Design Intelligence)

**Implementation** (`lib/style-intel/`):

A standalone job that mines design knowledge from external sources BEFORE live pipelines need it.

**Philosophy**:
- Pre-populate style intelligence before going live
- Mine authoritative design guides and template galleries
- Build a library of reusable style recipes and principles
- Run periodically to keep design knowledge fresh

**Files**:
- `lib/style-intel/types.ts` - TypeScript types for StyleRecipe and StylePrinciple
- `lib/style-intel/style-miner-service.ts` - Core mining logic (includes auto-chunking)
- `scripts/style-intel/run-style-miner.ts` - CLI script
- `config/style-intel-sources.json` - URL configuration (editable)
- `app/admin/page.tsx` - Admin UI with Auto Mine button

**Database Models**:
- `StyleRecipeLibrary` - Reusable design directions (typography, layout, color, effects)
- `StylePrinciple` - Contextual design rules with rationale

**Running the Style Miner**:

```bash
# CLI
npm run style-miner:warmup    # 3 passes (recommended for initial setup)
npm run style-miner:once      # 1 pass
npm run style-miner:status    # Check database status

# UI (Recommended)
# Navigate to /admin (requires isAdmin: true)
# Click "Auto Mine All" - processes in chunks, won't timeout

# API - Auto mode (recommended, won't timeout)
POST /api/admin/trigger-collection
Body: {"action": "style-mine-auto", "group": "all"}

# API - Manual mode (may timeout with many URLs)
POST /api/admin/trigger-collection
Body: {"action": "style-mine", "passes": 3, "group": "all"}

# API - Initialize tables (first-time setup)
POST /api/admin/trigger-collection
Body: {"action": "init-style-tables"}
```

**Source Configuration** (`config/style-intel-sources.json`):
```json
{
  "design_guides": ["https://..."],
  "template_galleries": ["https://..."],
  "inspiration_galleries": ["https://..."],
  "market_examples": []
}
```

**How It Works**:
1. Reads URLs from config file
2. Uses Perplexity API (sonar model) to read and analyze each URL
3. Extracts StyleRecipe and StylePrinciple objects
4. Upserts to database (merges with existing, increases confidence)
5. Multiple passes increase confidence through validation

**Auto-Mining (Recommended)**:
- Processes URLs in chunks of 5 (stays under Vercel 300s timeout)
- Skips URLs mined within the last 24 hours
- Returns `isComplete: true` when all URLs are done
- UI shows live progress with "URLs remaining" count

**Key Characteristics**:
- Completely decoupled from runtime pipelines
- Safe to run multiple times (idempotent upserts)
- Confidence increases with each re-discovery
- Runs on Perplexity API (same as niche style researcher)

### StyleIntel Pipeline Integration

**Implementation** (`lib/style-intel/service.ts`, `lib/merch/style-intel-integration.ts`):

The StyleIntel service connects the pre-mined StyleRecipeLibrary to the live merch generator pipeline.

**Feature Flag**: `STYLE_INTEL_MERCH_ENABLED`
- Default: `false` (disabled)
- Set to `true` to enable StyleIntel in the merch pipeline

**How It Works**:
1. When a DesignBrief is created (autopilot or manual mode)
2. `maybeApplyStyleIntel(brief)` is called
3. If enabled, queries StyleRecipeLibrary for matching recipes based on:
   - Niche (partial match on `nicheHints`, `displayName`, `category`)
   - Tone (partial match)
   - Garment color (match against `recommendedGarmentColors`)
   - Text length (prefer simpler recipes for longer text)
   - Risk level (low risk = simpler recipes, high risk = complex recipes)
4. Selected recipe is attached to brief as `styleSpec`
5. Tracking metadata added as `styleIntelMeta`

**Files**:
- `lib/style-intel/service.ts` - StyleIntelService with `selectStyleSpec()` and `isEnabledForPipeline()`
- `lib/merch/style-intel-integration.ts` - Integration helpers (`maybeApplyStyleIntel`, `formatStyleRecipeForPrompt`)
- `lib/merch/types.ts` - `StyleIntelMeta` interface, `styleSpec` field on DesignBrief

**Downstream Usage**:
When `styleSpec` is present on a DesignBrief:
- **FormFiller** (`lib/merch/form-filler.ts`): Includes recipe guidance in AI prompts
- **SimplePromptBuilder** (`lib/merch/simple-prompt-builder.ts`): `buildModelSpecificPromptWithStyleSpec()` uses recipe for typography, layout, and effects
- **API Response**: `design.sourceData.styleIntel` shows usage status

**API Response Format**:
```json
{
  "design": {
    "sourceData": {
      "styleIntel": {
        "attempted": true,
        "used": true,
        "recipeId": "retro-vintage-001",
        "recipeName": "Retro Vintage Badge"
      }
    }
  }
}
```

Or when fallback occurs:
```json
{
  "sourceData": {
    "styleIntel": {
      "attempted": true,
      "used": false,
      "fallbackReason": "disabled_for_pipeline"
    }
  }
}
```

**Fallback Reasons**:
- `disabled_for_pipeline` - Feature flag is off
- `no_recipe_found` - No matching recipes in database
- `db_error:...` - Database query failed
- `not_attempted` - StyleIntel was never called (legacy code path)

### StyleIntel Agent Collaboration Architecture

When `STYLE_INTEL_MERCH_ENABLED` is true, all agents in the merch pipeline collaborate with the Style Intelligence system. Each agent has a specific role:

**Research Agents (Context Providers)**:

These agents provide HIGH-LEVEL style hints and market context. They do NOT make final style decisions.

| Agent | File | Role | What It Provides |
|-------|------|------|------------------|
| NicheStyleResearcher | `lib/merch/niche-style-researcher.ts` | Live market research | Typography mood, color mood, aesthetic hints |
| StyleDiscovery | `lib/merch/style-discovery.ts` | Visual pattern discovery | Observable patterns from real product images |
| AutopilotGenerator | `lib/merch/autopilot-generator.ts` | Orchestration | Niche, tone, riskLevel, visual style hints |

**StyleIntelService (The Authority)**:

The `StyleIntelService` (`lib/style-intel/service.ts`) is the AUTHORITATIVE style selector:
- Receives context from research agents (niche, tone, garment color, text length, risk level)
- Queries StyleRecipeLibrary for matching pre-mined recipes
- Selects the best recipe based on context signals
- Returns the `styleSpec` (StyleRecipe) attached to the DesignBrief

**Execution Agents (Implementers)**:

These agents IMPLEMENT the selected styleSpec. They do NOT re-decide style when styleSpec is present.

| Agent | File | Role | StyleSpec Behavior |
|-------|------|------|-------------------|
| DesignExecutor | `lib/merch/design-executor.ts` | Brief → Prompt | StyleRecipe is AUTHORITATIVE; research is supplementary |
| FormFiller | `lib/merch/form-filler.ts` | Research → Form | Must IMPLEMENT recipe; style field aligns with recipe |
| SimplePromptBuilder | `lib/merch/simple-prompt-builder.ts` | Form → Prompt | Uses `buildModelSpecificPromptWithStyleSpec()` for recipe guidance |

**Data Flow with StyleIntel Enabled**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RESEARCH PHASE                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ AutopilotGenerator → Diversity Engine → Trend Research                  │
│      ↓                                                                   │
│ NicheStyleResearcher → Live Perplexity research → Style HINTS           │
│      ↓                                                                   │
│ StyleDiscovery → Claude Vision analysis → Visual PATTERNS               │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                     STYLE SELECTION (StyleIntelService)                  │
├─────────────────────────────────────────────────────────────────────────┤
│ Context: niche + tone + garment color + text length + risk level        │
│      ↓                                                                   │
│ Query StyleRecipeLibrary → Match recipes → Select best                  │
│      ↓                                                                   │
│ Attach styleSpec to DesignBrief (AUTHORITATIVE)                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXECUTION PHASE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ DesignExecutor → IMPLEMENTS styleSpec → Prompt with recipe guidance     │
│      ↓                                                                   │
│ FormFiller → IMPLEMENTS styleSpec → Style field aligns with recipe      │
│      ↓                                                                   │
│ SimplePromptBuilder → IMPLEMENTS styleSpec → Recipe in final prompt     │
└─────────────────────────────────────────────────────────────────────────┘
```

**When StyleSpec is Present**:
- Research data provides CONTEXT (niche, audience, tone)
- StyleRecipe provides CONCRETE DECISIONS (font category, layout, effects)
- Execution agents IMPLEMENT the recipe, not re-decide style
- styleIntelMeta tracks what happened for debugging

**When StyleSpec is Absent** (feature disabled or no match):
- Research data provides BOTH context AND style decisions
- Execution agents use research data as primary source
- Behavior unchanged from pre-StyleIntel implementation
- styleIntelMeta shows `fallbackReason` for debugging

### Autopilot (formerly Simple Autopilot)

**Implementation** (`app/api/simple-autopilot/route.ts`, `components/SimpleAutopilot.tsx`):

A streamlined merch generation feature that discovers trending topics and creates complete designs. Users can press Start for fully automatic generation, or guide it using optional fields.

**Design System Reference**: `docs/simple-style-selector.md`

**UI Layout** (top to bottom):
1. **Quick Start Section**: Prominent box with "Just press Start" messaging and Start button
2. **Image Model Selector**: Two large buttons (Model 1 / Model 2) - required selection
3. **Optional Fields**: All fields below are optional and guide (not override) the generation

**Image Models** (user-facing names hide actual model):
- **Model 1** (Ideogram 3.0): "Text heavy designs with minimal images"
- **Model 2** (GPT-Image-1.5): "Advanced images with effects and accurate text" - **DEFAULT**
- Note: Google Imagen 4 and GPT-Image-1 have been retired from Simple Autopilot

**Optional User Inputs**:
- **Description**: Free text describing the design (e.g., "A bull rider with USA flag, distressed style")
- **Text on the shirt**: The main text/phrase for the design (warning shown if >6 words)
- **Category/Niche**: Focus trend search (e.g., "gaming", "dogs", "fitness")
- **Mood**: Dropdown with options (Funny, Inspirational, Sarcastic, etc.) + custom "Other..."
- **Target Audience**: Free text (e.g., "fishing dads", "coffee addicts")
- **Typography/Effect/Aesthetic**: Dropdowns populated from `lib/simple-style-selector.ts` + custom "Other..."

**User Input Priority**:
- When user provides inputs, they **guide** the research and are **NOT overridden**
- User phrase → used directly as `textTop`
- User description → informs listing generation context
- User style selections → override random selection

**Generation Flow** (Two-Stage Discovery - Default):
1. **Stage 1: Niche Discovery** - Perplexity discovers an interesting community/hobby:
   - Explores beyond mainstream (fishing, knitting, crafts, not just AI/tech)
   - Returns: `niche` (community name), `audience` (who they are), `description`
   - Uses randomized exploration angles and avoidance instructions
   - High temperature (0.9) for maximum variety
2. **Stage 2: Trend Discovery** - Perplexity finds what's trending in that niche:
   - Injected with current date for recency (avoids old/historical content)
   - Returns: `topic`, `phrase` (2-5 words), `audience`, `mood`, `summary`
   - If user provides category, Stage 1 is skipped and category used directly
3. **Style Selection (Code)** - Weighted random selection from proven style options:
   - 70% Evergreen (E) options, 30% Emerging (M) options
   - Selects one TYPOGRAPHY, one EFFECT, one AESTHETIC
4. **LLM Complementation** - Gemini receives the phrase + mood + audience and derives:
   - TEXT_BOTTOM (complements the phrase - never generic like "Life Style")
   - IMAGE_DESCRIPTION (specific visual with uplift descriptors)
   - Note: TEXT_TOP comes directly from Perplexity's `phrase` field
5. **Prompt Display** - Shows completed prompt before image generation
6. **Image Generation** - Selected model creates the design
7. **Listing Generation** - Gemini creates brand, title, bullets, description
8. **Auto-Save** - Design saved to My Library (DesignHistory table)

**Research Mode Toggle**:
- `SIMPLE_AUTOPILOT_RESEARCH_MODE=twostage` (default) - Two-stage niche discovery
- `SIMPLE_AUTOPILOT_RESEARCH_MODE=classic` - Single query to Perplexity (legacy)

**Data Flow** (Two-Stage):
```
Stage 1: Niche Discovery (Perplexity)
    ↓
Returns: niche, audience, description
    ↓
Stage 2: Trend in Niche (Perplexity, with current date injected)
    ↓
Returns: topic, phrase, audience, mood, summary
    ↓
phrase → textTop (directly, max 6 words enforced)
mood + audience → context for Gemini
    ↓
Gemini (with responseSchema for reliable JSON)
    ↓
Derives: imageDescription only (textBottom removed)
    ↓
Code builds final prompt from all slot values
```

**Prompt Template** (simplified):
```
[TYPOGRAPHY] t-shirt design (no mockup) featuring '[TEXT_TOP]'. [AESTHETIC] style with bold [EFFECT] effects. Add [IMAGE_DESCRIPTION]. 4500x5400px, black shirt.
```

**Key prompt changes**:
- Single phrase only (textBottom removed) - model decides layout
- No forced positioning ("at top and bottom" removed)
- Effect mentioned once with "bold" prefix for stronger rendering
- Cleaner, less prescriptive structure

**Style Selection Rules**:
- TYPOGRAPHY, EFFECT, and AESTHETIC are selected by code using weighted random (70% E / 30% M)
- LLM does NOT choose styles - Gemini only derives imageDescription
- Phrase comes from Perplexity research, model decides how to arrange it
- All style options are documented in `docs/simple-style-selector.md` with rationale
- Designs optimized for black shirts (highest contrast, broadest appeal)

**Diversity Mechanism** (Two-Stage):
The two-stage approach explores the full landscape of human interests:
- **Stage 1 Exploration Angles**: Rotates through hobby communities, professional fields, lifestyles, fandoms, sports, crafts, outdoor activities, collector groups
- **Stage 1 Avoidance**: Explicitly avoids mainstream tech, AI, politics, viral memes
- **Stage 1 Temperature**: 0.9 for maximum variety in niche discovery
- **Stage 2 Date Injection**: Current date injected to ensure recent trends, not historical content
- **Stage 2 Temperature**: 0.8 for variety while maintaining relevance

**Why Two-Stage**:
Single-query approach gravitated toward mainstream social media trends (AI, memes, pop culture). Two-stage forces exploration of the long tail: fishing, knitting, hiking, cooking, etc.

**Cost Per Generation** (~$0.10 with GPT-Image-1.5):
| Step | API | Cost |
|------|-----|------|
| Stage 1: Niche Discovery | Perplexity (sonar) | ~$0.005 |
| Stage 2: Trend Discovery | Perplexity (sonar) | ~$0.006 |
| Slot Values | Gemini (2.5-flash) | ~$0.004 |
| Image Generation | GPT-Image-1.5 | ~$0.08 |
| Listing Generation | Gemini (2.5-flash) | ~$0.003 |

**API Endpoint**:
```
POST /api/simple-autopilot
Body: {
  "category": "optional niche string",
  "imageModel": "ideogram" | "gpt-image-1.5",
  "phrase": "optional - text for the shirt",
  "mood": "optional - e.g., Funny, Inspirational",
  "audience": "optional - e.g., fishing dads",
  "typography": "optional - style override",
  "effect": "optional - effect override",
  "aesthetic": "optional - aesthetic override",
  "additionalNotes": "optional - design description"
}

Response: {
  "success": true,
  "data": {
    "trendData": { "topic": "...", "phrase": "...", "audience": "...", "mood": "...", "summary": "...", "source": "..." },
    "slotValues": { "typography": "...", "effect": "...", "aesthetic": "...", "textTop": "...", "textBottom": "...", "imageDescription": "..." },
    "prompt": "The complete prompt sent to image model",
    "imageUrl": "Generated image URL or base64",
    "listing": { "brand": "...", "title": "...", "bullet1": "...", "bullet2": "...", "description": "..." },
    "savedDesignId": "UUID of saved design"
  }
}
```

**Key Characteristics**:
- No risk levels, batch modes, or compliance passes - minimal by design
- Live data only - never uses cached or training data for trends
- Style selection in code, not LLM - ensures consistency and evidence-backed choices
- Single phrase design - model has creative freedom for text layout
- Research data (phrase, mood, audience) flows through to inform Gemini
- Gemini uses `responseSchema` for guaranteed JSON output structure
- 6-word warning (not enforced) for reliable text rendering in manual mode
- Immediate save to My Library after generation
- Auto-scroll to generated design image on completion
- Dual Start buttons (top and bottom of form) for convenience

**Dev Mode Features**:
Dev mode is enabled on localhost or with `?dev=true` URL parameter.

- **Generated Prompt Display**: Only visible in dev mode (hidden from normal users)
- **Typography/Effect/Aesthetic badges**: Only shown in dev mode

**UI Results Display** (for normal users):
1. Discovered Trend (topic + summary)
2. Generated Design (image with download button)
3. Listing Text (brand, title, bullets, description - all copyable)
4. "Design saved to My Library" confirmation

**Sidebar Navigation**:
The following tabs are **hidden from normal users** (visible in dev mode only):
- Trend Scanner
- Trend Lab
- Merch Generator
- Ideas Vault

Normal users see: Dashboard, **Emerging Trends**, **Proven Niches**, **Autopilot**, Image Vectorizer, My Library, Subscription

### Emerging Trends Pipeline

**Implementation** (`lib/emerging-trends/`):

A completely separate module for discovering emerging trends from social platforms (Reddit, TikTok) before they become mainstream. The key insight is that **relative velocity within a community matters more than absolute numbers** - a post with 500 upvotes in a 30k subreddit is a bigger signal than 5,000 in a 5M subreddit.

**Architecture**:
```
lib/emerging-trends/
├── types.ts              # TypeScript interfaces, velocity presets
├── config.ts             # Seed communities, discovery settings
├── index.ts              # Main orchestration (discoverEmergingTrends)
├── client/
│   └── decodo-client.ts  # Decodo API wrapper with retry logic
├── scrapers/
│   ├── reddit-scraper.ts # Reddit-specific scraping
│   ├── tiktok-scraper.ts # TikTok-specific scraping
│   └── discovery-scraper.ts # Community discovery
├── analyzers/
│   └── velocity-calculator.ts # Core velocity scoring algorithm
├── evaluators/
│   └── merch-evaluator.ts # Claude-based merch opportunity evaluation
└── storage/
    └── trend-store.ts    # Prisma operations for all models
```

**Database Models** (in `prisma/schema.prisma`):
- `SocialSignal` - Raw signals from Reddit/TikTok with velocity metrics
- `EmergingTrend` - Evaluated trends with merch potential, phrases, audience
- `DiscoveredCommunity` - Tracked communities with baseline engagement data
- `EmergingTrendsConfig` - Velocity threshold presets (stored in DB)

**Velocity Presets**:
| Preset | Exploding | Rising | Steady | Use Case |
|--------|-----------|--------|--------|----------|
| Conservative | 10x avg | 7x avg | 4x avg | Low noise, high confidence |
| Moderate | 7x avg | 4x avg | 2x avg | Balanced (default) |
| Aggressive | 4x avg | 2.5x avg | 1.5x avg | Early discovery, more noise |

**Velocity Calculation Algorithm** (`lib/emerging-trends/analyzers/velocity-calculator.ts`):
```typescript
// Relative engagement (NOT absolute numbers)
const relativeUpvotes = signal.upvotes / baseline.avgUpvotes;
const relativeComments = signal.comments / baseline.avgComments;

// Community size factor (smaller = bigger signal)
const sizeFactor = Math.log10(1_000_000 / communitySize);

// Recency bonus (exponential decay)
const recencyBonus = Math.exp(-decayRate * hoursOld);

// Combined score
const combinedScore = (relativeUpvotes * 0.6 + relativeComments * 0.4)
                    * sizeFactor * recencyBonus;
```

**API Endpoints**:

```
GET /api/emerging-trends/discover
# Health check - returns system status

POST /api/emerging-trends/discover
Body: { "velocityPreset": "moderate", "platforms": ["reddit"] }
# Triggers manual discovery run

GET /api/emerging-trends/signals?limit=50&amazonSafeOnly=true
# Fetch trends for UI display

POST /api/emerging-trends/signals
Body: { "trendId": "...", "action": "markUsed" }
# Mark trend as used (for tracking)
```

**Cron Job** (`/api/cron/collect-social-signals`):
- Schedule: Daily at 5 AM (`0 5 * * *` in vercel.json)
- Scrapes seed communities for new signals
- Calculates velocity scores against community baselines
- Evaluates high-velocity signals with Claude for merch potential
- Creates EmergingTrend records for viable opportunities

**Seed Communities** (40+ subreddits):
Organized by category: hobby, profession, pets, family, crafts, outdoors, fitness, food, gaming, music, art, sports

**Claude Evaluation** (`lib/emerging-trends/evaluators/merch-evaluator.ts`):
For high-velocity signals, Claude analyzes:
- Is this a merch opportunity?
- Extract phrases that would work on a shirt
- Identify target audience and their profile
- Check Amazon safety (trademark, controversial content)
- Suggest styles, colors, mood keywords

**UI Component** (`components/EmergingTrends.tsx`):
- Velocity preset selector (conservative/moderate/aggressive)
- "Discover Now" button for manual runs
- Trends grouped by tier (Exploding/Rising/Steady)
- Trend cards with phrases, audience, viability score
- Detail modal with full information
- "Generate Design" button to create merch from trend

**Setup Requirements**:
1. Subscribe to Decodo Advanced Plan (~$69/mo for 82K requests)
2. Set `DECODO_USERNAME` and `DECODO_PASSWORD` in environment
3. Run `npx prisma db push` to create database tables
4. Optionally set `CRON_SECRET` for securing the cron endpoint

**Key Design Decisions**:
- **Relative velocity**: 500 upvotes in 30k sub > 5,000 in 5M sub
- **Community baselines**: Track average engagement per community
- **Separate module**: No dependencies on existing pipelines
- **Graceful failure**: Works without Decodo (returns empty results)
- **Batch evaluation**: Evaluates top N signals per run to control Claude costs

### Proven Niches Pipeline

**Implementation** (`lib/proven-niches/`):

A completely separate module for discovering what's actually selling on Amazon Merch. While Emerging Trends finds early signals, Proven Niches validates demand by analyzing real marketplace data. The key insight is that **low competition + high demand = opportunity**.

**Architecture**:
```
lib/proven-niches/
├── types.ts              # TypeScript interfaces (TrackedNicheData, NicheOpportunityData, etc.)
├── config.ts             # Seed niches (25+), scrape settings, analysis thresholds
├── index.ts              # Main orchestration (runFullScan, checkProvenNichesHealth)
├── client/
│   └── amazon-client.ts  # Amazon scraping via Decodo API
├── scrapers/
│   ├── product-scraper.ts    # Product discovery and storage
│   └── keyword-scraper.ts    # Keyword analysis and related terms
├── analyzers/
│   ├── competition-analyzer.ts   # Competition scoring (review counts, brand dominance, BSR)
│   └── opportunity-analyzer.ts   # Opportunity identification (keyword gaps, price points)
└── storage/
    └── niche-store.ts    # Prisma operations for all models
```

**Database Models** (in `prisma/schema.prisma`):
- `TrackedNiche` - Niches being monitored with metadata and scan timestamps
- `NicheProduct` - Products discovered in each niche with BSR, price, reviews
- `NicheOpportunity` - Identified opportunities with scores and recommendations
- `NicheKeyword` - Related keywords with search volume and competition data
- `ProductPriceHistory` - Historical price tracking for trend analysis

**Competition Levels**:
| Level | Review Threshold | Characteristics |
|-------|-----------------|-----------------|
| Low | Avg < 50 reviews | Easy entry, less validation |
| Medium | 50-200 reviews | Balanced, proven demand |
| High | 200-500 reviews | Harder entry, strong demand |
| Very High | 500+ reviews | Saturated, avoid |

**Opportunity Scoring Algorithm** (`lib/proven-niches/analyzers/opportunity-analyzer.ts`):
```typescript
// Demand score (0-100) - based on BSR and review velocity
const demandScore = calculateDemandScore(avgBSR, reviewGrowthRate);

// Competition score (0-100) - inverse of competition level
const competitionScore = 100 - (avgReviews / maxReviews) * 100;

// Final opportunity score (higher = better)
const opportunityScore = (demandScore * 0.4 + competitionScore * 0.6);
```

**API Endpoints**:

```
GET /api/proven-niches
# List all tracked niches with metrics

POST /api/proven-niches
Body: { "niche": "fishing dad", "category": "family" }
# Add new niche to track

POST /api/proven-niches/scan
Body: { "niches": ["fishing", "hiking"] }
# Trigger manual scan for specific niches

GET /api/proven-niches/opportunities?status=active&minScore=60
# Fetch opportunities for UI display

GET /api/proven-niches/products?niche=fishing&limit=50&sort=bsr
# Get products for a specific niche

GET /api/proven-niches/health
# System health check
```

**Cron Job** (`/api/cron/scan-marketplace`):
- Schedule: Daily at 6 AM UTC (`0 6 * * *` in vercel.json)
- Scans all tracked niches via Amazon search
- Extracts product data (BSR, price, reviews, ratings)
- Calculates competition levels per niche
- Identifies new opportunities based on scoring
- Updates niche metrics and scan timestamps

**Seed Niches** (25+ categories):
Organized by type: profession (nurse, teacher), family (dog mom, fishing dad), hobby (hiking, camping), pets (cat lady, dog lover), sports (golf, pickleball), crafts (knitting, sewing), lifestyle (coffee, beer)

**UI Component** (`components/ProvenNiches.tsx`):
- **Niches Tab**: Grid of tracked niches with competition badges (Low/Medium/High/Very High)
- **Opportunities Tab**: Scored opportunities with demand/competition breakdown
- **Products Panel**: Slide-out panel showing products for selected niche
- **Scan Button**: Manual trigger for marketplace scan
- **Add Niche**: Form to add custom niches to track
- **Health Status**: Indicator showing Decodo API configuration

**Setup Requirements**:
1. Subscribe to Decodo Advanced Plan (~$69/mo for Amazon scraping)
2. Set `DECODO_USERNAME` and `DECODO_PASSWORD` in environment
3. Run `npx prisma db push` to create database tables
4. Optionally set `CRON_SECRET` for securing the cron endpoint

**Key Design Decisions**:
- **Real marketplace data**: Validates demand with actual sales metrics (BSR)
- **Competition analysis**: Uses review counts as proxy for market saturation
- **Separate from Emerging Trends**: Different data source, different purpose
- **Daily scanning**: Markets change; stale data leads to bad decisions
- **Seed niches**: Pre-configured with proven merch categories
- **Graceful failure**: Works without Decodo (returns empty results)

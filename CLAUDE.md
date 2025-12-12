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

## Feature Documentation

### Merch Generator
- **Architecture**: `docs/merch-generator/ARCHITECTURE.md`
- **API Reference**: `docs/merch-generator/API_REFERENCE.md`
- **Development Guide**: `docs/merch-generator/DEVELOPMENT_GUIDE.md`
- **Background Jobs**: `docs/merch-generator/BACKGROUND_JOBS.md`
- **Learning System**: `docs/merch-generator/LEARNING_SYSTEM.md`
- **Quick Reference**: `docs/merch-generator/QUICK_REFERENCE.md`
- **Validation**: `docs/merch-generator/MERCH_VALIDATION.md`

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

## Merch Generator Image Pipeline

### Available Image Models
The merch generator supports multiple image generation models:
- **GPT-Image-1** (OpenAI) - Good text rendering, native transparent backgrounds, 75% cheaper than DALL-E 3
- **Ideogram** - Best-in-class typography, DESIGN style type, 62 style presets
- **Imagen 4** (Google) - Strong text rendering, enterprise-grade
- **DALL-E 3** (OpenAI) - Legacy option, vivid/natural styles

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

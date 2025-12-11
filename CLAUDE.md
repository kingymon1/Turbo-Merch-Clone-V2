# CLAUDE.md - Project Context for Claude Code

This file provides context and documentation references for Claude Code when working on this project.

## Project Overview

Turbo Merch is an AI-powered merchandise platform that helps discover trends, generate product listings, and manage inventory. Built with Next.js and integrates with multiple AI services.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Database**: Prisma ORM
- **AI Services**: Google Gemini, Grok, Perplexity
- **Styling**: Tailwind CSS

## API Documentation References

When implementing or modifying API integrations, refer to these documentation files:

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
- **Use for**: Web search functionality

### Decodo API
- **Location**: `docs/decodo-api.md`
- **Use for**: Web scraping, eCommerce data extraction, batch processing
- **Key targets**: `amazon_product`, `google_search`, `universal`, `tiktok_post`
- **Base URL**: `https://scraper-api.decodo.com/v2`
- **Env vars**: `DECODO_USERNAME`, `DECODO_PASSWORD`

### Vectorizer AI
- **Location**: `docs/vectorizer-ai/README.md`
- **Use for**: Image vectorization

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

### Adding Decodo API Features
1. Read `docs/decodo-api.md` for complete API documentation
2. Use target templates (`amazon_product`, `google_search`) for best results
3. Set `parse: true` to get structured JSON instead of raw HTML
4. Use `markdown: true` when feeding results to LLMs (reduces tokens)
5. For batch operations, use async endpoints with up to 3000 URLs/queries

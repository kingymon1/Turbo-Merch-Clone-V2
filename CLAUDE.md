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

### Grok API
- **Location**: `docs/grok-api/README.md`
- **Use for**: AI text and image generation

### Brave Search API
- **Location**: `docs/brave-search-api-reference.md`
- **Use for**: Web search functionality

### Decodo API
- **Location**: `docs/decodo-api/README.md`
- **Use for**: Web scraping and data extraction

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

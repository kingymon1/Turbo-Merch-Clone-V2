# Merch Generator Development Guide

> **Last Updated:** December 2024
> **Version:** Phase 6 Complete

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Environment Setup](#2-environment-setup)
3. [Key Concepts](#3-key-concepts)
4. [File Structure](#4-file-structure)
5. [Development Workflow](#5-development-workflow)
6. [Testing](#6-testing)
7. [Common Tasks](#7-common-tasks)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Cloudflare R2 account (image storage)
- API keys: Gemini, Grok, Brave Search

### First Run

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your keys

# 3. Initialize database
npx prisma generate
npx prisma migrate dev

# 4. Run development server
npm run dev
```

### Verify Setup

1. Open http://localhost:3000
2. Navigate to Merch Generator
3. Try generating a design in manual mode
4. Check console for `[Merch Generate]` logs

---

## 2. Environment Setup

### Required Environment Variables

```bash
# .env.local

# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."

# AI Services
GEMINI_API_KEY="..."         # Google AI Studio
GROK_API_KEY="..."           # xAI Grok
BRAVE_API_KEY="..."          # Brave Search

# Image Storage (Cloudflare R2)
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="merch-designs"
R2_ENDPOINT="https://..."
R2_PUBLIC_URL="https://pub-..."

# Cron Jobs
CRON_SECRET="your-secure-random-string"

# Feature Flags
MERCH_USE_MOCK="false"       # Set "true" for dev without AI
```

### Feature Flags

| Flag | Values | Description |
|------|--------|-------------|
| `MERCH_USE_MOCK` | `true`/`false` | Use mock data instead of real AI |

---

## 3. Key Concepts

### Generation Modes

```
┌─────────────────────────────────────────────────────┐
│                  GENERATION MODES                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  AUTOPILOT                                          │
│  ├─ User provides: Risk level (0-100)               │
│  ├─ System provides: Phrase, style, tone, niche     │
│  └─ Uses: Cached data → Live API fallback           │
│                                                      │
│  MANUAL                                             │
│  ├─ User provides: Exact text, optional style/tone  │
│  └─ System provides: Image + listing                │
│                                                      │
│  DOMINATE                                           │
│  ├─ User provides: Parent design ID, count          │
│  └─ System provides: N unique variations            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Risk Levels

```typescript
// 0-30: Safe Zone
// Uses proven evergreen niches, heavily relies on ProvenInsights
const LOW_RISK_NICHES = [
  'nurse gifts', 'teacher appreciation', 'dog mom',
  'cat lover', 'coffee addict', 'dad jokes'
];

// 30-70: Balanced
// Mix of established and emerging trends
const MEDIUM_RISK_NICHES = [
  'work from home', 'plant mom', 'true crime',
  'book lover', 'yoga life', 'mental health awareness'
];

// 70-100: Moonshot
// Chasing viral trends, high risk/reward
const HIGH_RISK_NICHES = [
  'trending memes', 'viral tiktok', 'gen z humor',
  'chronically online', 'pop culture moments'
];
```

### Data Hierarchy

```
MarketData (raw)
    ↓ analyze
NicheTrend (aggregated)
    ↓ extract patterns
ProvenInsight (permanent knowledge)
    ↓ apply to
MerchDesign (generated design)
```

---

## 4. File Structure

```
lib/merch/
├── autopilot-generator.ts    # Autopilot orchestration
│                              # - generateAutopilotConcept()
│                              # - Risk level mapping
│                              # - Cache integration
│
├── image-prompter.ts         # Prompt construction
│                              # - createImagePrompt()
│                              # - DesignConcept interface
│
├── image-generator.ts        # Gemini Imagen integration
│                              # - generateMerchImage()
│                              # - R2 upload
│                              # - generatePlaceholderImage()
│
├── listing-generator.ts      # SEO listing generation
│                              # - generateMerchListing()
│                              # - Title, bullets, description
│
├── variation-generator.ts    # Dominate feature
│                              # - generateVariations()
│                              # - getVariationsForDesign()
│
├── variation-strategy.ts     # AI variation strategies
│                              # - generateVariationStrategy()
│
├── download-helper.ts        # Export utilities
│                              # - ZIP creation
│                              # - File download helpers
│
├── types.ts                  # TypeScript interfaces
│                              # - MerchDesign
│                              # - ManualSpecs
│                              # - GenerationRequest/Response
│
├── data-collectors/          # Phase 5: Market Intelligence
│   ├── index.ts              # Exports all collectors
│   ├── trend-collector.ts    # Data collection
│   │                         # - collectTrendData()
│   │                         # - collectMoonshotTrends()
│   │                         # - cleanOldMarketData()
│   │                         # - hasRecentData()
│   │                         # - getRecentMarketData()
│   └── niche-analyzer.ts     # Niche analysis
│                              # - analyzeNicheTrends()
│                              # - getRandomHighPerformingNiche()
│                              # - generateConceptFromCachedData()
│
└── learning/                 # Phase 6: Learning System
    ├── index.ts              # Exports all learning functions
    ├── insight-extractor.ts  # Pattern extraction
    │                         # - extractAllInsights()
    │                         # - Wilson Score calculation
    │                         # - 5 extraction pipelines
    ├── insight-validator.ts  # Insight validation
    │                         # - validateAllInsights()
    │                         # - Confidence decay
    └── insight-applier.ts    # Insight application
                              # - applyInsightsToGeneration()
                              # - logInsightUsage()
                              # - getRelevantInsights()
```

### API Routes

```
app/api/
├── merch/
│   ├── generate/route.ts     # POST: Generate design
│   │                         # GET: List user's designs
│   └── dominate/route.ts     # POST: Generate variations
│                              # GET: Get variations
│
├── cron/
│   ├── collect-trends/route.ts    # Proven + emerging data
│   ├── analyze-niches/route.ts    # Niche aggregation
│   ├── moonshot-trends/route.ts   # Viral trend hunting
│   └── learn-and-extract/route.ts # Weekly learning
│
└── admin/
    ├── trigger-collection/route.ts # Manual job trigger
    └── insights/
        ├── route.ts                # GET: List, POST: Create
        └── [id]/route.ts           # GET/PATCH/DELETE single
```

---

## 5. Development Workflow

### Adding a New Insight Type

1. **Define extraction logic** in `insight-extractor.ts`:

```typescript
async function extractNewPatternInsights(
  designs: DesignWithMetrics[]
): Promise<number> {
  // Group designs by your criteria
  // Calculate Wilson Score confidence
  // Create ProvenInsight records
}
```

2. **Add to extraction pipeline**:

```typescript
// In extractAllInsights()
const newInsights = await extractNewPatternInsights(designs);
totalCreated += newInsights;
```

3. **Add validation logic** in `insight-validator.ts`:

```typescript
case 'new-pattern':
  validationResult = await validateNewPatternInsight(insight, recentDesigns);
  break;
```

4. **Add application logic** in `insight-applier.ts`:

```typescript
// In getRelevantInsights()
newPatterns = await prisma.provenInsight.findMany({
  where: {
    ...baseQuery,
    insightType: 'new-pattern',
  },
});
```

### Adding a New Niche Category

1. **Update NICHE_POOLS** in `autopilot-generator.ts`:

```typescript
const NICHE_POOLS = {
  low: [..., 'new-niche'],
  medium: [...],
  high: [...],
};
```

2. **Update CATEGORY_QUERIES** in `trend-collector.ts`:

```typescript
const CATEGORY_QUERIES = {
  proven: [..., 'new-niche gifts'],
  emerging: [...],
  moonshot: [...],
};
```

3. **Add fallback phrases** in `autopilot-generator.ts`:

```typescript
const fallbackPhrases = {
  'new-niche': ["Phrase 1", "Phrase 2", "Phrase 3"],
};
```

### Modifying Generation Flow

The generation flow in `app/api/merch/generate/route.ts`:

```
1. Auth check
2. Validate request
3. Generate concept (autopilot or manual)
   └─ Phase 6: Apply insights
4. Create image prompt
5. Generate image (Gemini Imagen)
6. Generate listing
7. Save to database
8. Log insight usage
9. Return response
```

To modify, locate the relevant step and update.

---

## 6. Testing

### Manual Testing

```bash
# Use mock mode for fast iteration
MERCH_USE_MOCK=true npm run dev
```

### Test Generation

```bash
# Autopilot
curl -X POST http://localhost:3000/api/merch/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "autopilot", "riskLevel": 50}'

# Manual
curl -X POST http://localhost:3000/api/merch/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "manual",
    "specs": {"exactText": "Test Design", "niche": "test"}
  }'
```

### Test Cron Jobs Locally

```bash
# Trigger collection
curl -X POST http://localhost:3000/api/admin/trigger-collection \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "collect-proven"}'

# Trigger learning
curl -X POST http://localhost:3000/api/admin/trigger-collection \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "learn"}'
```

### Database Inspection

```bash
# Open Prisma Studio
npx prisma studio

# Direct SQL (if needed)
psql $DATABASE_URL

# Count designs
SELECT COUNT(*) FROM "MerchDesign";

# Count insights
SELECT "insightType", COUNT(*) FROM "ProvenInsight"
GROUP BY "insightType";
```

---

## 7. Common Tasks

### Reset Learning Data

```sql
-- Delete all insights (start fresh)
DELETE FROM "ProvenInsight";

-- Delete all market data
DELETE FROM "MarketData";
DELETE FROM "NicheTrend";
```

### Force Insight Revalidation

```typescript
// In your code or via API
import { validateSpecificInsight } from '@/lib/merch/learning';

const result = await validateSpecificInsight('insight-id-here');
```

### Manually Create an Insight

```bash
curl -X POST http://localhost:3000/api/admin/insights \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "insightType": "phrase-pattern",
    "category": "evergreen",
    "title": "Test pattern works well",
    "description": "Manually created for testing",
    "pattern": {"template": "Test {noun}"},
    "sampleSize": 1,
    "confidence": 0.9
  }'
```

### Debug Generation Issues

Add logging to trace the flow:

```typescript
// In autopilot-generator.ts
console.log('[Autopilot] Risk level:', riskLevel);
console.log('[Autopilot] Category:', category);
console.log('[Autopilot] Has cached data:', hasCached);
console.log('[Autopilot] Insight guidance:', insightGuidance);
```

### Check Cache Status

```typescript
import { hasRecentData } from '@/lib/merch/data-collectors';

const hasProven = await hasRecentData('proven', 12);
const hasEmerging = await hasRecentData('emerging', 12);
const hasMoonshot = await hasRecentData('moonshot', 6);

console.log({ hasProven, hasEmerging, hasMoonshot });
```

---

## 8. Troubleshooting

### "Unauthorized" on API calls

1. Check Clerk authentication is set up
2. Verify session token is being passed
3. For cron/admin: verify CRON_SECRET header

### Image Generation Fails

1. Check GEMINI_API_KEY is valid
2. Check R2 credentials
3. Look for error in console: `[Merch Generate] Image generation failed`
4. Falls back to placeholder image when failing

### No Insights Being Created

Requirements for insight creation:
- At least 10 designs with the pattern (MIN_SAMPLE_SIZE)
- Pattern appears in 2+ weeks (MIN_TIME_PERIODS)
- Wilson Score >= 0.8 (MIN_CONFIDENCE)
- Designs must have `isTest: false`

### Cron Jobs Not Running

1. Check vercel.json crons configuration
2. Verify CRON_SECRET is set in Vercel
3. Check Vercel dashboard for cron execution logs
4. Manual test: `POST /api/cron/collect-trends` with auth header

### Cache Not Being Used

```typescript
// Check cache status in logs
[Autopilot] Using cached market data (saves API costs!)
// vs
[Autopilot] No cached data, using live API
```

If always using live API:
1. Verify cron jobs are running
2. Check MarketData table has recent records
3. Verify `hasRecentData()` is returning true

### Learning System Not Applying Insights

1. Check insights exist: `GET /api/admin/insights`
2. Verify `stillRelevant: true`
3. Check confidence meets threshold for risk level
4. Look for log: `[Autopilot] Applied N insights`

### Database Connection Issues

```bash
# Test connection
npx prisma db pull

# Regenerate client
npx prisma generate

# Check migrations
npx prisma migrate status
```

---

## Quick Reference Commands

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Production build
npm run lint                   # Lint code

# Database
npx prisma generate           # Generate Prisma client
npx prisma migrate dev        # Run migrations
npx prisma studio             # Open database GUI
npx prisma db push            # Push schema changes (dev only)

# Testing
MERCH_USE_MOCK=true npm run dev  # Run with mock data

# Deployment
vercel                        # Deploy to Vercel
vercel logs                   # View deployment logs
```

---

## Further Reading

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview and design decisions
- [API_REFERENCE.md](./API_REFERENCE.md) - Complete API documentation
- [LEARNING_SYSTEM.md](./LEARNING_SYSTEM.md) - Deep dive into ProvenInsights
- [BACKGROUND_JOBS.md](./BACKGROUND_JOBS.md) - Cron job details
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - One-page cheat sheet

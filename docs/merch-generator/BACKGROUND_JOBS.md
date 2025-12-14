# Merch Generator Background Jobs

> **Last Updated:** December 2024
> **Version:** Phase 7 - Style Intelligence

---

## Table of Contents

1. [Overview](#1-overview)
2. [Job Schedule](#2-job-schedule)
3. [collect-trends](#3-collect-trends)
4. [analyze-niches](#4-analyze-niches)
5. [moonshot-trends](#5-moonshot-trends)
6. [learn-and-extract](#6-learn-and-extract)
7. [style-miner](#7-style-miner)
8. [Manual Triggers](#8-manual-triggers)
9. [Data Retention](#9-data-retention)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview

The Merch Generator uses 5 background jobs to build market intelligence, extract learning patterns, and mine design knowledge. Four jobs run on Vercel Cron; one (Style Miner) runs manually or on-demand.

### Purpose

```
┌────────────────────────────────────────────────────────────────────┐
│                     BACKGROUND JOB ECOSYSTEM                        │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  DATA COLLECTION              INTELLIGENCE         STYLE INTEL     │
│  ┌─────────────┐             ┌─────────────┐      ┌─────────────┐  │
│  │ collect-    │────────────▶│ analyze-    │      │ style-      │  │
│  │ trends      │  MarketData │ niches      │      │ miner       │  │
│  └─────────────┘             └──────┬──────┘      └──────┬──────┘  │
│        │                            │                     │         │
│        │                            │ NicheTrend          │         │
│  ┌─────▼───────┐                    │                     ▼         │
│  │ moonshot-   │                    ▼              StyleRecipeLib   │
│  │ trends      │────────────▶ ┌─────────────┐     StylePrinciple   │
│  └─────────────┘  MarketData │ learn-and-  │      (Permanent)      │
│                              │ extract     │                        │
│                              └──────┬──────┘                        │
│                                     │                               │
│                                     ▼                               │
│                              ProvenInsight                          │
│                              (Permanent)                            │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### Cost Impact

| Without Caching | With Caching | Savings |
|-----------------|--------------|---------|
| ~$0.04/design | ~$0.004/design | **90%** |

---

## 2. Job Schedule

### Vercel Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/collect-trends",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/analyze-niches",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/moonshot-trends",
      "schedule": "0 */4 * * *"
    },
    {
      "path": "/api/cron/learn-and-extract",
      "schedule": "0 4 * * 0"
    }
  ]
}
```

### Schedule Summary

| Job | Schedule | Frequency | Purpose |
|-----|----------|-----------|---------|
| `collect-trends` | `0 */6 * * *` | Every 6 hours | Proven + emerging data |
| `analyze-niches` | `0 2 * * *` | Daily 2am UTC | Aggregate niche metrics |
| `moonshot-trends` | `0 */4 * * *` | Every 4 hours | Viral trend hunting |
| `learn-and-extract` | `0 4 * * 0` | Sunday 4am UTC | Weekly learning cycle |

---

## 3. collect-trends

**Endpoint:** `POST /api/cron/collect-trends`
**File:** `app/api/cron/collect-trends/route.ts`
**Schedule:** Every 6 hours

### What It Does

1. Cleans old MarketData records (respecting retention policy)
2. Collects **proven** niche trends (10 queries, virality=25)
3. Collects **emerging** niche trends (10 queries, virality=50)

### Query Categories

```typescript
// Proven niches - evergreen, consistent demand
const PROVEN_QUERIES = [
  'nurse gifts trending',
  'teacher appreciation gifts',
  'dog mom shirts',
  'cat lover gifts',
  'coffee addict shirts',
  'dad jokes funny',
  'mom life humor',
  'gaming shirts trending',
  'fishing gifts funny',
  'camping outdoor shirts',
];

// Emerging niches - growing trends
const EMERGING_QUERIES = [
  'work from home humor',
  'introvert gifts trending',
  'plant parent shirts',
  'true crime fan gifts',
  'book lover aesthetic',
  'yoga mindfulness shirts',
  'running marathon shirts',
  'self care aesthetic',
  'mental health awareness',
  'millennial gen z humor',
];
```

### Response Example

```json
{
  "success": true,
  "message": "Trend collection complete",
  "stats": {
    "cleaned": 15,
    "proven": 10,
    "emerging": 10,
    "duration": "45230ms"
  }
}
```

### Data Flow

```
searchTrends(query, viralityLevel)
           │
           ▼
   Multi-Agent Research
   ├─ Grok Agent (X/Twitter)
   ├─ Brave Agent (Search)
   └─ Google Agent (News)
           │
           ▼
   Gemini Synthesis
           │
           ▼
   MarketData.create({
     source: 'multi-agent',
     category: 'proven' | 'emerging',
     query: 'nurse gifts trending',
     data: [TrendData, TrendData, ...],
     metadata: { viralityLevel, trendCount, collectedAt }
   })
```

---

## 4. analyze-niches

**Endpoint:** `POST /api/cron/analyze-niches`
**File:** `app/api/cron/analyze-niches/route.ts`
**Schedule:** Daily at 2am UTC

### What It Does

1. Aggregates all collected MarketData
2. Groups by niche
3. Calculates metrics (search volume, growth rate, competition)
4. Extracts popular phrases and keywords
5. Updates NicheTrend records

### NicheTrend Schema

```prisma
model NicheTrend {
  id          String   @id @default(cuid())
  niche       String   @unique
  category    String   // 'profession' | 'hobby' | 'pet' | 'lifestyle'

  // Trend metrics
  searchVolume    Int     @default(0)
  growthRate      Float   @default(0)
  competition     String  // 'low' | 'medium' | 'high'

  // Insights
  popularPhrases  String[]
  commonKeywords  String[]
  successPatterns Json?

  lastAnalyzed    DateTime @default(now())
}
```

### Response Example

```json
{
  "success": true,
  "message": "Niche analysis complete",
  "stats": {
    "nichesAnalyzed": 25,
    "duration": "12340ms"
  }
}
```

### How Autopilot Uses This

```typescript
// When generating, autopilot checks for cached niche intelligence
const nicheData = await getRandomHighPerformingNiche();
if (nicheData && nicheData.phrases.length > 0) {
  // Use cached niche analysis instead of live API
  const concept = await generateConceptFromCachedData(nicheData);
  return { concept, source: 'Niche Intelligence' };
}
```

---

## 5. moonshot-trends

**Endpoint:** `POST /api/cron/moonshot-trends`
**File:** `app/api/cron/moonshot-trends/route.ts`
**Schedule:** Every 4 hours

### What It Does

1. Searches for viral/breakout trends using test mode
2. Uses higher virality level (90) for aggressive discovery
3. Stores as `category: 'moonshot'` MarketData

### Moonshot Queries

```typescript
const MOONSHOT_QUERIES = [
  'trending memes today',
  'viral tiktok trends',
  'internet culture 2024',
  'gen z slang shirts',
  'chronically online humor',
  'viral moments trending',
  'pop culture references',
  'breaking trends viral',
];
```

### Why More Frequent?

Moonshot trends are time-sensitive. A meme that's viral today may be stale tomorrow. The 4-hour cycle ensures fresh viral data.

### Response Example

```json
{
  "success": true,
  "message": "Moonshot collection complete",
  "stats": {
    "moonshot": 8,
    "duration": "78450ms"
  }
}
```

### Higher API Delay

Moonshot uses test mode (all agents), so it includes a 5-second delay between queries vs 2-second for normal collection.

---

## 6. learn-and-extract

**Endpoint:** `POST /api/cron/learn-and-extract`
**File:** `app/api/cron/learn-and-extract/route.ts`
**Schedule:** Weekly (Sunday 4am UTC)

### What It Does

This is the learning system's main execution cycle:

```
┌─────────────────────────────────────────────────────┐
│              WEEKLY LEARNING CYCLE                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  STEP 1: EXTRACTION                                 │
│  ───────────────────                                │
│  • Load all non-test MerchDesign records            │
│  • Run 5 extraction pipelines:                      │
│    - extractPhrasePatterns()                        │
│    - extractStyleInsights()                         │
│    - extractNicheTimingInsights()                   │
│    - extractListingInsights()                       │
│    - extractCrossNicheInsights()                    │
│  • Create/update ProvenInsight records              │
│                                                      │
│  STEP 2: VALIDATION                                 │
│  ──────────────────                                 │
│  • Find insights due for validation                 │
│    - High confidence: > 30 days old                 │
│    - Lower confidence: > 7 days old                 │
│  • Test against recent designs (last 30 days)       │
│  • Update confidence scores:                        │
│    - Validated: +0.02                               │
│    - Degraded: -0.05                                │
│    - Invalid: stillRelevant = false                 │
│                                                      │
│  STEP 3: SUMMARY                                    │
│  ───────────────                                    │
│  • Generate stats for logging/monitoring            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Response Example

```json
{
  "success": true,
  "message": "Learning cycle complete",
  "extraction": {
    "insightsCreated": 3,
    "insightsUpdated": 12,
    "candidatesAnalyzed": 5,
    "errors": []
  },
  "validation": {
    "validated": 18,
    "degraded": 2,
    "invalidated": 1,
    "errors": []
  },
  "summary": {
    "total": 23,
    "byType": {
      "phrase-pattern": 8,
      "style-effectiveness": 5,
      "niche-timing": 4,
      "listing-structure": 4,
      "cross-niche": 2
    },
    "byCategory": {
      "evergreen": 12,
      "design": 5,
      "seasonal": 4,
      "listing": 2
    },
    "highConfidence": 15,
    "recentlyValidated": 20
  },
  "duration": "23450ms"
}
```

### Minimum Requirements

The extraction engine requires:
- At least 10 designs per pattern (MIN_SAMPLE_SIZE)
- Pattern appears in 2+ weeks (MIN_TIME_PERIODS)
- Wilson Score confidence >= 0.8 (MIN_CONFIDENCE)

---

## 7. style-miner

**Endpoint:** `POST /api/admin/trigger-collection` (action: `style-mine`)
**Files:**
- `lib/style-intel/style-miner-service.ts` (core logic)
- `scripts/style-intel/run-style-miner.ts` (CLI)
- `app/admin/page.tsx` (UI)
**Schedule:** Manual / On-demand

### What It Does

Mines design intelligence from external sources (design guides, template galleries, market examples) and populates the style intelligence database.

```
┌─────────────────────────────────────────────────────────────┐
│                    STYLE MINER FLOW                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  config/style-intel-sources.json                            │
│  ├─ design_guides[]                                         │
│  ├─ template_galleries[]                                    │
│  └─ market_examples[]                                       │
│              │                                               │
│              ▼                                               │
│  ┌───────────────────┐                                      │
│  │  Perplexity API   │  Read URL content + extract          │
│  │  (sonar model)    │  design knowledge                    │
│  └─────────┬─────────┘                                      │
│            │                                                 │
│            ▼                                                 │
│  ┌───────────────────┐    ┌───────────────────┐            │
│  │ StyleRecipeLibrary│    │  StylePrinciple   │            │
│  │ - typography      │    │ - context rules   │            │
│  │ - layout          │    │ - recommendations │            │
│  │ - color           │    │ - rationale       │            │
│  │ - effects         │    │ - source refs     │            │
│  └───────────────────┘    └───────────────────┘            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Source Configuration

Edit `config/style-intel-sources.json` to add/remove URLs:

```json
{
  "design_guides": [
    "https://www.designity.com/blog/t-shirt-graphic-design-101",
    "https://www.printful.com/blog/t-shirt-design-ideas"
  ],
  "template_galleries": [
    "https://www.canva.com/t-shirts/templates/",
    "https://www.freepik.com/free-photos-vectors/typography-tshirt-design"
  ],
  "market_examples": []
}
```

### Database Models

#### StyleRecipeLibrary

Reusable design directions (typography, layout, color, effects):

```prisma
model StyleRecipeLibrary {
  id            String   @id @default(cuid())
  displayName   String   // "Bold Vintage Typography"
  category      String   // 'typography-focused' | 'minimalist' | 'vintage'
  nicheHints    String[] // ["fishing", "camping", "outdoor"]
  tone          String[] // ["bold", "rugged", "nostalgic"]
  complexity    String   // 'simple' | 'moderate' | 'complex'
  rawJson       Json     // Full StyleRecipe object
  sourceTypes   String[] // ['design_guide', 'template_gallery']
  references    String[] // URLs where discovered
  confidence    Float    // 0-1 confidence score
  timesValidated Int     // Increases with each re-discovery
}
```

#### StylePrinciple

Contextual design rules:

```prisma
model StylePrinciple {
  id               String   @id // "contrast-readability-rule"
  contextJson      Json     // {textLength: 'short', garmentColors: ['black']}
  recommendations  Json     // {typography: {fontWeight: 'bold'}, dos: [...]}
  rationale        String?  // "High contrast ensures readability"
  sourceReferences String[] // URLs supporting this principle
  timesValidated   Int      // Validation count
}
```

### Running the Style Miner

#### Option 1: Admin UI (Recommended)

Navigate to `/admin` (requires `isAdmin: true` on user):

1. View current database status
2. Select passes (1-5) and source group
3. Click "Run Miner"
4. Monitor results

#### Option 2: CLI

```bash
# Single pass over all sources
npm run style-miner:once

# Warmup with 3 passes (recommended for initial population)
npm run style-miner:warmup

# Check database status
npm run style-miner:status

# Custom options
npx tsx scripts/style-intel/run-style-miner.ts --passes=5 --group=design_guides
```

#### Option 3: API

```bash
# Run style miner (1 pass, all groups)
curl -X POST https://your-domain.com/api/admin/trigger-collection \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "style-mine", "passes": 1, "group": "all"}'

# Get status only
curl -X POST https://your-domain.com/api/admin/trigger-collection \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "style-mine-status"}'
```

### Response Example

```json
{
  "success": true,
  "action": "style-mine",
  "result": {
    "recipesUpserted": 12,
    "principlesUpserted": 8,
    "errors": 2,
    "duration": "45230ms",
    "dbTotals": {
      "recipes": 47,
      "principles": 23
    }
  },
  "duration": "45345ms"
}
```

### How Confidence Works

- **Initial extraction:** 0.5 confidence
- **Each re-discovery:** +0.1 confidence (capped at 0.95)
- **Multiple sources:** Higher confidence = more reliable pattern

### Best Practices

1. **Initial Warmup:** Run 3 passes on first setup
2. **Periodic Refresh:** Run monthly to pick up new design trends
3. **Add Market Examples:** Populate `market_examples` with Amazon/Etsy URLs for real-world validation
4. **Monitor Categories:** Use status to see distribution of recipe categories

---

## 8. Manual Triggers

### Admin Endpoint

Use `POST /api/admin/trigger-collection` to manually run any job:

```bash
# Run proven + emerging collection
curl -X POST https://your-domain.com/api/admin/trigger-collection \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "collect"}'

# Run moonshot collection
curl -X POST https://your-domain.com/api/admin/trigger-collection \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "moonshot"}'

# Run niche analysis
curl -X POST https://your-domain.com/api/admin/trigger-collection \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "analyze"}'

# Run learning extraction
curl -X POST https://your-domain.com/api/admin/trigger-collection \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "learn"}'

# Run validation only
curl -X POST https://your-domain.com/api/admin/trigger-collection \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "validate"}'

# Run full cycle (clean + all collections + analyze)
curl -X POST https://your-domain.com/api/admin/trigger-collection \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "full"}'
```

### Available Actions

| Action | Equivalent Job |
|--------|----------------|
| `collect` | `collect-trends` (proven + emerging) |
| `collect-proven` | Just proven trends |
| `collect-emerging` | Just emerging trends |
| `moonshot` | `moonshot-trends` |
| `analyze` | `analyze-niches` |
| `clean` | Cleanup only |
| `full` | All collection + analysis |
| `learn` | Extraction only |
| `validate` | Validation only |
| `insights` | Get summary (no processing) |
| `style-mine` | Run style miner (accepts `passes`, `group`) |
| `style-mine-status` | Get style intelligence status |

---

## 9. Data Retention

### Smart Cleanup Philosophy

```
┌─────────────────────────────────────────────────────┐
│                DATA RETENTION POLICY                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  PROVEN/EMERGING MarketData                         │
│  ├─ Retention: 180 days (6 months)                  │
│  └─ Reason: Valuable for pattern learning           │
│                                                      │
│  MOONSHOT MarketData                                │
│  ├─ Retention: 30 days                              │
│  └─ Reason: Viral data is time-sensitive            │
│                                                      │
│  SUCCESSFUL DESIGN SOURCE DATA                      │
│  ├─ Retention: NEVER deleted                        │
│  └─ Reason: Linked to approved/sold designs         │
│                                                      │
│  ProvenInsight                                      │
│  ├─ Retention: PERMANENT                            │
│  └─ Reason: Core knowledge, compounds over time     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Cleanup Implementation

```typescript
// From trend-collector.ts

export async function cleanOldMarketData() {
  // 1. Find IDs of data linked to successful designs
  const successfulDesigns = await prisma.merchDesign.findMany({
    where: {
      OR: [
        { approved: true },
        { sales: { gt: 0 } },
        { userRating: { gte: 4 } },
      ],
      sourceData: { not: Prisma.DbNull },
    },
    select: { sourceData: true },
  });

  // 2. Extract preserved IDs
  const preservedIds = new Set<string>();
  for (const design of successfulDesigns) {
    const sourceData = design.sourceData as any;
    if (sourceData?.marketDataId) {
      preservedIds.add(sourceData.marketDataId);
    }
  }

  // 3. Delete old data (except preserved)
  await prisma.marketData.deleteMany({
    where: {
      category: { in: ['proven', 'emerging'] },
      createdAt: { lt: provenEmergingCutoff }, // 180 days
      id: { notIn: Array.from(preservedIds) },
    },
  });

  await prisma.marketData.deleteMany({
    where: {
      category: 'moonshot',
      createdAt: { lt: moonshotCutoff }, // 30 days
      id: { notIn: Array.from(preservedIds) },
    },
  });
}
```

---

## 10. Troubleshooting

### Common Issues

#### Job Times Out

**Symptom:** Job returns 504 or incomplete response.

**Solution:**
- All jobs have `maxDuration = 300` (5 minutes)
- If still timing out, reduce query count
- Check Vercel dashboard for execution time

---

#### No Data Being Collected

**Symptom:** `stats.proven: 0, stats.emerging: 0`

**Possible Causes:**
1. API keys missing (GEMINI_API_KEY, GROK_API_KEY, BRAVE_API_KEY)
2. Rate limiting from upstream APIs
3. Network errors

**Debug:**
```bash
# Check Vercel logs
vercel logs --filter /api/cron/collect-trends
```

---

#### Learning Not Creating Insights

**Symptom:** `insightsCreated: 0` every week

**Possible Causes:**
1. Not enough designs (need 10+ per pattern)
2. All designs marked as `isTest: true`
3. Patterns not meeting time period requirement

**Check:**
```sql
-- Count non-test designs
SELECT COUNT(*) FROM "MerchDesign" WHERE "isTest" = false;

-- Check date distribution
SELECT DATE_TRUNC('week', "createdAt") as week, COUNT(*)
FROM "MerchDesign"
WHERE "isTest" = false
GROUP BY week
ORDER BY week DESC
LIMIT 10;
```

---

#### Insights Being Invalidated Too Fast

**Symptom:** High `invalidated` count in validation results

**Possible Causes:**
1. Market shift - patterns genuinely no longer work
2. Not enough recent data for validation
3. Threshold too aggressive

**Adjust:**
```typescript
// In insight-validator.ts
const VALIDATION_SUCCESS_THRESHOLD = 0.7; // Lower this to be more lenient
```

---

### Monitoring Recommendations

1. **Log Review:** Check Vercel logs after each scheduled run
2. **Summary Endpoint:** Use `{"action": "insights"}` to get current state
3. **Alerts:** Set up monitoring for failed cron jobs
4. **Database Size:** Monitor MarketData table growth

### Log Patterns

```
[Cron] Starting trend collection
[TrendCollector] Starting proven collection (10 queries)
[TrendCollector] Searching: "nurse gifts trending"
[TrendCollector] Saved 5 trends for "nurse gifts trending"
...
[Cron] Collection complete in 45230ms
```

```
[Cron] Starting weekly learning cycle
[Cron] Step 1: Extracting insights...
[InsightExtractor] Analyzing 150 designs for phrase patterns
[InsightExtractor] Created 2 phrase pattern insights
...
[Cron] 🎉 New insights discovered: 3
[Cron] Learning cycle complete in 23450ms
```

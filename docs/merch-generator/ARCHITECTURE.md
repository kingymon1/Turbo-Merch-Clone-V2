# Merch Generator Architecture

> **Last Updated:** December 2024
> **Version:** Phase 7B Complete

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Schema](#2-database-schema)
3. [Phase-by-Phase Build History](#3-phase-by-phase-build-history)
4. [Data Flow Diagrams](#4-data-flow-diagrams)
5. [Key Design Decisions](#5-key-design-decisions)
6. [File Structure](#6-file-structure)
7. [API Endpoints](#7-api-endpoints)
8. [Configuration](#8-configuration)
9. [Marketplace Intelligence Integration (Phase 7A)](#9-marketplace-intelligence-integration-phase-7a)
10. [Merch Validation System (Phase 7B)](#10-merch-validation-system-phase-7b)

---

## 1. System Overview

### What It Does

The Merch Generator creates AI-powered T-shirt designs with matching marketplace listings. It combines:

- **Multi-agent trend research** (Grok, Brave, Google) to find what's trending NOW
- **AI image generation** (Gemini Imagen) to create print-ready designs
- **SEO-optimized listing generation** for Amazon/Etsy success
- **Machine learning** to improve over time based on what works

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **Autopilot Mode** | AI selects trending topics based on risk level (0-100) |
| **Manual Mode** | User specifies exact phrase, style, tone |
| **Dominate Feature** | Generate 3-10 variations to dominate a niche |
| **Learning System** | Extracts proven patterns, applies to future generations |

### The 3-Agent Research Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1: PARALLEL DISCOVERY                   │
│                 (3 Independent Agents - No Influence)            │
├───────────────────┬───────────────────┬─────────────────────────┤
│   GOOGLE AGENT    │    BRAVE AGENT    │       GROK AGENT        │
│                   │                   │                         │
│  "What's in the   │  "What are people │  "What's happening on   │
│   news today?"    │   searching for   │   X/Twitter right now?" │
│                   │   and discussing?"│                         │
└─────────┬─────────┴─────────┬─────────┴────────────┬────────────┘
          │                   │                      │
          ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2: THE MEETING                          │
│                                                                  │
│  All 3 agents present INDEPENDENT findings to Gemini            │
│  Gemini synthesizes and identifies best opportunities           │
│                                                                  │
│  Output: TrendData with customer language, visual direction     │
└─────────────────────────────────────────────────────────────────┘
```

### Risk Levels

| Level | Name | Time Window | Strategy |
|-------|------|-------------|----------|
| 0-25 | **Safe** | Past month | Proven evergreen niches |
| 25-50 | **Balanced** | Past 1-2 weeks | Established + rising trends |
| 50-75 | **Aggressive** | Past week | Emerging trends |
| 75-100 | **Moonshot** | Past 1-2 days | Early viral signals |

---

## 2. Database Schema

### Our 4 Models

#### MerchDesign
The primary design entity.

```prisma
model MerchDesign {
  id              String    @id @default(cuid())
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // User association
  userId          String?
  clerkId         String?

  // Generation mode
  mode            String    // 'autopilot' | 'manual'
  riskLevel       Int?      // 0-100 for autopilot
  userSpecs       Json?     // ManualSpecs for manual mode

  // Generated content
  phrase          String
  niche           String
  style           String?
  tone            String?
  imagePrompt     String?   @db.Text
  imageUrl        String?
  listingTitle    String?
  listingBullets  String[]
  listingDescription String? @db.Text
  keywords        String[]

  // Performance tracking
  approved        Boolean   @default(false)
  userRating      Int?      // 1-5
  views           Int       @default(0)
  sales           Int       @default(0)

  // Source data for learning
  sourceData      Json?     // TrendData, appliedInsights

  // Variation support (Dominate feature)
  parentId        String?
  parent          MerchDesign?  @relation("Variations", fields: [parentId])
  variations      MerchDesign[] @relation("Variations")
}
```

#### ProvenInsight
Permanent knowledge repository - the brain of the learning system.

```prisma
model ProvenInsight {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Classification
  insightType     String   // 'phrase-pattern' | 'niche-timing' |
                           // 'style-effectiveness' | 'listing-structure' | 'cross-niche'
  category        String   // 'evergreen' | 'seasonal' | 'design' | 'listing' | 'approval'

  // Content
  title           String
  description     String   @db.Text
  pattern         Json     // Flexible structure per type

  // Statistical confidence
  sampleSize      Int
  confidence      Float    // 0-1 (0.8+ = high confidence)
  successRate     Float?
  avgPerformance  Json?

  // Applicability
  niche           String?
  niches          String[]
  timeframe       String?
  riskLevel       String?

  // Lifecycle
  lastValidated   DateTime @default(now())
  timesValidated  Int      @default(1)
  stillRelevant   Boolean  @default(true)
  supersededBy    String?

  // Traceability
  sourceDataIds   String[]
}
```

#### MarketData
Raw trend data collected by background jobs.

```prisma
model MarketData {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())

  category    String   // 'proven' | 'emerging' | 'moonshot'
  source      String   // 'grok' | 'brave' | 'google' | 'multi-agent'
  niche       String?

  trendData   Json     // Full TrendData object
  rawResponse Json?

  searchQuery   String?
  viralityLevel Int?
}
```

#### NicheTrend
Aggregated metrics for niche performance.

```prisma
model NicheTrend {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  niche       String   @unique
  category    String   // 'profession' | 'hobby' | 'pet' | 'lifestyle'

  trendData   Json     // Array of TrendData
  phrases     String[]
  keywords    String[]
  styles      String[]

  totalDesigns    Int   @default(0)
  approvedDesigns Int   @default(0)
  avgRating       Float?
  totalSales      Int   @default(0)
}
```

### Data Retention

| Data Type | Retention | Reason |
|-----------|-----------|--------|
| ProvenInsight | **Permanent** | Core knowledge, never deleted |
| MarketData (proven/emerging) | 180 days | Long-term analysis |
| MarketData (moonshot) | 30 days | Viral data is time-sensitive |
| Successful design source | **Never deleted** | Linked to approved designs |

---

## 3. Phase-by-Phase Build History

### Phase 1-2: Foundation

**What was built:**
- MerchDesign model
- Basic generation flow
- UI components

### Phase 3: Real AI Generation

**What was built:**
- Gemini integration for text + image
- Multi-agent trend research (Grok + Brave + Google)
- R2 storage for images
- Listing generation

**Key files:**
```
services/geminiService.ts     - Multi-agent orchestration
lib/merch/image-generator.ts  - Image generation
lib/merch/listing-generator.ts - SEO listings
```

### Phase 4: Dominate Feature

**What was built:**
- Variation generation (3-10 unique designs)
- AI-powered variation strategies
- Parent-child relationships
- ZIP export

**Key files:**
```
lib/merch/variation-generator.ts  - Orchestration
lib/merch/variation-strategy.ts   - AI strategies
lib/merch/download-helper.ts      - Export utilities
```

### Phase 5: Market Intelligence Caching

**What was built:**
- Background data collection (cron jobs)
- MarketData and NicheTrend models
- 90% API cost reduction via caching

**Key files:**
```
lib/merch/data-collectors/trend-collector.ts  - Collection
lib/merch/data-collectors/niche-analyzer.ts   - Analysis
```

**The caching flow:**
```
Autopilot → Check hasRecentData()
              ↓
         YES: Use cache (FREE!)
         NO:  Fall back to live API
```

### Phase 6: Learning System

**What was built:**
- ProvenInsight model (permanent knowledge)
- Insight extraction with Wilson Score
- Risk-aware insight application
- Weekly learning cron job

**Key files:**
```
lib/merch/learning/insight-extractor.ts  - Pattern extraction
lib/merch/learning/insight-validator.ts  - Validation
lib/merch/learning/insight-applier.ts    - Application
```

**Insight Types:**

| Type | What It Captures |
|------|------------------|
| `phrase-pattern` | High-performing phrase structures |
| `style-effectiveness` | Style + niche combinations |
| `niche-timing` | Seasonal patterns |
| `listing-structure` | Title/bullet patterns |
| `cross-niche` | Fusion opportunities |

**Risk-aware application:**
```
0-30 (Safe)     → Insights as CONSTRAINTS
30-70 (Balanced)→ Insights as SUGGESTIONS
70-100 (Risky)  → Failed patterns as WARNINGS
```

---

## 4. Data Flow Diagrams

### Autopilot Generation

```
User clicks "Generate" with Risk Level
              │
              ▼
┌─────────────────────────────────┐
│  [Phase 6] applyInsightsToGeneration()
│  Returns: recommendedStyles,    │
│  phraseTemplates, warnings      │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  [Phase 5] Check hasRecentData()│
└───────┬─────────────┬───────────┘
    YES ▼         NO  ▼
┌───────────────┐ ┌───────────────┐
│ Use cache     │ │ searchTrends()│
│ (FREE!)       │ │ 3 agents      │
└───────┬───────┘ └───────┬───────┘
        └────────┬────────┘
                 ▼
┌─────────────────────────────────┐
│  extractDesignConcept()         │
│  Apply insight-recommended styles
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  generateMerchImage()           │
│  generateMerchListing()         │
│  Save MerchDesign               │
└─────────────────────────────────┘
```

### Weekly Learning Job

```
POST /api/cron/learn-and-extract (Sunday 4AM)
              │
              ▼
┌─────────────────────────────────┐
│  extractAllInsights()           │
│  • Query successful designs     │
│  • Calculate Wilson Scores      │
│  • Create ProvenInsight records │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  validateAllInsights()          │
│  • Test against recent data     │
│  • Update confidence scores     │
│  • Mark deprecated insights     │
└─────────────────────────────────┘
```

### Dominate Feature

```
User selects design → "Dominate This Niche"
              │
              ▼
┌─────────────────────────────────┐
│  For each variation (3-10):     │
│  • generateVariationStrategy()  │
│  • Different phrase/style/layout│
│  • generateMerchImage()         │
│  • Save with parentId           │
└─────────────────────────────────┘
```

---

## 5. Key Design Decisions

### Why Gemini?

| Factor | Reason |
|--------|--------|
| Image Generation | Native Imagen integration |
| Google Search | Can search Google for trends |
| Multimodal | Single API for text + image |

### Why AI Variations, Not Templates?

- Users need **unique** designs to avoid Amazon saturation
- AI adapts to **current trends**
- Each variation looks like a different designer made it

### Why Caching?

```
Live API Cost:    ~$0.04/design
With 90% Cache:   ~$0.004/design
Savings:          90%
```

### Why Wilson Score?

Handles small sample sizes correctly:
```
2/2 = 100% → Wilson: 0.34 (unreliable)
80/100 = 80% → Wilson: 0.72 (reliable)
```

### Why ProvenInsights Are Permanent?

- Never lose learned patterns
- Track evolution via `supersededBy`
- Analyze how trends change over time

---

## 6. File Structure

```
lib/merch/
├── autopilot-generator.ts    # Autopilot orchestration
├── manual-generation.ts      # Manual mode
├── image-prompter.ts         # Prompt building
├── image-generator.ts        # Gemini Imagen
├── listing-generator.ts      # SEO listings
├── variation-generator.ts    # Dominate feature
├── variation-strategy.ts     # Variation AI
├── download-helper.ts        # Export utilities
├── types.ts                  # TypeScript types
│
├── data-collectors/          # Phase 5: Caching
│   ├── index.ts
│   ├── trend-collector.ts    # Data collection
│   └── niche-analyzer.ts     # Niche analysis
│
├── learning/                 # Phase 6: Learning
│   ├── index.ts
│   ├── insight-extractor.ts  # Pattern extraction
│   ├── insight-validator.ts  # Validation
│   └── insight-applier.ts    # Application logic
│
└── validation/               # Phase 7B: Validation
    ├── index.ts              # Barrel export
    ├── banned-words.ts       # 200+ banned words
    ├── ascii-cleaner.ts      # Unicode → ASCII
    └── listing-validator.ts  # Main validator
```

---

## 7. API Endpoints

### Generation

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/merch/generate` | POST | Generate design (autopilot/manual) |
| `/api/designs/generate-variations` | POST | Dominate feature |

### Cron Jobs

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/collect-trends` | Every 6h | Collect market data |
| `/api/cron/analyze-niches` | Daily | Analyze niche performance |
| `/api/cron/moonshot-trends` | Every 4h | Hunt viral trends |
| `/api/cron/learn-and-extract` | Weekly | Extract insights |

### Admin

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/trigger-collection` | POST | Manual data collection |
| `/api/admin/insights` | GET/POST | Manage insights |
| `/api/admin/insights/[id]` | GET/PUT/DELETE | Single insight |

---

## 8. Configuration

### Niche Pools

```typescript
const NICHE_POOLS = {
  low: [  // Safe (0-25)
    'nurse gifts', 'teacher appreciation', 'dog mom',
    'cat lover', 'coffee addict', 'dad jokes',
    'mom life', 'gaming', 'fishing', 'camping',
  ],
  medium: [  // Balanced (25-70)
    'work from home', 'plant mom', 'true crime',
    'book lover', 'yoga life', 'mental health',
  ],
  high: [  // Risky (70-100)
    'trending memes', 'viral tiktok', 'gen z humor',
    'chronically online', 'pop culture moments',
  ],
};
```

### Insight Thresholds

```typescript
const MIN_SAMPLE_SIZE = 10;   // Minimum designs to form insight
const MIN_CONFIDENCE = 0.8;   // Wilson score threshold
```

### Cron Schedule (vercel.json)

```json
{
  "crons": [
    { "path": "/api/cron/collect-trends", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/analyze-niches", "schedule": "0 2 * * *" },
    { "path": "/api/cron/moonshot-trends", "schedule": "0 */4 * * *" },
    { "path": "/api/cron/learn-and-extract", "schedule": "0 4 * * 0" }
  ]
}
```

---

## 9. Marketplace Intelligence Integration (Phase 7A)

### Overview

Phase 7A connects the existing Decodo/marketplace scraping system to the listing generator, injecting proven keywords from successful MBA (Merch by Amazon) products into listing generation.

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│           MARKETPLACE INTELLIGENCE DATA FLOW                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SCRAPING (Background/Manual)                                │
│     ├── POST /api/marketplace/scrape                            │
│     ├── POST /api/marketplace/trending                          │
│     └── Data stored in MarketplaceProduct + NicheMarketData     │
│                                                                  │
│  2. LEARNING (Automatic)                                        │
│     ├── runLearningEngine() extracts patterns                   │
│     ├── Identifies MBA products via detectMerchByAmazon()       │
│     └── Extracts keywords via extractLongTailKeywords()         │
│                                                                  │
│  3. RETRIEVAL (On-Demand)                                       │
│     ├── getOptimizedKeywordsForNiche(niche)                     │
│     └── Returns: primaryKeywords, longTailPhrases, patterns     │
│                                                                  │
│  4. INJECTION (During Generation)                               │
│     ├── listing-generator.ts queries marketplace data           │
│     ├── autopilot-generator.ts merges with trend keywords       │
│     └── Enhanced listings with proven MBA keywords              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `getOptimizedKeywordsForNiche()` | marketplaceLearning.ts | Returns proven keywords for a niche |
| `getQuickKeywordSuggestions()` | marketplaceLearning.ts | Fast keyword suggestions for autocomplete |
| `enhanceTrendWithMarketplace()` | autopilot-generator.ts | Merges trend + marketplace keywords |
| `buildMarketplaceContextForAI()` | listing-generator.ts | Creates AI context with patterns |

### OptimizedKeywords Interface

```typescript
interface OptimizedKeywords {
  niche: string;
  primaryKeywords: string[];      // Top performing single keywords
  longTailPhrases: string[];      // 3+ word phrases from successful listings
  titlePatterns: string[];        // Example titles from top sellers
  effectiveBrands: string[];      // Brand naming patterns that work
  priceGuidance: {
    optimal: number;
    range: { min: number; max: number };
  };
  mbaInsights: {
    productCount: number;         // How many MBA products in this niche
    avgTitleLength: number;       // Average title character count
    commonTones: string[];        // funny, inspirational, etc.
  };
  saturation: string;             // low, medium, high, oversaturated
  entryRecommendation: string;    // enter, caution, avoid
  confidence: number;             // 0-100 based on data quality
  lastUpdated: Date;
}
```

### Graceful Degradation

The system gracefully handles missing marketplace data:

1. **Database not configured** → Standard generation (no marketplace data)
2. **No data for niche** → Standard generation (logs warning)
3. **Low confidence data** (<30%) → Standard generation (data ignored)
4. **Good confidence data** (30%+) → Enhanced generation with marketplace keywords

### Testing Endpoint

```bash
# Test if marketplace data exists for a niche
curl -X POST http://localhost:3000/api/marketplace/keywords \
  -H "Content-Type: application/json" \
  -d '{"niche": "nurse gifts"}'

# Quick keyword suggestions only
curl -X POST http://localhost:3000/api/marketplace/keywords \
  -H "Content-Type: application/json" \
  -d '{"niche": "dog mom", "quick": true}'
```

### Usage in Listing Generator

```typescript
// listing-generator.ts automatically queries marketplace data
const result = await generateMerchListing(phrase, niche, tone, style);

// Result includes:
// - marketplaceEnhanced: boolean (whether marketplace data was used)
// - marketplaceConfidence: number (0-100)
```

### Usage in Autopilot Mode

```typescript
// autopilot-generator.ts merges trends + marketplace
const result = await generateAutopilotConcept(riskLevel);

// Result includes:
// - trend.keywords (merged with marketplace keywords)
// - trend.marketplaceContext (AI-consumable context string)
// - marketplaceData (full OptimizedKeywords object)
```

### Confidence Calculation

Confidence is calculated based on data quality:

| Factor | Points |
|--------|--------|
| 100+ total products | +30 |
| 50-99 total products | +20 |
| 20-49 total products | +10 |
| 20+ MBA products | +30 |
| 10-19 MBA products | +20 |
| 5-9 MBA products | +10 |
| 15+ top performers | +25 |
| 10-14 top performers | +15 |
| 5-9 top performers | +10 |
| Any MBA products | +15 |

**Maximum: 100 points**

### Data Freshness

- Marketplace data is cached in the database
- `lastAnalyzed` timestamp tracks when learning engine last processed
- Recommended to run `/api/marketplace/trending` weekly
- Individual niche scrapes via `/api/marketplace/scrape` as needed

---

## Quick Reference: Key Interfaces

```typescript
interface TrendData {
  topic: string;
  platform: string;
  volume: string;
  sentiment: string;
  keywords: string[];
  customerPhrases: string[];
  visualStyle: string;
  designText?: string;
  marketplaceContext?: string;  // Phase 7A: Learned patterns from MBA
}

interface DesignConcept {
  phrase: string;
  niche: string;
  style: string;
  tone: string;
}

interface InsightGuidance {
  recommendedStyles: string[];
  recommendedTones: string[];
  phraseTemplates: string[];
  warnings: string[];
  appliedInsights: AppliedInsight[];
}
```

---

## 10. Merch Validation System (Phase 7B)

### Overview

Phase 7B adds a dedicated validation layer for Amazon Merch on Demand listings. This is a **separate system** from the existing `services/compliance.ts` to avoid migration risks and provide merch-specific validation.

### Why Separate From compliance.ts?

| Reason | Details |
|--------|---------|
| **Different limits** | Merch: 500 char description. General: 2000 char |
| **Exactly 2 bullets** | Merch requirement vs flexible |
| **More banned words** | 200+ merch-specific vs 70+ general |
| **No migration risk** | Existing integrations unchanged |
| **Better testing** | Can test in isolation |

### File Structure

```
lib/merch/validation/
├── index.ts              # Barrel export
├── banned-words.ts       # 200+ banned words by category
├── ascii-cleaner.ts      # Unicode → ASCII conversion
└── listing-validator.ts  # Main validation logic
```

### Character Limits (Merch-Specific)

| Field | Min | Max | Notes |
|-------|-----|-----|-------|
| Title | 40 | 60 | No product type words |
| Brand | 1 | 50 | Unique micro-brand |
| Bullet | 180 | 256 | Feature/benefit focused |
| Description | 100 | 500 | Merch limit (not 2000) |

### Banned Words Categories

| Category | Count | Examples |
|----------|-------|----------|
| Apparel | 28 | design, shirt, gift, merch |
| Health/Medical | 56 | cure, cancer, anxiety |
| Promotional | 43 | best seller, discount, sale |
| Quality Claims | 41 | certified, proven, premium |
| Sales Pressure | 38 | buy now, limited time |
| Trademarks | 80+ | Nike, Disney, Pokemon |
| Service Promises | 27 | free shipping, guarantee |
| Material Claims | 19 | organic, eco friendly |
| Inappropriate | 44 | explicit, violence, drugs |

### Validation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│           PHASE 7B VALIDATION FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. PRE-VALIDATION (Autopilot)                                  │
│     ├── extractDesignConcept() cleans phrase                    │
│     ├── findBannedWords() checks phrase/niche                   │
│     └── cleanToAscii() normalizes text                          │
│                                                                  │
│  2. GENERATION                                                   │
│     ├── Gemini generates listing content                        │
│     └── Raw listing may contain banned words/Unicode            │
│                                                                  │
│  3. POST-VALIDATION (Listing Generator)                         │
│     ├── validateMerchListing() runs all checks                  │
│     ├── Removes banned words automatically                      │
│     ├── Truncates at word boundaries                            │
│     └── Returns cleaned listing + validation status             │
│                                                                  │
│  4. RESULT                                                       │
│     ├── cleanedListing: Ready for Amazon                        │
│     ├── errors: Blocking issues found                           │
│     ├── warnings: Non-blocking suggestions                      │
│     └── stats: What was changed                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Points

```typescript
// listing-generator.ts
import { validateMerchListing } from './validation';

const rawListing = {
  title: listing.title,
  brand: listing.brand,
  bullets: bullets.slice(0, 2),  // Merch: exactly 2 bullets
  description: listing.description,
};

const result = validateMerchListing(rawListing);

return {
  ...result.cleanedListing,
  validation: {
    valid: result.valid,
    errors: result.errors,
    warnings: result.warnings,
  },
};
```

```typescript
// autopilot-generator.ts
import { cleanToAscii, findBannedWords } from './validation';

let phrase = cleanToAscii(rawPhrase);
const banned = findBannedWords(phrase);

if (banned.length > 0) {
  console.log(`[Autopilot] Removing banned words: ${banned.join(', ')}`);
  // Remove banned words before generation
}
```

### Testing Endpoint

```bash
# POST /api/merch/validate - Test a listing
curl -X POST http://localhost:3000/api/merch/validate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Coffee Lover Morning Brew Caffeine Espresso Bean",
    "brand": "Urban Brew Collective",
    "bullets": ["For true coffee enthusiasts...", "The perfect way..."],
    "description": "Show your love for coffee with this bold design..."
  }'

# GET /api/merch/validate - Get system info
curl http://localhost:3000/api/merch/validate
```

### Relationship to compliance.ts

```
┌─────────────────────────────────────────────────────────────────┐
│                 services/compliance.ts                           │
│               (General Compliance - UNCHANGED)                   │
│                                                                  │
│  Used by: geminiService.ts, trend-lab API                       │
│  Features: 70+ banned words, 2000 char desc limit               │
└─────────────────────────────────────────────────────────────────┘
                              │
                     (Runs independently)
                              │
┌─────────────────────────────────────────────────────────────────┐
│                lib/merch/validation/                             │
│            (Merch-Specific - Phase 7B NEW)                       │
│                                                                  │
│  Used by: listing-generator.ts, autopilot-generator.ts          │
│  Features: 200+ banned words, 500 char desc limit, 2 bullets    │
└─────────────────────────────────────────────────────────────────┘
```

Both systems run independently. The merch validation system provides specialized validation for Amazon Merch on Demand requirements.

### Documentation

See `docs/merch-generator/MERCH_VALIDATION.md` for complete details on:
- All banned word categories
- ASCII conversion rules
- Usage examples
- API endpoint documentation

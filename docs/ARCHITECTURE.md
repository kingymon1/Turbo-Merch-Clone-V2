# TurboMerch Architecture Documentation

> **Last Updated:** December 2024
> **Version:** Phase 6 Complete
> **Purpose:** Comprehensive technical documentation for the Merch Design Generator system

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Schema](#2-database-schema)
3. [Phase-by-Phase Build History](#3-phase-by-phase-build-history)
4. [Data Flow Diagrams](#4-data-flow-diagrams)
5. [Key Design Decisions](#5-key-design-decisions)
6. [File Structure & Organization](#6-file-structure--organization)
7. [API Reference](#7-api-reference)
8. [Configuration & Constants](#8-configuration--constants)

---

## 1. System Overview

### What This System Does

TurboMerch is an AI-powered merchandise design generator that creates print-on-demand T-shirt designs with matching Amazon/Etsy listings. The system combines:

- **Multi-agent trend research** (Grok, Brave, Google) to find what's trending NOW
- **AI image generation** (Gemini Imagen) to create print-ready designs
- **SEO-optimized listing generation** for marketplace success
- **Machine learning** to improve over time based on what works

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **Autopilot Mode** | AI selects trending topics based on risk level (0-100), generates designs automatically |
| **Manual Mode** | User specifies exact phrase, style, tone - AI respects specifications |
| **Dominate Feature** | Generate 3-10 variations of a winning design to dominate a niche |
| **Learning System** | Extracts proven patterns from historical data, applies them to future generations |

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
│  Source:          │  Sources:         │  Sources:               │
│  Google Search    │  • Web Search     │  • Live X posts         │
│  (via Gemini)     │  • News API       │  • News                 │
│                   │  • Discussions    │  • Web                  │
│                   │    (Reddit, etc)  │                         │
└─────────┬─────────┴─────────┬─────────┴────────────┬────────────┘
          │                   │                      │
          ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2: THE MEETING                          │
│                                                                  │
│  All 3 agents present their INDEPENDENT findings to Gemini      │
│  Gemini synthesizes, cross-references, and identifies the       │
│  best opportunities based on the selected risk level            │
│                                                                  │
│  Output: 3-6 TrendData objects with customer language,          │
│          visual direction, and design recommendations           │
└─────────────────────────────────────────────────────────────────┘
```

### Risk Levels Explained

| Level | Name | Time Window | Strategy |
|-------|------|-------------|----------|
| 0-25 | **Safe** | Past month | Proven evergreen niches with consistent demand |
| 25-50 | **Balanced** | Past 1-2 weeks | Mix of established trends and rising opportunities |
| 50-75 | **Aggressive** | Past week | Chasing momentum and emerging trends |
| 75-100 | **Moonshot** | Past 1-2 days | Early viral signals, maximum risk/reward |

---

## 2. Database Schema

### Entity Relationship Overview

```
┌─────────────┐
│    User     │ ←── Clerk Authentication
└──────┬──────┘
       │
       ├──→ UsageTracking (monthly allowance, overages)
       ├──→ DesignHistory (all generated designs)
       ├──→ MerchDesign (new standalone format)
       ├──→ BillingRecord (invoices)
       └──→ StorageAddon (extended retention)

┌──────────────────────┐
│    MerchDesign       │ ←── Core design entity
└──────────┬───────────┘
           │
           └──→ MerchDesign[] (self-referential for variations)

┌──────────────────────┐
│   ProvenInsight      │ ←── Learning system (PERMANENT)
└──────────────────────┘
  Types: phrase-pattern, style-effectiveness,
         niche-timing, listing-structure, cross-niche

┌──────────────────────┐
│     MarketData       │ ←── Raw trend collection
└──────────────────────┘
  Categories: proven, emerging, moonshot

┌──────────────────────┐
│     NicheTrend       │ ←── Aggregated niche metrics
└──────────────────────┘
  Categories: profession, hobby, pet, lifestyle, etc.
```

### Core Models

#### MerchDesign
The primary design entity for the standalone Merch Generator.

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
  sourceData      Json?     // TrendData, appliedInsights, etc.

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
  niche           String?  // Single niche or null for general
  niches          String[] // Multiple niches
  timeframe       String?  // 'always' | 'seasonal' | 'trending'
  riskLevel       String?  // 'proven' | 'emerging' | 'moonshot'

  // Lifecycle
  lastValidated   DateTime @default(now())
  timesValidated  Int      @default(1)
  stillRelevant   Boolean  @default(true)
  supersededBy    String?  // ID of newer insight

  // Traceability
  sourceDataIds   String[] // IDs of source designs/products
}
```

#### MarketData
Raw trend data collected by background jobs.

```prisma
model MarketData {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())

  // Classification
  category    String   // 'proven' | 'emerging' | 'moonshot'
  source      String   // 'grok' | 'brave' | 'google' | 'multi-agent'
  niche       String?

  // Content
  trendData   Json     // Full TrendData object
  rawResponse Json?    // Original API response

  // Metadata
  searchQuery String?
  viralityLevel Int?
}
```

#### NicheTrend
Aggregated metrics for niche performance tracking.

```prisma
model NicheTrend {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  niche       String   @unique
  category    String   // 'profession' | 'hobby' | 'pet' | 'lifestyle' | etc.

  // Collected data
  trendData   Json     // Array of TrendData
  phrases     String[]
  keywords    String[]
  styles      String[]

  // Performance metrics
  totalDesigns    Int   @default(0)
  approvedDesigns Int   @default(0)
  avgRating       Float?
  totalSales      Int   @default(0)
}
```

### Data Retention Strategy

| Data Type | Retention | Reason |
|-----------|-----------|--------|
| ProvenInsight | **Permanent** | Core knowledge, never deleted |
| MarketData (proven/emerging) | 180 days | Long-term trend analysis |
| MarketData (moonshot) | 30 days | Viral data is time-sensitive |
| Successful design source data | **Never deleted** | Linked to approved designs |
| ResearchCache | 24-48 hours | API cost reduction |

---

## 3. Phase-by-Phase Build History

### Phase 1-2: Foundation & UI

**What was built:**
- Next.js App Router setup with TypeScript
- Clerk authentication integration
- Basic UI components (design card, generation form)
- Prisma schema with User, DesignHistory models
- Stripe subscription integration

**Key files created:**
- `app/layout.tsx` - Root layout with Clerk provider
- `app/page.tsx` - Main application page
- `lib/prisma.ts` - Database client
- `components/` - UI component library

### Phase 3: Real AI Generation

**What was built:**
- Gemini integration for text and image generation
- Multi-agent trend research system (Grok + Brave + Google)
- Image generation with Gemini Imagen
- Listing generation with SEO optimization
- R2 storage for generated images

**Key files created:**
- `services/geminiService.ts` - Core AI orchestration
- `app/api/gemini/` - AI endpoint routes
- `app/api/brave-search/` - Brave API proxy
- `app/api/grok/` - Grok API integration
- `lib/r2-storage.ts` - Cloudflare R2 client

**Architecture decision:** Three independent agents search in parallel, then Gemini synthesizes findings. This maximizes diversity and catches trends from multiple angles.

### Phase 4: Dominate Feature

**What was built:**
- Variation generation (3-10 unique designs from one concept)
- AI-powered variation strategies
- Parent-child design relationships
- Batch download as ZIP

**Key files created:**
- `lib/merch/variation-generator.ts` - Variation orchestration
- `lib/merch/variation-strategy.ts` - AI strategy generation
- `lib/merch/download-helper.ts` - Export utilities
- `app/api/designs/generate-variations/` - Variation endpoint

**How it works:**
1. User selects a winning design
2. AI generates unique strategies (different phrase, style, layout, colors)
3. Each variation is generated independently
4. All variations saved with parent reference

### Phase 5: Market Intelligence Caching

**What was built:**
- Background data collection (cron jobs)
- MarketData and NicheTrend models
- Smart caching to reduce API costs by ~90%
- Fallback to live API when cache misses

**Key files created:**
- `lib/merch/data-collectors/trend-collector.ts` - Data collection
- `lib/merch/data-collectors/niche-analyzer.ts` - Niche analysis
- `app/api/cron/collect-trends/` - Collection cron
- `app/api/cron/analyze-niches/` - Analysis cron
- `app/api/admin/trigger-collection/` - Manual trigger

**Data flow:**
```
Cron Job (every 6 hours)
    ↓
collectTrendData('proven' | 'emerging' | 'moonshot')
    ↓
searchTrends() with appropriate virality level
    ↓
Store in MarketData table
    ↓
Autopilot checks hasRecentData() first
    ↓
If cached → use cache (FREE!)
If not → fall back to live API
```

### Phase 6: Learning System with ProvenInsights

**What was built:**
- ProvenInsight model for permanent knowledge
- Insight extraction engine with Wilson Score statistics
- Insight validation system
- Risk-aware insight application
- Weekly learning cron job

**Key files created:**
- `lib/merch/learning/insight-extractor.ts` - Extraction engine
- `lib/merch/learning/insight-validator.ts` - Validation system
- `lib/merch/learning/insight-applier.ts` - Application logic
- `lib/merch/learning/index.ts` - Module exports
- `app/api/cron/learn-and-extract/` - Weekly learning job
- `app/api/admin/insights/` - Insight management API

**Insight Types:**

| Type | What It Captures | Example |
|------|------------------|---------|
| `phrase-pattern` | High-performing phrase structures | "{topic} Mode: ON" works for professions |
| `style-effectiveness` | Style + niche combinations | "Vintage Retro" has 85% approval for coffee niches |
| `niche-timing` | Seasonal patterns | "Teacher" peaks Aug-Sep (back to school) |
| `listing-structure` | Title/bullet patterns | Titles with emoji have 20% higher CTR |
| `cross-niche` | Fusion opportunities | "Dog Mom" + "Coffee" = untapped combo |

**How insights are applied:**

```
Risk Level → Insight Application Strategy
─────────────────────────────────────────
0-30 (Safe)     → High-confidence insights as CONSTRAINTS
                  (must follow proven patterns)

30-70 (Balanced)→ Mixed insights as SUGGESTIONS
                  (consider but can deviate)

70-100 (Risky)  → Failed patterns as ANTI-PATTERNS
                  (warnings about what NOT to do)
```

---

## 4. Data Flow Diagrams

### Autopilot Generation Flow

```
User clicks "Generate" with Risk Level
              │
              ▼
┌─────────────────────────────────┐
│  generateAutopilotConcept()    │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  [Phase 6] applyInsightsToGeneration()
│  Query ProvenInsights for:      │
│  • niche                        │
│  • riskLevel                    │
│  • current month                │
│                                 │
│  Returns:                       │
│  • recommendedStyles[]          │
│  • recommendedTones[]           │
│  • phraseTemplates[]            │
│  • warnings[]                   │
│  • appliedInsights[]            │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  [Phase 5] Check hasRecentData()│
│  Is there cached market data?   │
└───────┬─────────────┬───────────┘
        │             │
    YES ▼         NO  ▼
┌───────────────┐ ┌───────────────┐
│ getRecentData │ │ searchTrends()│
│ from cache    │ │ Live API call │
│ (FREE!)       │ │ 3 agents      │
└───────┬───────┘ └───────┬───────┘
        │                 │
        └────────┬────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  extractDesignConcept()         │
│  Apply insight-recommended      │
│  styles if available            │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  generateMerchImage()           │
│  Gemini Imagen creates design   │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  generateMerchListing()         │
│  SEO-optimized title, bullets   │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  uploadImage() to R2            │
│  Save MerchDesign record        │
│  Include appliedInsights in     │
│  sourceData for tracking        │
└─────────────────────────────────┘
```

### Weekly Learning Job Flow

```
Cron: Every Sunday 4:00 AM UTC
              │
              ▼
┌─────────────────────────────────┐
│  POST /api/cron/learn-and-extract
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  extractAllInsights()           │
│                                 │
│  1. Query successful designs:   │
│     • approved = true           │
│     • sales > 0                 │
│     • rating >= 4               │
│                                 │
│  2. For each insight type:      │
│     • Aggregate patterns        │
│     • Calculate Wilson Score    │
│     • Validate sample size ≥10  │
│     • Check temporal consistency│
│                                 │
│  3. Create ProvenInsight records│
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  validateAllInsights()          │
│                                 │
│  For each existing insight:     │
│  • Test against recent data     │
│  • Update confidence score      │
│  • Mark if no longer relevant   │
│  • Link to superseding insight  │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  Return Summary:                │
│  • New insights discovered      │
│  • Insights validated           │
│  • Insights deprecated          │
│  • Top performing patterns      │
└─────────────────────────────────┘
```

### Dominate Feature Flow

```
User clicks "Dominate This Niche"
Selects variation count (3-10)
              │
              ▼
┌─────────────────────────────────┐
│  POST /api/designs/generate-variations
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  For each variation (parallel): │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  generateVariationStrategy()    │
│                                 │
│  AI creates unique approach:    │
│  • Different phrase angle       │
│  • Different visual style       │
│  • Different font choice        │
│  • Different layout             │
│  • Different color scheme       │
│  • Different graphic elements   │
│                                 │
│  Goal: Each looks like it was   │
│  designed by a different person │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  createPromptFromStrategy()     │
│  Build image generation prompt  │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  generateMerchImage()           │
│  generateMerchListing()         │
│  uploadImage()                  │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  Save MerchDesign with:         │
│  • parentId = original design   │
│  • variationStrategy in source  │
└─────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  Return array of variations     │
│  with progress updates          │
└─────────────────────────────────┘
```

---

## 5. Key Design Decisions

### Why Gemini, Not Anthropic?

| Factor | Decision |
|--------|----------|
| **Image Generation** | Gemini has native Imagen integration. Claude has no image generation. |
| **Google Search** | Gemini can search Google natively for trend research |
| **Cost** | Gemini API pricing is competitive for high-volume generation |
| **Multimodal** | Single API for text + image simplifies architecture |

### Why AI-Generated Variations, Not Templates?

| Templates | AI Variations |
|-----------|---------------|
| Limited creativity | Unlimited unique designs |
| Users recognize patterns | Each design feels original |
| Can't adapt to trends | Adapts to current market |
| One-time design cost | Per-generation cost |

**Decision:** The per-generation cost is worth it because:
- Users need unique designs to avoid Amazon listing saturation
- AI can incorporate current trends into variations
- Template fatigue leads to user churn

### Why Caching, Not Always Live APIs?

```
Live API Cost per Design:
  Grok search:    $0.02
  Brave search:   $0.01
  Gemini search:  $0.01
  ─────────────────────
  Total:          $0.04/design

With 90% Cache Hit Rate:
  Average cost:   $0.004/design
  Savings:        90%
```

**How caching works:**
1. Background jobs collect trends every 6 hours
2. Autopilot checks cache first (instant, free)
3. Only falls back to live API on cache miss
4. Cache miss triggers background collection

### Why ProvenInsights Are Permanent?

**The Compounding Knowledge Problem:**

Traditional ML approaches retrain models, losing context. Our approach:

1. **Insights are never deleted** - only marked `stillRelevant: false`
2. **Superseding tracked** - new insight links to old via `supersededBy`
3. **Historical patterns preserved** - can analyze how trends evolved
4. **Validation over time** - `timesValidated` shows pattern durability

**Example:** "Nurse humor" insight from 2024 might be superseded by refined "Healthcare worker humor" insight in 2025, but we can trace the evolution.

### Why Wilson Score, Not Simple Averages?

```
Design A: 2 sales / 2 designs = 100% success rate
Design B: 80 sales / 100 designs = 80% success rate

Simple average says A is better.
Wilson Score (95% confidence) says:
  A: 0.34 (wide confidence interval due to small sample)
  B: 0.72 (narrow interval, reliable)

Wilson correctly identifies B as more reliable.
```

Wilson Score penalizes small sample sizes, preventing us from over-indexing on lucky outliers.

---

## 6. File Structure & Organization

```
/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── admin/                # Admin endpoints
│   │   │   ├── insights/         # ProvenInsight CRUD
│   │   │   ├── trigger-collection/
│   │   │   └── sync-all-users/
│   │   ├── cron/                 # Background jobs
│   │   │   ├── collect-trends/
│   │   │   ├── analyze-niches/
│   │   │   ├── moonshot-trends/
│   │   │   └── learn-and-extract/
│   │   ├── designs/              # Design operations
│   │   │   ├── [id]/
│   │   │   ├── batch-generate/
│   │   │   ├── generate-variations/
│   │   │   └── check-quota/
│   │   ├── gemini/               # AI generation
│   │   │   ├── search-trends/
│   │   │   ├── generate-listing/
│   │   │   └── generate-image/
│   │   ├── brave-search/         # Brave API proxy
│   │   ├── grok/                 # Grok API proxy
│   │   └── stripe/               # Payment webhooks
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main app page
│
├── lib/                          # Core libraries
│   ├── prisma.ts                 # Database client
│   ├── pricing.ts                # Pricing configuration
│   ├── usage.ts                  # Usage tracking
│   ├── rateLimit.ts              # Rate limiting
│   ├── r2-storage.ts             # R2 file storage
│   │
│   └── merch/                    # Merch Generator core
│       ├── autopilot-generator.ts    # Autopilot orchestration
│       ├── manual-generation.ts      # Manual mode
│       ├── image-prompter.ts         # Prompt building
│       ├── image-generator.ts        # Image generation
│       ├── listing-generator.ts      # Listing generation
│       ├── variation-generator.ts    # Dominate feature
│       ├── variation-strategy.ts     # Variation AI
│       ├── download-helper.ts        # Export utilities
│       ├── types.ts                  # TypeScript types
│       │
│       ├── data-collectors/          # Phase 5: Caching
│       │   ├── index.ts
│       │   ├── trend-collector.ts    # Data collection
│       │   └── niche-analyzer.ts     # Niche analysis
│       │
│       └── learning/                 # Phase 6: Learning
│           ├── index.ts
│           ├── insight-extractor.ts  # Pattern extraction
│           ├── insight-validator.ts  # Validation system
│           └── insight-applier.ts    # Application logic
│
├── services/                     # External services
│   ├── geminiService.ts          # Multi-agent orchestration
│   ├── marketplaceIntelligence.ts
│   ├── vectorizerService.ts
│   ├── compliance.ts
│   └── prompts/                  # AI prompt templates
│       ├── trend-search.ts
│       └── design-education.ts
│
├── components/                   # React components
│   ├── MerchGenerator/           # Main generator UI
│   ├── DesignCard/
│   └── ui/                       # Shared UI components
│
├── prisma/
│   └── schema.prisma             # Database schema
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md           # This file
│   ├── research-system-overview.md
│   ├── brave-search-api-reference.md
│   └── implementation-plan.md
│
└── vercel.json                   # Cron job configuration
```

### Directory Purposes

| Directory | Purpose |
|-----------|---------|
| `app/api/` | All HTTP endpoints (Next.js API routes) |
| `lib/merch/` | Core business logic, isolated from HTTP layer |
| `lib/merch/data-collectors/` | Background data collection (Phase 5) |
| `lib/merch/learning/` | ML/insight system (Phase 6) |
| `services/` | External API integrations |
| `components/` | React UI components |
| `docs/` | Technical documentation |

---

## 7. API Reference

### Design Operations

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/designs` | GET | List user's designs (paginated) |
| `/api/designs` | POST | Create new design (autopilot or manual) |
| `/api/designs/[id]` | GET | Get single design |
| `/api/designs/[id]` | DELETE | Soft-delete design |
| `/api/designs/generate-variations` | POST | Dominate feature |
| `/api/designs/check-quota` | GET | Check usage limits |

### AI Generation

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/gemini/search-trends` | POST | Multi-agent research |
| `/api/gemini/generate-listing` | POST | Create listing |
| `/api/gemini/generate-image` | POST | Generate design image |

### Background Jobs (Cron)

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/collect-trends` | Every 6h | Collect market data |
| `/api/cron/analyze-niches` | Daily | Analyze niche performance |
| `/api/cron/moonshot-trends` | Every 4h | Hunt viral trends |
| `/api/cron/learn-and-extract` | Weekly | Extract insights |

### Admin Operations

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/trigger-collection` | POST | Manual data collection |
| `/api/admin/insights` | GET | List all insights |
| `/api/admin/insights` | POST | Create insight |
| `/api/admin/insights/[id]` | GET/PUT/DELETE | Manage insight |

---

## 8. Configuration & Constants

### Pricing Tiers (`lib/pricing.ts`)

| Tier | Designs/Month | Cooldown | Features |
|------|---------------|----------|----------|
| Free | 3 | 60s | Basic quality, no downloads |
| Starter | 50 | 30s | High quality, downloads |
| Pro | 200 | 15s | API access, priority |
| Business | 1000 | 5s | Unlimited variations |
| Enterprise | Custom | None | Custom integration |

### Niche Pools (`lib/merch/autopilot-generator.ts`)

```typescript
const NICHE_POOLS = {
  // Low risk: Evergreen, proven niches
  low: [
    'nurse gifts', 'teacher appreciation', 'dog mom',
    'cat lover', 'coffee addict', 'dad jokes',
    'mom life', 'gaming', 'fishing', 'camping',
  ],
  // Medium risk: Trending but established
  medium: [
    'work from home', 'introvert life', 'plant mom',
    'true crime', 'book lover', 'yoga life',
    'running', 'self care', 'mental health awareness',
  ],
  // High risk: Emerging trends, viral potential
  high: [
    'trending memes', 'viral tiktok', 'internet culture',
    'gen z humor', 'chronically online', 'goblin mode',
    'delulu', 'pop culture moments',
  ],
};
```

### API Timeouts (`services/geminiService.ts`)

```typescript
const API_TIMEOUTS = {
  search: 60000,    // 60 seconds for trend research
  listing: 45000,   // 45 seconds for listing generation
  image: 120000,    // 120 seconds for image generation
  research: 60000,  // 60 seconds for design research
};
```

### Insight Extraction Thresholds (`lib/merch/learning/insight-extractor.ts`)

```typescript
const MIN_SAMPLE_SIZE = 10;    // Minimum designs to form insight
const MIN_CONFIDENCE = 0.8;    // Wilson score threshold
const TEMPORAL_PERIODS = 2;    // Must appear in 2+ time periods
```

### Cron Schedule (`vercel.json`)

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

## Appendix: Quick Reference

### Key TypeScript Interfaces

```typescript
// Design generation input
interface GenerationRequest {
  mode: 'autopilot' | 'manual';
  riskLevel?: number;        // 0-100 for autopilot
  specs?: ManualSpecs;       // For manual mode
}

// Manual mode specifications
interface ManualSpecs {
  exactText: string;         // Required
  style?: string;
  tone?: string;
  imageFeature?: string;
  niche?: string;
  additionalInstructions?: string;
}

// Trend data from research
interface TrendData {
  topic: string;
  platform: string;
  volume: string;
  sentiment: string;
  keywords: string[];
  customerPhrases: string[];
  visualStyle: string;
  sources: string[];
  designText?: string;
}

// Design concept for generation
interface DesignConcept {
  phrase: string;
  niche: string;
  style: string;
  tone: string;
  visualStyle?: string;
  imageFeature?: string;
}

// Insight application result
interface InsightGuidance {
  recommendedStyles: string[];
  recommendedTones: string[];
  phraseTemplates: string[];
  listingGuidance: string[];
  crossNicheIdeas: string[];
  warnings: string[];
  appliedInsights: AppliedInsight[];
}
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Authentication
CLERK_SECRET_KEY=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...

# AI Services
GEMINI_API_KEY=...
GROK_API_KEY=...
BRAVE_API_KEY=...

# Storage
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...

# Payments
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# App
NEXT_PUBLIC_APP_URL=https://...
CRON_SECRET=...
```

---

*This documentation is maintained alongside the codebase. For specific implementation details, refer to the source files in `lib/merch/` and `services/`.*

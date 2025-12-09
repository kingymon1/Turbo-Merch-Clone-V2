# Merch Generator Learning System

> **Last Updated:** December 2024
> **Version:** Phase 6 Complete

---

## Table of Contents

1. [Overview](#1-overview)
2. [ProvenInsights Model](#2-proveninsights-model)
3. [Insight Types](#3-insight-types)
4. [Extraction Engine](#4-extraction-engine)
5. [Validation System](#5-validation-system)
6. [Insight Application](#6-insight-application)
7. [Risk-Aware Integration](#7-risk-aware-integration)
8. [API Reference](#8-api-reference)

---

## 1. Overview

The Learning System is the "brain" of the Merch Generator. It extracts patterns from historical design performance and applies those insights to improve future generations.

### Core Philosophy

```
Raw Data → Pattern Detection → ProvenInsights → Smarter Generation
              (Wilson Score)    (Permanent)      (Risk-aware)
```

**Key Principles:**

1. **ProvenInsights are PERMANENT** - Never deleted, only superseded
2. **Statistical rigor** - Uses Wilson Score Interval for confidence
3. **Temporal validation** - Patterns must appear across multiple time periods
4. **Risk-aware application** - Low-risk generations rely heavily on insights; high-risk experiments more freely

### The Learning Loop

```
┌────────────────────────────────────────────────────────┐
│                   WEEKLY LEARNING CYCLE                 │
├────────────────────────────────────────────────────────┤
│                                                         │
│  1. EXTRACTION (Sunday 4am)                            │
│     ├─ Query all non-test MerchDesign records          │
│     ├─ Identify patterns with statistical significance │
│     └─ Create/update ProvenInsight records             │
│                                                         │
│  2. VALIDATION (Same job)                              │
│     ├─ Test insights against recent data               │
│     ├─ Boost confidence for validated patterns         │
│     └─ Mark stale insights as stillRelevant: false     │
│                                                         │
│  3. APPLICATION (Every generation)                     │
│     ├─ Query insights for generation context           │
│     ├─ Apply as constraints, suggestions, or warnings  │
│     └─ Log which insights were used                    │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## 2. ProvenInsights Model

### Database Schema

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
  title           String   // Human-readable summary
  description     String   @db.Text
  pattern         Json     // Structured pattern data (flexible schema)

  // Statistical confidence
  sampleSize      Int      // Number of designs this is based on
  confidence      Float    // 0-1 (Wilson Score based)
  successRate     Float?   // Approval/conversion rate
  avgPerformance  Json?    // { avgViews, avgSales, ... }

  // Applicability
  niche           String?  // Specific niche or null for general
  niches          String[] // Multiple applicable niches
  timeframe       String?  // 'year-round' | 'holiday-season' | etc.
  riskLevel       String?  // 'proven' | 'emerging' | 'moonshot'

  // Lifecycle
  lastValidated   DateTime @default(now())
  timesValidated  Int      @default(1)
  stillRelevant   Boolean  @default(true)
  supersededBy    String?  // ID of newer insight that replaces this

  // Traceability
  sourceDataIds   String[] // IDs of designs that contributed to this insight
}
```

### Confidence Thresholds

| Threshold | Meaning |
|-----------|---------|
| 0.0 - 0.5 | Low confidence - insufficient data |
| 0.5 - 0.7 | Moderate - emerging pattern |
| 0.7 - 0.85 | Good - usable for suggestions |
| 0.85 - 0.95 | High - usable for constraints |
| 0.95+ | Very high - strongly validated |

---

## 3. Insight Types

### phrase-pattern

Captures high-performing phrase structures and templates.

```typescript
{
  insightType: "phrase-pattern",
  category: "evergreen",
  title: "Phrase template \"World's {adj} {noun}\" shows 85% success rate",
  pattern: {
    template: "World's {adj} {noun}",
    examplePhrases: [
      "World's Okayest Nurse",
      "World's Best Dad",
      "World's Greatest Teacher"
    ],
    nicheBreakdown: {
      "nurse": { success: 12, total: 14 },
      "dad": { success: 8, total: 10 }
    }
  },
  confidence: 0.87,
  successRate: 0.85
}
```

**Detection:** Regex-based template matching against successful designs.

---

### style-effectiveness

Tracks which visual styles perform best.

```typescript
{
  insightType: "style-effectiveness",
  category: "design",
  title: "\"Bold Modern\" style has 78% approval rate",
  pattern: {
    style: "Bold Modern",
    approvalRate: 0.78,
    avgViews: 145.2,
    avgSales: 3.4
  },
  confidence: 0.82,
  avgPerformance: {
    avgViews: 145.2,
    avgSales: 3.4
  }
}
```

**Detection:** Aggregates by style field across approved designs.

---

### niche-timing

Identifies seasonal patterns for niches.

```typescript
{
  insightType: "niche-timing",
  category: "seasonal",
  title: "\"teacher\" peaks in August, September (2.3x sales)",
  pattern: {
    peakMonths: [7, 8],  // August, September (0-indexed)
    multiplier: 2.3,
    monthlyBreakdown: [
      { month: 7, avgSales: 12.4, sampleSize: 45 },
      { month: 8, avgSales: 14.1, sampleSize: 52 }
    ]
  },
  niche: "teacher",
  timeframe: "seasonal"
}
```

**Detection:** Analyzes sales by month per niche, identifies 1.5x+ peaks.

---

### listing-structure

Captures effective listing title patterns.

```typescript
{
  insightType: "listing-structure",
  category: "listing",
  title: "\"gift-angle\" title pattern converts at 72%",
  pattern: {
    patternType: "gift-angle",
    description: "Titles framed as \"gift for X\" or \"present for Y\"",
    exampleTitles: [
      "Perfect Gift for Nurses Who Love Coffee",
      "Birthday Gift for Dad - Funny Fishing Shirt"
    ]
  },
  confidence: 0.84,
  successRate: 0.72
}
```

**Patterns detected:**
- `gift-angle`: Titles containing "gift", "present", "for him/her"
- `funny-angle`: Titles with "funny", "humor", "hilarious"
- `profession-first`: Titles starting with profession ("Nurse...", "Teacher...")
- `quote-style`: Titles containing actual quotes

---

### cross-niche

Identifies niche combination opportunities.

```typescript
{
  insightType: "cross-niche",
  category: "evergreen",
  title: "\"nurse\" + \"dog lover\" crossover opportunity",
  pattern: {
    niche1: "nurse",
    niche2: "dog lover",
    coOccurrence: 45,
    crossoverIdeas: [
      "nurse who also dog lover",
      "dog lover nurse combo"
    ]
  },
  niches: ["nurse", "dog lover"],
  confidence: 0.81
}
```

**Detection:** Analyzes co-occurrence patterns across user interests.

---

## 4. Extraction Engine

**File:** `lib/merch/learning/insight-extractor.ts`

### Statistical Foundation

#### Wilson Score Interval

Used instead of simple percentage for small sample sizes:

```typescript
function wilsonScore(successes: number, total: number, z: number = 1.96): number {
  if (total === 0) return 0;

  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const adjustment = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);

  return (centre - adjustment) / denominator;
}
```

**Why Wilson Score?**

| Scenario | Simple % | Wilson Score |
|----------|----------|--------------|
| 2/2 successes | 100% | ~34% (unreliable) |
| 80/100 successes | 80% | ~72% (reliable) |
| 800/1000 successes | 80% | ~78% (very reliable) |

### Minimum Thresholds

```typescript
const MIN_SAMPLE_SIZE = 10;   // At least 10 designs
const MIN_CONFIDENCE = 0.8;   // 80% Wilson Score
const MIN_TIME_PERIODS = 2;   // Must appear in 2+ weeks
```

### Extraction Process

```
1. Load all non-test MerchDesign records
2. For each insight type:
   a. Group designs by relevant criteria
   b. Filter groups with < MIN_SAMPLE_SIZE
   c. Require MIN_TIME_PERIODS temporal coverage
   d. Calculate Wilson Score confidence
   e. Filter groups with < MIN_CONFIDENCE
   f. Create or update ProvenInsight record
```

### Running Extraction

```typescript
import { extractAllInsights } from '@/lib/merch/learning';

const result = await extractAllInsights();
// {
//   insightsCreated: 3,
//   insightsUpdated: 12,
//   candidatesAnalyzed: 5,
//   errors: []
// }
```

---

## 5. Validation System

**File:** `lib/merch/learning/insight-validator.ts`

### Validation Philosophy

- High-confidence insights (0.9+): Validate monthly
- Lower-confidence insights: Validate weekly
- Failed validation 2x → `stillRelevant: false`

### Validation Thresholds

```typescript
const CONFIDENCE_DECAY_RATE = 0.05;      // Drop per failed validation
const MIN_CONFIDENCE_THRESHOLD = 0.6;     // Below = not relevant
const VALIDATION_SUCCESS_THRESHOLD = 0.7; // Must maintain 70% of original rate
```

### Validation Process

```
1. Find insights due for validation
   - High confidence: lastValidated > 30 days ago
   - Lower confidence: lastValidated > 7 days ago

2. For each insight:
   a. Query recent designs (last 30 days)
   b. Match designs to pattern
   c. Calculate current success rate
   d. Compare to original success rate

3. Update insight:
   - SUCCESS: confidence += 0.02
   - DEGRADED: confidence -= 0.05
   - INVALID: stillRelevant = false
```

### Running Validation

```typescript
import { validateAllInsights } from '@/lib/merch/learning';

const result = await validateAllInsights();
// {
//   validated: 18,
//   degraded: 2,
//   invalidated: 1,
//   errors: [],
//   results: [/* ValidationResult[] */]
// }
```

---

## 6. Insight Application

**File:** `lib/merch/learning/insight-applier.ts`

### Application Flow

```
Generation Request
        │
        ▼
┌──────────────────────────┐
│ getRelevantInsights()    │
│ Query insights for:      │
│ - niche                  │
│ - risk level             │
│ - current month          │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ applyInsightsToGeneration()
│ Returns:                 │
│ - recommendedStyles      │
│ - recommendedTones       │
│ - phraseTemplates        │
│ - listingGuidance        │
│ - crossNicheIdeas        │
│ - warnings (anti-patterns)
│ - appliedInsights        │
└──────────┬───────────────┘
           │
           ▼
    Generation Process
    (uses guidance)
           │
           ▼
┌──────────────────────────┐
│ logInsightUsage()        │
│ Store applied insights   │
│ in design.sourceData     │
└──────────────────────────┘
```

### Application Modes

| Mode | Meaning | Used When |
|------|---------|-----------|
| `constraint` | Must follow this pattern | Low risk (0-30) |
| `suggestion` | Consider this pattern | Medium risk (30-70) |
| `validation` | Confirms timing/context | Any risk level |
| `anti-pattern` | Avoid this pattern | High risk (70-100) |

### Usage Example

```typescript
import { applyInsightsToGeneration } from '@/lib/merch/learning';

const guidance = await applyInsightsToGeneration({
  niche: 'nurse',
  riskLevel: 25,
  month: 4  // May
});

// {
//   recommendedStyles: ['Bold Modern', 'Distressed'],
//   recommendedTones: ['Funny', 'Proud'],
//   phraseTemplates: ["World's {adj} {noun}", "{topic} Life"],
//   listingGuidance: ['Use gift-angle in title'],
//   crossNicheIdeas: ['nurse who also dog lover'],
//   warnings: [],
//   appliedInsights: [
//     { insightId: 'clx123', insightType: 'phrase-pattern', appliedAs: 'constraint', confidence: 0.87 }
//   ]
// }
```

---

## 7. Risk-Aware Integration

### How Risk Level Affects Insight Usage

```
┌─────────────────────────────────────────────────────┐
│                    RISK LEVELS                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  0-30 (Safe)                                        │
│  ├─ Min confidence required: 0.85                   │
│  ├─ Insights applied as: CONSTRAINTS                │
│  └─ "Use proven patterns exactly"                   │
│                                                      │
│  30-70 (Balanced)                                   │
│  ├─ Min confidence required: 0.75                   │
│  ├─ Insights applied as: SUGGESTIONS                │
│  └─ "Consider proven patterns"                      │
│                                                      │
│  70-100 (Risky/Moonshot)                           │
│  ├─ Min confidence required: 0.6                    │
│  ├─ ALSO queries anti-patterns                      │
│  ├─ Insights applied as: WARNINGS                   │
│  └─ "Know what to avoid"                           │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Integration with Autopilot

```typescript
// From autopilot-generator.ts

export async function generateAutopilotConcept(riskLevel: number) {
  // 1. Query insights for guidance
  const insightGuidance = await applyInsightsToGeneration({
    niche: selectedNiche,
    riskLevel,
    month: new Date().getMonth(),
  });

  // 2. Use guidance in concept extraction
  const concept = extractDesignConcept(trend, insightGuidance);

  // 3. Return with applied insights for tracking
  return {
    concept,
    trend,
    source: 'Cached data',
    appliedInsights: insightGuidance.appliedInsights,
  };
}
```

---

## 8. API Reference

### Core Functions

#### extractAllInsights()

```typescript
async function extractAllInsights(): Promise<{
  insightsCreated: number;
  insightsUpdated: number;
  candidatesAnalyzed: number;
  errors: string[];
}>
```

Runs all extraction pipelines (phrase, style, timing, listing, cross-niche).

---

#### validateAllInsights()

```typescript
async function validateAllInsights(): Promise<{
  validated: number;
  degraded: number;
  invalidated: number;
  errors: string[];
  results: ValidationResult[];
}>
```

Validates all insights due for validation.

---

#### applyInsightsToGeneration()

```typescript
async function applyInsightsToGeneration(context: {
  niche?: string;
  riskLevel: number;
  month?: number;
}): Promise<{
  recommendedStyles: string[];
  recommendedTones: string[];
  phraseTemplates: string[];
  listingGuidance: string[];
  crossNicheIdeas: string[];
  warnings: string[];
  appliedInsights: InsightApplication[];
}>
```

Gets relevant insights and formats them for generation.

---

#### logInsightUsage()

```typescript
async function logInsightUsage(
  designId: string,
  appliedInsights: InsightApplication[]
): Promise<void>
```

Logs which insights were used in a design (stored in `sourceData`).

---

#### getInsightsSummary()

```typescript
async function getInsightsSummary(): Promise<{
  total: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  highConfidence: number;
  recentlyValidated: number;
}>
```

Returns summary statistics for all insights.

---

### Helper Functions

```typescript
// Get best phrase template for a niche
async function getBestPhraseTemplate(
  niche: string,
  riskLevel: number
): Promise<{ template: string; confidence: number } | null>

// Get recommended style
async function getRecommendedStyle(
  niche?: string
): Promise<{ style: string; approvalRate: number } | null>

// Check if current month is peak season
async function isNichePeakSeason(
  niche: string,
  month?: number
): Promise<{ isPeak: boolean; multiplier: number } | null>
```

---

## Best Practices

### 1. Let the System Learn

Don't manually create insights unless you have external data. Let the extraction engine discover patterns from actual performance.

### 2. Monitor Validation

Check the weekly learning job output. Rising `invalidated` count may indicate market shifts.

### 3. Trust the Risk Levels

Low-risk users want proven results. Don't override insight constraints for them.

### 4. Track Insight Performance

The `sourceData.appliedInsights` field lets you correlate insight usage with design success. Use this for meta-learning.

### 5. Preserve Historical Insights

Even when `stillRelevant: false`, insights provide historical context. Use `supersededBy` to link old → new insights.

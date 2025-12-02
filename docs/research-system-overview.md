# TurboMerch Research System Overview

> **Purpose:** This document explains what the research system is trying to achieve and how it works at a high level. For API-specific implementation details, see the separate reference documents.

---

## The Problem

The original research system had critical flaws:

1. **Not truly live** - Grok was using training data (old memes from 2+ years ago) instead of searching live X/Twitter
2. **Meta-content searches** - Brave was searching for "articles about trends" instead of actual trending topics
3. **Limited perspectives** - Only 2 agents (Brave + Grok) before synthesis
4. **No seasonal awareness** - Obvious trends like Thanksgiving/Christmas were never discovered
5. **Repetitive results** - 7 out of 10 runs returned the same ideas

**Result:** The tool kept finding stale, repeated content instead of fresh, diverse opportunities.

---

## The Vision

A **live, multi-agent research system** that:

1. **Discovers what's actually happening RIGHT NOW** - Current events, seasonal moments, viral content from TODAY
2. **Provides diverse perspectives** - 3 independent agents searching different sources
3. **Adapts to risk tolerance** - From safe/proven trends to risky/emerging opportunities
4. **Finds real customer language** - Exact phrases, slang, and purchase intent signals
5. **Translates insights into designs** - Research directly informs the design generation

---

## The 3-Agent Architecture

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

### Why 3 Independent Agents?

Each agent has different strengths:

| Agent | Strength | Finds |
|-------|----------|-------|
| **Google** | Broad news coverage, current events | Seasonal events, breaking news, mainstream trends |
| **Brave** | Web discussions, community content | Reddit discussions, forum opinions, niche communities |
| **Grok** | Real-time social pulse | Viral moments, memes, X/Twitter conversations |

By searching **independently first**, each agent brings a unique perspective. The synthesis phase then finds:
- Topics mentioned by **multiple agents** = high confidence
- Unique discoveries from **single agents** = worth exploring

---

## Risk Levels Explained

The system supports 4 risk levels that control WHAT each agent searches for:

### Safe Mode (0-25) - "Proven Winners"
```
Goal: Find established trends with clear demand
Time Window: Past month
Filters: High engagement only
Best For: Low risk, consistent sellers
```
- Searches for: "best selling", "popular", "top rated"
- Grok filters: Only posts with 5,000+ likes, 100,000+ views
- Brave freshness: Past month
- Expects: Competition exists (validates demand)

### Balanced Mode (25-50) - "Rising Stars"
```
Goal: Find trends gaining momentum
Time Window: Past 1-2 weeks
Filters: Moderate engagement
Best For: Catching trends before saturation
```
- Searches for: "trending", "growing", "viral"
- Grok filters: Posts with 1,000+ likes, 20,000+ views
- Brave freshness: Past week
- Expects: Some competition, growing interest

### Aggressive Mode (50-75) - "Early Adopter"
```
Goal: Find emerging niche opportunities
Time Window: Past week
Filters: Lower engagement threshold
Best For: First-mover advantage
```
- Searches for: "emerging", "new", "niche"
- Grok filters: Posts with 100+ likes, 5,000+ views
- Brave freshness: Past day to week
- Expects: Little competition, passionate community

### Predictive Mode (75-100) - "Blue Ocean"
```
Goal: Find weak signals before they trend
Time Window: Past 1-2 days
Filters: No engagement filters
Best For: High risk, high reward bets
```
- Searches for: "just announced", "first", "early signs"
- Grok filters: None (catch everything)
- Brave freshness: Past day
- Expects: No competition, might never take off

---

## What Gets Extracted

For each trend discovered, the system extracts:

### Customer Intelligence
- **Exact phrases** people use (not summaries)
- **Slang and idioms** specific to the community
- **Purchase signals** ("I'd buy this", "need this on a shirt")
- **Emotional tone** (ironic, sincere, rebellious, wholesome)

### Visual Direction
- **Aesthetic preferences** referenced by the community
- **Typography style** that resonates
- **Color recommendations** for the design
- **Design effects** (distressed, clean, neon, vintage)

### Commercial Viability
- **Platform origin** (TikTok, Reddit, X, etc.)
- **Volume/momentum** indicator
- **Amazon safety** check
- **Audience profile** (who is this person?)

---

## From Research to Design

```
Research Discovery
       │
       ▼
┌─────────────────────────────────────┐
│           TrendData                 │
│  • topic: "Post-Turkey Chaos"       │
│  • customerPhrases: ["food coma",   │
│    "survived thanksgiving", ...]    │
│  • visualStyle: "Retro 70s with     │
│    modern irony"                    │
│  • sentiment: "self-deprecating"    │
│  • recommendedShirtColor: "black"   │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│        generateListing()            │
│  Uses customer phrases to create:   │
│  • Title (SEO-optimized)            │
│  • Brand name (community-authentic) │
│  • Bullet points (identity/vibe)    │
│  • Keywords (searchable terms)      │
│  • designText: "SURVIVED THE        │
│    THANKSGIVING TABLE"              │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│       generateDesignImage()         │
│  Creates image prompt using:        │
│  • Visual style from research       │
│  • Typography recommendations       │
│  • Shirt color strategy             │
│  • Design text from listing         │
└─────────────────────────────────────┘
       │
       ▼
    Final Design
```

---

## Key Principles

### 1. Fresh Over Familiar
Always prefer current data over cached/training data. A trend from today is more valuable than a "proven" trend from last month.

### 2. Specific Over Generic
"Soulslike veterans who platinum'd Elden Ring" is better than "gamers". Customer language should feel like it came FROM the community.

### 3. Date-Aware Queries
Every search should be anchored to the current date. "What's trending November 29th" not "what's trending in 2024".

### 4. Independent Then Synthesize
Agents search independently FIRST (no cross-contamination), then findings are synthesized. This maximizes diversity.

### 5. Risk Matches Reward
Low risk = proven demand, competition exists
High risk = no competition, demand unproven
Let the user choose their comfort level.

---

## Success Metrics

The research system is working correctly when:

1. **Diversity** - 10 runs produce 10 different primary topics
2. **Freshness** - Results include content from the last 24-48 hours
3. **Seasonal Awareness** - Obvious events (holidays, sports, news) are discovered
4. **Customer Language** - Extracted phrases sound authentic, not generic
5. **Risk Differentiation** - Safe mode returns different results than Aggressive mode

---

## Related Documentation

- `docs/grok-live-search-api-reference.md` - Grok API implementation details
- `docs/brave-search-api-reference.md` - Brave API implementation details
- `services/geminiService.ts` - Main implementation file
- `services/prompts/trend-search.ts` - Synthesis prompt template

# Research System Implementation Plan

> **Goal:** Transform the research system from 2 agents (with stale data) to 3 agents (with live search)
> **Status:** Ready for implementation
> **Estimated Changes:** 4 files modified, ~500 lines changed

---

## Summary of Changes

| File | Changes |
|------|---------|
| `services/geminiService.ts` | Add Google agent, fix Brave agent, fix Grok agent, update orchestration |
| `services/prompts/trend-search.ts` | Update interface and prompt template for 3 agents |
| `app/api/grok/route.ts` | Pass through `search_parameters` for live search |
| `config.ts` | Update discovery queries to be date-aware |

---

## Phase 1: Fix Grok Agent (Enable Live Search)

### 1.1 Update API Route
**File:** `app/api/grok/route.ts`

**Current:** Passes request body directly without modification
**Change:** Ensure `search_parameters` are passed through

```typescript
// The route already passes body through, but we need to ensure
// search_parameters is included in requests from geminiService
```

### 1.2 Update Grok Signal Fetcher
**File:** `services/geminiService.ts`

**Current Code (lines 94-155):**
```typescript
const fetchGrokSignals = async (query: string): Promise<string> => {
    // ... sends basic chat completion without search_parameters
}
```

**New Code:**
```typescript
const fetchGrokSignals = async (query: string, viralityLevel: number): Promise<string> => {
    const apiKey = process.env.NEXT_PUBLIC_GROK_API_KEY;
    if (!apiKey) return "";

    const date = getCurrentDateContext();
    const searchParams = getGrokSearchParameters(viralityLevel);

    try {
        const response = await fetch('/api/grok', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [
                    {
                        role: "system",
                        content: `You are analyzing LIVE X/Twitter data and current news.

TODAY'S DATE: ${date.fullDate}

CRITICAL: You have access to live search. Use it to find CURRENT conversations.

Your mission is to find and extract:
1. EXACT PHRASES people are using RIGHT NOW (copy verbatim)
2. SLANG and IDIOMS specific to this community
3. CURRENT viral moments and memes (from the last few days, not old)
4. EMOTIONAL TONE - excited, ironic, frustrated, hyped?
5. VISUAL PREFERENCES - what aesthetics are being shared?
6. PURCHASE INTENT - "I would buy", "need this on a shirt" signals

Return CURRENT data only. REJECT anything that seems old or from your training data.
If you find something trending, verify it's from ${date.month} ${date.year}.`
                    },
                    {
                        role: "user",
                        content: `Search X/Twitter and news for current conversations about: "${query}"

Return specific findings with actual examples from live posts.
Include the emotional tone and any visual preferences mentioned.`
                    }
                ],
                model: "grok-4",
                temperature: 0.3,
                search_parameters: searchParams
            })
        });

        if (!response.ok) return "";
        const data = await response.json();

        const content = data.choices?.[0]?.message?.content || "";
        const citations = data.citations || [];
        const sourcesUsed = data.usage?.num_sources_used || 0;

        console.log(`Grok search used ${sourcesUsed} sources ($${(sourcesUsed * 0.025).toFixed(4)})`);

        return `
=== GROK X/TWITTER INTELLIGENCE (${date.fullDate}) ===
Topic: "${query}"
Sources searched: ${sourcesUsed}
Citations: ${citations.length}

${content}

${citations.length > 0 ? `\nSOURCES:\n${citations.slice(0, 5).join('\n')}` : ''}
`;
    } catch (e) {
        console.warn("Grok analysis failed", e);
        return "";
    }
};

// Helper function for Grok search parameters
const getGrokSearchParameters = (viralityLevel: number) => {
    const today = new Date();
    const toDate = today.toISOString().split('T')[0];

    let fromDate: string;
    let xSource: any = { type: "x" };

    if (viralityLevel <= 25) {
        // SAFE: Past month, high engagement only
        const from = new Date(today);
        from.setDate(from.getDate() - 30);
        fromDate = from.toISOString().split('T')[0];
        xSource = {
            type: "x",
            post_favorite_count: 5000,
            post_view_count: 100000
        };
    } else if (viralityLevel <= 50) {
        // BALANCED: Past 2 weeks, moderate engagement
        const from = new Date(today);
        from.setDate(from.getDate() - 14);
        fromDate = from.toISOString().split('T')[0];
        xSource = {
            type: "x",
            post_favorite_count: 1000,
            post_view_count: 20000
        };
    } else if (viralityLevel <= 75) {
        // AGGRESSIVE: Past week, lower threshold
        const from = new Date(today);
        from.setDate(from.getDate() - 7);
        fromDate = from.toISOString().split('T')[0];
        xSource = {
            type: "x",
            post_favorite_count: 100,
            post_view_count: 5000
        };
    } else {
        // PREDICTIVE: Past 2 days, no filters
        const from = new Date(today);
        from.setDate(from.getDate() - 2);
        fromDate = from.toISOString().split('T')[0];
        xSource = { type: "x" };
    }

    return {
        mode: "on",
        from_date: fromDate,
        to_date: toDate,
        return_citations: true,
        max_search_results: 20,
        sources: [
            xSource,
            { type: "news", country: "US" },
            { type: "web", country: "US" }
        ]
    };
};
```

---

## Phase 2: Fix Brave Agent (Better Queries + News)

### 2.1 Update Brave Signal Fetcher
**File:** `services/geminiService.ts`

**Current Code (lines 45-87):**
```typescript
const fetchBraveSignals = async (query: string, viralityLevel: number): Promise<string> => {
    // Uses: `${query} community discussion slang phrases "${date.year}"`
    // Only calls web search endpoint
}
```

**New Code:**
```typescript
const fetchBraveSignals = async (query: string, viralityLevel: number): Promise<string> => {
    const apiKey = process.env.NEXT_PUBLIC_BRAVE_API_KEY;
    if (!apiKey) return "";

    const date = getCurrentDateContext();
    const freshness = getBraveFreshness(viralityLevel);

    // Run parallel searches: Web+Discussions AND dedicated News
    const [webData, newsData] = await Promise.all([
        fetchBraveWeb(query, freshness, apiKey, date),
        fetchBraveNews(query, freshness, apiKey, date)
    ]);

    return `
=== BRAVE WEB INTELLIGENCE (${date.fullDate}) ===
Search: "${query}"
Freshness: ${freshness}

${webData}

${newsData}

INSTRUCTION: Extract exact phrases, customer language, trending topics, and purchase intent signals.
`;
};

const getBraveFreshness = (viralityLevel: number): string => {
    if (viralityLevel <= 25) return 'pm';      // Past month
    if (viralityLevel <= 50) return 'pw';      // Past week
    return 'pd';                                // Past day
};

const fetchBraveWeb = async (query: string, freshness: string, apiKey: string, date: any): Promise<string> => {
    try {
        // Direct query - no more "community discussion slang" meta-searches
        const searchQuery = `${query} ${date.month} ${date.year}`;

        const params = new URLSearchParams({
            q: searchQuery,
            country: 'US',
            count: '20',
            freshness: freshness,
            result_filter: 'web,discussions',
            extra_snippets: 'true'
        });

        const response = await fetch(
            `https://api.search.brave.com/res/v1/web/search?${params}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'X-Subscription-Token': apiKey
                }
            }
        );

        if (!response.ok) return "";
        const data = await response.json();

        let output = "";

        // Web results
        if (data.web?.results?.length > 0) {
            output += "--- WEB RESULTS ---\n";
            data.web.results.slice(0, 10).forEach((r: any) => {
                output += `[${r.url}]\n`;
                output += `Title: ${r.title}\n`;
                output += `Content: ${r.description}\n`;
                if (r.extra_snippets?.length > 0) {
                    output += `Extra: ${r.extra_snippets.slice(0, 2).join(' | ')}\n`;
                }
                output += `\n`;
            });
        }

        // Discussions (Reddit, forums)
        if (data.discussions?.results?.length > 0) {
            output += "--- DISCUSSIONS (Reddit, Forums) ---\n";
            data.discussions.results.slice(0, 10).forEach((r: any) => {
                output += `[${r.url}]\n`;
                output += `Title: ${r.title}\n`;
                output += `Content: ${r.description}\n\n`;
            });
        }

        return output;
    } catch (e) {
        console.warn("Brave web search failed", e);
        return "";
    }
};

const fetchBraveNews = async (query: string, freshness: string, apiKey: string, date: any): Promise<string> => {
    try {
        const params = new URLSearchParams({
            q: query,
            country: 'US',
            count: '20',
            freshness: freshness,
            extra_snippets: 'true'
        });

        const response = await fetch(
            `https://api.search.brave.com/res/v1/news/search?${params}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'X-Subscription-Token': apiKey
                }
            }
        );

        if (!response.ok) return "";
        const data = await response.json();

        let output = "--- NEWS RESULTS ---\n";

        if (data.results?.length > 0) {
            data.results.slice(0, 15).forEach((r: any) => {
                output += `[${r.url}]\n`;
                output += `Source: ${r.source?.name || 'Unknown'}\n`;
                output += `Title: ${r.title}\n`;
                output += `Content: ${r.description}\n`;
                output += `Age: ${r.age || 'unknown'}\n\n`;
            });
        }

        return output;
    } catch (e) {
        console.warn("Brave news search failed", e);
        return "";
    }
};
```

---

## Phase 3: Add Google Agent (New)

### 3.1 Create Google Signal Fetcher
**File:** `services/geminiService.ts`

**Add new function:**
```typescript
/**
 * GOOGLE DISCOVERY AGENT (NEW)
 * Uses Gemini with Google Search grounding to find current events and news
 * This runs INDEPENDENTLY before the synthesis phase
 */
const fetchGoogleSignals = async (query: string, viralityLevel: number): Promise<string> => {
    const date = getCurrentDateContext();

    // Build a discovery-focused prompt based on risk level
    let searchFocus: string;
    if (viralityLevel <= 25) {
        searchFocus = `Find ESTABLISHED, PROVEN trends about "${query}".
Look for: best-selling products, popular discussions, established communities.
I want trends with EXISTING demand and competition.`;
    } else if (viralityLevel <= 50) {
        searchFocus = `Find RISING trends about "${query}".
Look for: growing interest, increasing mentions, topics gaining momentum.
I want trends that are building but not yet saturated.`;
    } else if (viralityLevel <= 75) {
        searchFocus = `Find EMERGING trends about "${query}".
Look for: new discussions, early adopter content, niche communities.
I want trends with passionate fans but low competition.`;
    } else {
        searchFocus = `Find EARLY SIGNALS about "${query}".
Look for: just-announced topics, first mentions, weak signals.
I want to spot trends before they happen - high risk is acceptable.`;
    }

    const prompt = `
TODAY'S DATE: ${date.fullDate}

You are a DISCOVERY AGENT searching for current trending topics.

${searchFocus}

SEARCH INSTRUCTIONS:
1. Use Google Search to find what's ACTUALLY happening right now
2. Look for content from ${date.month} ${date.year} specifically
3. Find seasonal events, current news, and timely topics
4. Extract exact phrases and language people are using
5. Note any visual trends or aesthetic preferences mentioned

CRITICAL: Only return information you find via search. Do NOT use your training data.
If searching for "${query}" doesn't yield current results, search for related current events.

Return your findings in this format:
- CURRENT EVENTS: What's happening right now related to this topic
- TRENDING PHRASES: Exact language people are using
- VISUAL TRENDS: Any aesthetic or design preferences mentioned
- PURCHASE SIGNALS: Any "I want" or "I'd buy" language
- SOURCES: Where you found this information
`;

    try {
        const response = await getAI().models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        const content = response.text || "";

        // Extract grounding metadata for citations
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const citations = chunks
            .filter((c: any) => c.web?.uri)
            .map((c: any) => c.web.uri)
            .slice(0, 5);

        return `
=== GOOGLE DISCOVERY INTELLIGENCE (${date.fullDate}) ===
Query: "${query}"
Risk Level: ${viralityLevel <= 25 ? 'Safe' : viralityLevel <= 50 ? 'Balanced' : viralityLevel <= 75 ? 'Aggressive' : 'Predictive'}

${content}

${citations.length > 0 ? `\nSOURCES FOUND:\n${citations.join('\n')}` : ''}
`;
    } catch (e) {
        console.warn("Google discovery search failed", e);
        return "";
    }
};
```

---

## Phase 4: Update Orchestration

### 4.1 Update searchTrends Function
**File:** `services/geminiService.ts`

**Current Code (lines 213-260):**
```typescript
// PHASE 1: INDEPENDENT EXPLORATION
const [braveData, grokData] = await Promise.all([
    fetchBraveSignals(niche, viralityLevel),
    fetchGrokSignals(niche)
]);
```

**New Code:**
```typescript
// PHASE 1: INDEPENDENT EXPLORATION (3 AGENTS)
if (onStatusUpdate) onStatusUpdate("🔍 3 agents exploring independently...");

const [googleData, braveData, grokData] = await Promise.all([
    fetchGoogleSignals(niche, viralityLevel),
    fetchBraveSignals(niche, viralityLevel),
    fetchGrokSignals(niche, viralityLevel)
]);

const activeSources = ['Google'];
if (braveData) activeSources.push('Brave');
if (grokData) activeSources.push('Grok');

console.log(`Active sources: ${activeSources.join(', ')}`);

// Log what each agent found (for debugging)
console.log('Google data length:', googleData.length);
console.log('Brave data length:', braveData.length);
console.log('Grok data length:', grokData.length);
```

### 4.2 Update Prompt Building
**File:** `services/geminiService.ts`

**Current call to buildTrendSearchPrompt:**
```typescript
const prompt = buildTrendSearchPrompt({
    date,
    niche,
    viralityLevel,
    braveData,
    grokData,
    rabbitHoleData,
    isDiscovery,
});
```

**New call:**
```typescript
const prompt = buildTrendSearchPrompt({
    date,
    niche,
    viralityLevel,
    googleData,      // NEW
    braveData,
    grokData,
    rabbitHoleData,
    isDiscovery,
});
```

---

## Phase 5: Update Prompt Template

### 5.1 Update Interface
**File:** `services/prompts/trend-search.ts`

**Current interface:**
```typescript
export interface TrendSearchPromptParams {
  date: { ... };
  niche: string;
  viralityLevel: number;
  braveData: string;
  grokData: string;
  rabbitHoleData: string;
  isDiscovery: boolean;
}
```

**New interface:**
```typescript
export interface TrendSearchPromptParams {
  date: {
    fullDate: string;
    year: number;
    month: string;
  };
  niche: string;
  viralityLevel: number;
  googleData: string;      // NEW
  braveData: string;
  grokData: string;
  rabbitHoleData: string;
  isDiscovery: boolean;
}
```

### 5.2 Update Prompt Template
**File:** `services/prompts/trend-search.ts`

**Update the buildTrendSearchPrompt function:**

Replace the "INTELLIGENCE REPORTS FROM YOUR AGENTS" section:

```typescript
═══════════════════════════════════════════════════════════════
INTELLIGENCE REPORTS FROM YOUR 3 AGENTS
(Each agent searched INDEPENDENTLY - cross-reference their findings)
═══════════════════════════════════════════════════════════════

${googleData || "GOOGLE AGENT: No data available"}

${braveData || "BRAVE AGENT: No data available"}

${grokData || "GROK AGENT: No data available"}

${rabbitHoleData || "RABBIT HOLE: No deep dive conducted"}

═══════════════════════════════════════════════════════════════
YOUR TASK: SYNTHESIZE & DECIDE
═══════════════════════════════════════════════════════════════

Cross-reference all 3 agent findings and identify:

1. **HIGH CONFIDENCE** - Topics mentioned by MULTIPLE agents
   These are verified trends with corroborating evidence.

2. **UNIQUE DISCOVERIES** - Topics found by only ONE agent
   These might be niche opportunities worth exploring.

3. **DISCARD** - Anything that seems old, stale, or from training data
   If an agent mentions something without current sources, reject it.

VALIDATION CHECKLIST:
✓ Is this trend actually from ${date.month} ${date.year}?
✓ Does it have current sources/citations?
✓ Would someone searching TODAY find this relevant?
✓ Is there evidence of real community engagement?

When in doubt, prefer FRESH over POPULAR.
```

---

## Phase 6: Update Discovery Queries

### 6.1 Make Queries Date-Aware
**File:** `config.ts`

**Current static queries:**
```typescript
globalDiscoveryQueries: [
    'Fastest rising cultural trends and memes right now',
    'Breakout internet topics and viral phrases today',
    // ...
]
```

**New approach - create a function:**
```typescript
// In config.ts, keep the base queries but make them more direct
globalDiscoveryQueries: [
    'trending topics today',
    'viral moments this week',
    'current events and news',
    'popular products people are buying',
    'what people are talking about right now'
]
```

**Or better - generate dynamically in TrendScanner.tsx:**
```typescript
const getDiscoveryQuery = () => {
    const now = new Date();
    const month = now.toLocaleDateString('en-US', { month: 'long' });
    const year = now.getFullYear();

    const templates = [
        `trending topics ${month} ${year}`,
        `viral content this week`,
        `what's popular right now ${month}`,
        `current events ${month} ${year}`,
        `trending products ${month}`
    ];

    return templates[Math.floor(Math.random() * templates.length)];
};
```

---

## Phase 7: Add Debug Logging

### 7.1 Create Debug Output for Testing
**File:** `services/geminiService.ts`

Add at the end of searchTrends, before returning:
```typescript
// Debug logging (can be toggled via env var)
if (process.env.NEXT_PUBLIC_DEBUG_RESEARCH === 'true') {
    console.log('=== RESEARCH DEBUG ===');
    console.log('Query:', niche);
    console.log('Virality Level:', viralityLevel);
    console.log('Google Data Preview:', googleData.substring(0, 500));
    console.log('Brave Data Preview:', braveData.substring(0, 500));
    console.log('Grok Data Preview:', grokData.substring(0, 500));
    console.log('Trends Found:', trends.length);
    console.log('Topics:', trends.map(t => t.topic).join(', '));
    console.log('======================');
}
```

---

## Implementation Order

1. **Phase 1** - Fix Grok (highest impact - enables live X search)
2. **Phase 5** - Update prompt interface (needed for Phase 3 & 4)
3. **Phase 3** - Add Google agent (new capability)
4. **Phase 4** - Update orchestration (wire it all together)
5. **Phase 2** - Fix Brave (improved queries + news)
6. **Phase 6** - Update discovery queries
7. **Phase 7** - Add debug logging

---

## Testing Checklist

After implementation, verify:

- [ ] **Grok returns live data** - Check citations are present, content mentions current dates
- [ ] **Brave returns news** - News results appear in output
- [ ] **Brave returns discussions** - Reddit/forum content appears
- [ ] **Google agent works** - Returns current event data with sources
- [ ] **3 agents run in parallel** - Check console for timing
- [ ] **Risk levels change behavior** - Safe vs Aggressive return different results
- [ ] **Seasonal trends appear** - Search during holidays should find holiday content
- [ ] **No repetition** - 5 runs should return 5 different primary topics
- [ ] **Debug logging works** - Set env var and check console output

---

## Rollback Plan

If issues arise, the changes are isolated to:
- `services/geminiService.ts` - Core agent logic
- `services/prompts/trend-search.ts` - Prompt template
- `config.ts` - Discovery queries

Git revert to previous commit if needed.

---

## Cost Monitoring

New cost structure per search:
- **Grok Live Search:** ~$0.50 (20 sources × $0.025)
- **Brave Web:** $0.009 (1 request)
- **Brave News:** $0.009 (1 request)
- **Gemini (Google agent):** Standard token costs

**Total per full research:** ~$0.52 + Gemini tokens

Monitor `usage.num_sources_used` in Grok responses to track actual costs.

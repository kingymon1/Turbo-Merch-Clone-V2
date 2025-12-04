# Grok API Reference

## Quick Reference

| Item | Value |
|------|-------|
| **Docs URL** | https://docs.x.ai/docs/guides/live-search |
| **API Endpoint** | `https://api.x.ai/v1/chat/completions` |
| **Auth** | Bearer token in Authorization header |
| **Pricing** | $25 per 1,000 sources ($0.025 per source) |
| **Deprecation** | Live Search API deprecated December 15, 2025 |

## Where API Key Goes

```env
# .env file
NEXT_PUBLIC_GROK_API_KEY=your_grok_api_key_here
GROK_LIVE_SEARCH_MODEL=grok-4
```

Get your API key from: https://x.ai/api

## Key Files

| File | Purpose |
|------|---------|
| `app/api/grok/route.ts` | API route that proxies requests to xAI |
| `services/geminiService.ts` | Contains `fetchGrokSignals()` and `fetchGrokUnleashed()` |

---

## Enabling Live Search

To enable search, specify `search_parameters` in your chat completions request.

**Important:** Even for default values, you must include `search_parameters`:

```javascript
// Minimal - enables live search with defaults
search_parameters: {}

// Or specify mode explicitly
search_parameters: {
  mode: "auto"  // "auto" | "on" | "off"
}
```

### Mode Options

| Mode | Behavior |
|------|----------|
| `"off"` | Disables search, uses model without live data |
| `"auto"` | Model decides whether to search (default) |
| `"on"` | Always performs live search |

---

## Complete Example

```javascript
import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';

const result = await generateText({
  model: xai('grok-4'),
  prompt: 'What are people saying about this topic?',
  providerOptions: {
    xai: {
      searchParameters: {
        mode: 'auto',
        sources: [
          { type: 'x' },
          { type: 'web', country: 'US' },
          { type: 'news', country: 'US' }
        ]
      }
    }
  }
});
```

### Raw HTTP Request

```javascript
const response = await fetch('https://api.x.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    messages: [
      { role: "system", content: "..." },
      { role: "user", content: "..." }
    ],
    model: "grok-4",
    search_parameters: {
      mode: "on",
      from_date: "2025-01-01",
      to_date: "2025-12-04",
      return_citations: true,
      sources: [
        { type: "x" },
        { type: "web", country: "US" },
        { type: "news", country: "US" }
      ]
    }
  })
});
```

---

## search_parameters Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mode` | string | `"auto"` | `"off"`, `"auto"`, or `"on"` |
| `from_date` | string | none | ISO8601 format `"YYYY-MM-DD"` |
| `to_date` | string | none | ISO8601 format `"YYYY-MM-DD"` |
| `return_citations` | boolean | `true` | Include source URLs in response |
| `sources` | array | `["web", "news", "x"]` | Array of source config objects |

**WARNING:** Do NOT use undocumented parameters like `max_search_results` - they cause 400 errors!

---

## Data Sources and Parameters

### Overview

| Source | Description | Supported Parameters |
|--------|-------------|---------------------|
| `"web"` | Search websites | `country`, `excluded_websites`, `allowed_websites`, `safe_search` |
| `"x"` | Search X/Twitter posts | `included_x_handles`, `excluded_x_handles`, `post_favorite_count`, `post_view_count` |
| `"news"` | Search news sources | `country`, `excluded_websites`, `safe_search` |
| `"rss"` | Fetch from RSS feed | `links` |

### Web Source

```javascript
{
  type: 'web',
  country: 'US',                    // ISO alpha-2 code
  allowed_websites: ['x.ai'],       // Max 5, can't use with excluded
  excluded_websites: ['wikipedia.org'], // Max 5, can't use with allowed
  safe_search: true                 // Default: true
}
```

### X (Twitter) Source

```javascript
{
  type: 'x',
  included_x_handles: ['xai'],      // Max 10, can't use with excluded
  excluded_x_handles: ['someuser'], // Max 10, can't use with included
  post_favorite_count: 1000,        // Minimum likes
  post_view_count: 20000            // Minimum views
}
```

**Note:** The `"grok"` handle is automatically excluded by default to prevent self-citation. To include it, explicitly add to `included_x_handles`.

### News Source

```javascript
{
  type: 'news',
  country: 'US',                    // ISO alpha-2 code
  excluded_websites: ['bbc.co.uk'], // Max 5
  safe_search: true                 // Default: true
}
```

### RSS Source

```javascript
{
  type: 'rss',
  links: ['https://status.x.ai/feed.xml']  // Only 1 link supported currently
}
```

---

## Parameter Details

### `country` (Web and News)

Use ISO alpha-2 country codes to get region-specific results:

```javascript
sources: [
  { type: 'web', country: 'CH' },  // Switzerland
  { type: 'news', country: 'US' }  // United States
]
```

### `excluded_websites` (Web and News)

Exclude up to 5 websites:

```javascript
sources: [
  {
    type: 'web',
    excluded_websites: ['wikipedia.org', 'reddit.com']
  },
  {
    type: 'news',
    excluded_websites: ['bbc.co.uk']
  }
]
```

### `allowed_websites` (Web only)

Restrict search to specific websites (max 5):

```javascript
sources: [
  {
    type: 'web',
    allowed_websites: ['x.ai', 'github.com']
  }
]
```

**Note:** Cannot use with `excluded_websites` on the same source.

### `included_x_handles` / `excluded_x_handles` (X only)

Filter by specific X handles (max 10):

```javascript
// Only search posts from these handles
sources: [{ type: 'x', included_x_handles: ['xai', 'elonmusk'] }]

// Exclude posts from these handles
sources: [{ type: 'x', excluded_x_handles: ['spambot'] }]
```

**Note:** Cannot use both on the same source.

### `post_favorite_count` / `post_view_count` (X only)

Filter posts by engagement:

```javascript
sources: [
  {
    type: 'x',
    post_favorite_count: 1000,  // Min 1000 likes
    post_view_count: 20000      // Min 20000 views
  }
]
```

### `safe_search` (Web and News)

Safe search is ON by default. To disable:

```javascript
sources: [
  { type: 'web', safe_search: false },
  { type: 'news', safe_search: false }
]
```

---

## Response Structure

```javascript
{
  "id": "...",
  "object": "chat.completion",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "..."
      }
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300,
    "num_sources_used": 15  // For cost tracking
  },
  "citations": [
    "https://x.com/user/status/123",
    "https://news.example.com/article"
  ]
}
```

### Streaming

- Chat response chunks arrive as usual
- `citations` only appear in the **last chunk**

---

## Available Models

| Model | Description | Live Search |
|-------|-------------|-------------|
| `grok-4` | Latest reasoning model | ✅ Supported |
| `grok-3` | Production model | ✅ Supported |
| `grok-3-mini` | Smaller/faster | ✅ Supported |

All models support `search_parameters` for Live Search.

---

## TurboMerch Integration

### Virality Level Mapping

We adjust search parameters based on the risk/virality slider:

| Level | Date Range | X Filters | Strategy |
|-------|------------|-----------|----------|
| Safe (0-25) | 30 days | likes >= 5000, views >= 100k | Established trends |
| Balanced (26-50) | 14 days | likes >= 1000, views >= 20k | Rising trends |
| Aggressive (51-75) | 7 days | likes >= 100, views >= 5k | Emerging trends |
| Predictive (76-100) | 2 days | No filters | Catch everything |

### Implementation

```javascript
const getGrokDateRange = (viralityLevel) => {
  const today = new Date();
  let daysBack;

  if (viralityLevel <= 25) daysBack = 30;
  else if (viralityLevel <= 50) daysBack = 14;
  else if (viralityLevel <= 75) daysBack = 7;
  else daysBack = 2;

  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - daysBack);

  return {
    from_date: fromDate.toISOString().split('T')[0],
    to_date: today.toISOString().split('T')[0]
  };
};

const getGrokXSourceConfig = (viralityLevel) => {
  if (viralityLevel <= 25) {
    return { type: "x", post_favorite_count: 5000, post_view_count: 100000 };
  } else if (viralityLevel <= 50) {
    return { type: "x", post_favorite_count: 1000, post_view_count: 20000 };
  } else if (viralityLevel <= 75) {
    return { type: "x", post_favorite_count: 100, post_view_count: 5000 };
  } else {
    return { type: "x" };  // No filters for predictive mode
  }
};
```

---

## Cost Tracking

We log costs in `app/api/grok/route.ts`:

```javascript
const sourcesUsed = data.usage?.num_sources_used || 0;
if (sourcesUsed > 0) {
  console.log(`[GROK API] Sources used: ${sourcesUsed} (cost: $${(sourcesUsed * 0.025).toFixed(4)})`);
}
```

### Cost Examples

| Configuration | Sources | Cost |
|--------------|---------|------|
| All 3 sources | ~20 | ~$0.50 |
| X only | ~10 | ~$0.25 |
| X only (filtered) | ~5 | ~$0.125 |

---

## Troubleshooting

### 400 Bad Request

**Cause:** Using undocumented parameters like `max_search_results`

**Fix:** Only use documented parameters:
- `mode`
- `from_date` / `to_date`
- `return_citations`
- `sources`

### Empty Results

1. Check `mode` is `"on"` or `"auto"` (not `"off"`)
2. Verify date range isn't too restrictive
3. Lower `post_favorite_count`/`post_view_count` thresholds

### 403 Forbidden

Verify your API key has Live Search access enabled.

### Debug Logging

Check server console for `[GROK API]` logs:
- Model being used
- Whether search_parameters is present
- Error details if request fails
- Sources used and cost on success

---

## Migration Path

Live Search API is deprecated **December 15, 2025**.

**Migrate to:** Agentic Tool Calling API
- More powerful search capabilities
- Model decides when/how to search
- Docs: https://docs.x.ai/docs/guides/tools/overview

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-04 | Removed `max_search_results` (causes 400 errors) |
| 2025-12-04 | Confirmed grok-4 supports search_parameters |
| 2025-12-04 | Added comprehensive parameter documentation |

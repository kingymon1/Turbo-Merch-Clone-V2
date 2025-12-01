# Grok Live Search API Reference

> **Source:** https://docs.x.ai/docs/guides/live-search
> **Last Updated:** November 29, 2024
> **Deprecation Notice:** Live Search API will be deprecated December 15, 2025. Plan migration to [Agentic Tool Calling API](https://docs.x.ai/docs/guides/tools/overview).

---

## Overview

The chat completion endpoint supports querying live data from X (Twitter), web, and news sources. Live search is **turned off by default** - you must explicitly enable it via `search_parameters`.

**Pricing:** $25 per 1,000 sources used ($0.025 per source)

---

## Basic Request Structure

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
            from_date: "2024-11-28",
            to_date: "2024-11-29",
            max_search_results: 20,
            return_citations: true,
            sources: [
                { type: "x" },
                { type: "web" },
                { type: "news" }
            ]
        }
    })
});
```

---

## search_parameters Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mode` | string | `"auto"` | `"off"` = disabled, `"auto"` = model decides, `"on"` = always search |
| `from_date` | string | none | ISO8601 format `"YYYY-MM-DD"` - start of date range |
| `to_date` | string | none | ISO8601 format `"YYYY-MM-DD"` - end of date range |
| `max_search_results` | number | `20` | Maximum number of sources to consider |
| `return_citations` | boolean | `true` | Include source URLs in response |
| `sources` | array | `["web", "news", "x"]` | Array of source configuration objects |

### Mode Options

- `"off"` - Disables search, uses model without live data
- `"auto"` - Model automatically decides whether to search (default)
- `"on"` - Always performs live search

### Date Range

- Both dates in ISO8601 format: `"YYYY-MM-DD"`
- Can use independently:
  - Only `from_date`: searches from that date to today
  - Only `to_date`: searches all data up to that date
- Dates are inclusive

---

## Source Configurations

### Default Sources

If no `sources` specified, defaults to: `["web", "news", "x"]`

### X (Twitter) Source

```javascript
{
    type: "x",
    included_x_handles: ["handle1", "handle2"],  // Max 10, cannot use with excluded
    excluded_x_handles: ["handle1", "handle2"],  // Max 10, cannot use with included
    post_favorite_count: 1000,                   // Minimum likes filter
    post_view_count: 20000                       // Minimum views filter
}
```

| Parameter | Description |
|-----------|-------------|
| `included_x_handles` | Only search posts from these handles (max 10) |
| `excluded_x_handles` | Exclude posts from these handles (max 10) |
| `post_favorite_count` | Minimum number of favorites/likes |
| `post_view_count` | Minimum number of views |

**Note:** `"grok"` handle is automatically excluded by default to prevent self-citation.

### Web Source

```javascript
{
    type: "web",
    country: "US",                              // ISO alpha-2 country code
    allowed_websites: ["site1.com"],            // Max 5, cannot use with excluded
    excluded_websites: ["wikipedia.org"],       // Max 5, cannot use with allowed
    safe_search: true                           // Default true
}
```

| Parameter | Description |
|-----------|-------------|
| `country` | ISO alpha-2 code (e.g., "US", "GB", "CH") |
| `allowed_websites` | Only search these domains (max 5) |
| `excluded_websites` | Exclude these domains (max 5) |
| `safe_search` | Enable safe search filtering (default: true) |

### News Source

```javascript
{
    type: "news",
    country: "US",                              // ISO alpha-2 country code
    excluded_websites: ["bbc.co.uk"],           // Max 5
    safe_search: true                           // Default true
}
```

| Parameter | Description |
|-----------|-------------|
| `country` | ISO alpha-2 code |
| `excluded_websites` | Exclude these news sources (max 5) |
| `safe_search` | Enable safe search filtering (default: true) |

### RSS Source

```javascript
{
    type: "rss",
    links: ["https://example.com/feed.xml"]    // Currently only 1 link supported
}
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
        "num_sources_used": 15          // For cost tracking
    },
    "citations": [                      // Source URLs
        "https://x.com/user/status/123",
        "https://news.example.com/article"
    ]
}
```

### Streaming Behavior

- Chat response chunks arrive as usual
- `citations` only appear in the **last chunk**
- Similar to how `usage` data is returned with streaming

---

## TurboMerch Integration: Risk Level Mapping

### Date Ranges by Risk Level

```javascript
const getDateRangeForViralityLevel = (viralityLevel) => {
    const today = new Date();
    let fromDate;

    if (viralityLevel <= 25) {
        // SAFE: Past month - established trends
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 30);
    } else if (viralityLevel <= 50) {
        // BALANCED: Past 2 weeks - rising trends
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 14);
    } else if (viralityLevel <= 75) {
        // AGGRESSIVE: Past week - emerging trends
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 7);
    } else {
        // PREDICTIVE: Past 2 days - just appearing
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 2);
    }

    return {
        from_date: fromDate.toISOString().split('T')[0],
        to_date: today.toISOString().split('T')[0]
    };
};
```

### X Source Filters by Risk Level

```javascript
const getXSourceForViralityLevel = (viralityLevel) => {
    if (viralityLevel <= 25) {
        // SAFE: Only established viral content
        return {
            type: "x",
            post_favorite_count: 5000,
            post_view_count: 100000
        };
    } else if (viralityLevel <= 50) {
        // BALANCED: Moderately popular content
        return {
            type: "x",
            post_favorite_count: 1000,
            post_view_count: 20000
        };
    } else if (viralityLevel <= 75) {
        // AGGRESSIVE: Lower threshold, catching rising content
        return {
            type: "x",
            post_favorite_count: 100,
            post_view_count: 5000
        };
    } else {
        // PREDICTIVE: No filters, catch everything
        return {
            type: "x"
        };
    }
};
```

### Complete search_parameters by Risk Level

```javascript
const getSearchParametersForViralityLevel = (viralityLevel) => {
    const dateRange = getDateRangeForViralityLevel(viralityLevel);
    const xSource = getXSourceForViralityLevel(viralityLevel);

    return {
        mode: "on",
        from_date: dateRange.from_date,
        to_date: dateRange.to_date,
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

## Example: Complete Grok API Call with Live Search

```javascript
const fetchGrokSignals = async (query, viralityLevel) => {
    const apiKey = process.env.NEXT_PUBLIC_GROK_API_KEY;
    if (!apiKey) return "";

    const date = getCurrentDateContext();
    const searchParams = getSearchParametersForViralityLevel(viralityLevel);

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            messages: [
                {
                    role: "system",
                    content: `You are analyzing live X/Twitter data and news.

TODAY'S DATE: ${date.fullDate}

Your mission is to find and extract:
1. EXACT PHRASES people are using right now
2. SLANG and IDIOMS specific to this community
3. CURRENT viral moments and memes (from the last few days)
4. EMOTIONAL TONE - excited, ironic, frustrated, hyped?
5. VISUAL PREFERENCES - what aesthetics are being shared?
6. PURCHASE INTENT - "I would buy", "need this on a shirt"

Return CURRENT data only. Reject anything that seems old or stale.`
                },
                {
                    role: "user",
                    content: `Search for current conversations and trends about: "${query}"

Return specific findings with actual examples from live posts.`
                }
            ],
            model: "grok-4",
            temperature: 0.3,
            search_parameters: searchParams
        })
    });

    const data = await response.json();

    // Track cost
    const sourcesUsed = data.usage?.num_sources_used || 0;
    console.log(`Grok search used ${sourcesUsed} sources ($${(sourcesUsed * 0.025).toFixed(4)})`);

    // Return content with citations
    return {
        content: data.choices?.[0]?.message?.content || "",
        citations: data.citations || [],
        sourcesUsed
    };
};
```

---

## Cost Optimization Tips

1. **Limit sources**: Only include sources you need (e.g., just X for social trends)
2. **Use `max_search_results`**: Lower value = fewer sources = lower cost
3. **Use `mode: "auto"`**: Let model decide if search is needed
4. **Cache results**: Avoid redundant searches for same query

### Cost Examples

| Configuration | Sources Used | Cost per Search |
|--------------|--------------|-----------------|
| All 3 sources, max 20 | ~20 | ~$0.50 |
| X only, max 10 | ~10 | ~$0.25 |
| X only, max 5 | ~5 | ~$0.125 |

---

## Available Models

| Model | Description |
|-------|-------------|
| `grok-4` | Latest model (shown in docs) |
| `grok-3` | Previous version (currently in our code) |

**Recommendation:** Verify API key access level and test both models.

---

## Migration Path

Since Live Search is deprecated December 15, 2025, plan migration to:

**Agentic Tool Calling API**
- More powerful search capabilities
- Model decides when and how to search
- Documentation: https://docs.x.ai/docs/guides/tools/overview

---

## Troubleshooting

### Common Issues

1. **Empty results**: Check that `mode` is `"on"` or `"auto"` (not `"off"`)
2. **Stale data**: Verify `from_date` and `to_date` are set correctly
3. **No X results**: Check `post_favorite_count`/`post_view_count` aren't too high
4. **403 errors**: Verify API key has live search access

### Debug Checklist

```javascript
// Log the full request for debugging
console.log('Grok request:', JSON.stringify({
    model: "grok-4",
    search_parameters: searchParams
}, null, 2));

// Log response metadata
console.log('Sources used:', data.usage?.num_sources_used);
console.log('Citations:', data.citations?.length);
```

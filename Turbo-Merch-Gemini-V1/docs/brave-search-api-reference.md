# Brave Search API Reference

> **Source:** https://api.search.brave.com/app/documentation
> **Last Updated:** November 29, 2024
> **Subscription:** Pro AI ($9/1,000 requests, 50 req/sec, unlimited)

---

## Overview

Brave Search API provides multiple endpoints for different content types. With Pro AI subscription, you have access to:
- Web Search (with discussions, news, videos as filters)
- News Search (dedicated endpoint)
- Local Search
- Rich Search (sports, stocks, weather)
- Summarizer

---

## Endpoints

| Endpoint | URL | Max Results | Purpose |
|----------|-----|-------------|---------|
| **Web Search** | `/res/v1/web/search` | 20 | General web + filtered results |
| **News Search** | `/res/v1/news/search` | 50 | Dedicated news articles |
| **Local Search** | `/res/v1/local/pois` | 20 | Location/business info |
| **Rich Search** | `/res/v1/web/rich` | - | Sports, stocks, weather |

Base URL: `https://api.search.brave.com`

---

## Authentication

```javascript
headers: {
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip',
    'X-Subscription-Token': process.env.BRAVE_API_KEY
}
```

---

## Web Search API

### Endpoint
```
GET https://api.search.brave.com/res/v1/web/search
```

### Query Parameters

| Parameter | Required | Type | Default | Description |
|-----------|----------|------|---------|-------------|
| `q` | **Yes** | string | - | Search query (max 400 chars, 50 words) |
| `country` | No | string | `US` | Country code for results |
| `search_lang` | No | string | `en` | Language code |
| `count` | No | int | `20` | Results per page (max 20) |
| `offset` | No | int | `0` | Pagination offset (max 9) |
| `safesearch` | No | string | `moderate` | `off`, `moderate`, `strict` |
| `freshness` | No | string | - | Time filter (see below) |
| `result_filter` | No | string | - | Comma-separated result types |
| `extra_snippets` | No | bool | `false` | Get 5 additional excerpts |
| `summary` | No | bool | `false` | Enable AI summarizer |
| `spellcheck` | No | bool | `true` | Auto-correct queries |

### Freshness Parameter

| Value | Meaning |
|-------|---------|
| `pd` | Past Day (last 24 hours) |
| `pw` | Past Week (last 7 days) |
| `pm` | Past Month (last 31 days) |
| `py` | Past Year (last 365 days) |
| `YYYY-MM-DDtoYYYY-MM-DD` | Custom date range |

### Result Filter Options

Filter specific result types with comma-separated values:

| Value | Description |
|-------|-------------|
| `web` | Standard web results |
| `news` | News articles |
| `discussions` | Forum/community content (Reddit, StackExchange) |
| `videos` | Video content |
| `faq` | FAQ results |
| `infobox` | Information boxes |
| `summarizer` | AI summaries |
| `locations` | Local/place results |

**Example:** `result_filter=news,discussions,web`

### Example Request

```javascript
const response = await fetch(
    'https://api.search.brave.com/res/v1/web/search?' + new URLSearchParams({
        q: 'trending topics today',
        country: 'US',
        count: '20',
        freshness: 'pd',
        result_filter: 'news,discussions,web',
        extra_snippets: 'true'
    }),
    {
        headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': process.env.BRAVE_API_KEY
        }
    }
);
```

---

## News Search API

### Endpoint
```
GET https://api.search.brave.com/res/v1/news/search
```

### Query Parameters

| Parameter | Required | Type | Default | Description |
|-----------|----------|------|---------|-------------|
| `q` | **Yes** | string | - | Search query (max 400 chars, 50 words) |
| `country` | No | string | `US` | Country code |
| `search_lang` | No | string | `en` | Language code |
| `count` | No | int | `20` | Results (max **50**) |
| `offset` | No | int | `0` | Pagination offset (max 9) |
| `safesearch` | No | string | `moderate` | Content filtering |
| `freshness` | No | string | - | Time filter |
| `extra_snippets` | No | bool | `false` | Additional excerpts |
| `spellcheck` | No | bool | `true` | Auto-correct |

**Note:** News endpoint allows up to 50 results vs 20 for web search.

### Example Request

```javascript
const response = await fetch(
    'https://api.search.brave.com/res/v1/news/search?' + new URLSearchParams({
        q: 'Black Friday deals',
        country: 'US',
        count: '20',
        freshness: 'pd',
        extra_snippets: 'true'
    }),
    {
        headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': process.env.BRAVE_API_KEY
        }
    }
);
```

---

## Response Structure

### Web Search Response

```javascript
{
    "query": {
        "original": "trending topics",
        "altered": "trending topics",  // If spellchecked
        "spellcheck_off": false
    },
    "web": {
        "results": [
            {
                "title": "Result Title",
                "url": "https://example.com/...",
                "description": "Result snippet...",
                "extra_snippets": ["Additional excerpt 1", "..."],
                "age": "2 hours ago"
            }
        ]
    },
    "news": {
        "results": [
            {
                "title": "News Headline",
                "url": "https://news.example.com/...",
                "description": "News snippet...",
                "age": "1 hour ago",
                "source": {
                    "name": "News Source",
                    "url": "https://news.example.com"
                }
            }
        ]
    },
    "discussions": {
        "results": [
            {
                "title": "Discussion Title",
                "url": "https://reddit.com/...",
                "description": "Discussion snippet..."
            }
        ]
    }
}
```

### News Search Response

```javascript
{
    "query": {
        "original": "search query"
    },
    "results": [
        {
            "title": "News Article Title",
            "url": "https://...",
            "description": "Article excerpt...",
            "age": "3 hours ago",
            "page_age": "2024-11-29T10:00:00",
            "source": {
                "name": "Publisher Name",
                "url": "https://publisher.com",
                "favicon": "https://..."
            },
            "thumbnail": {
                "src": "https://...",
                "height": 200,
                "width": 300
            },
            "extra_snippets": ["...", "..."]
        }
    ]
}
```

---

## TurboMerch Integration: Risk Level Mapping

### Freshness by Risk Level

```javascript
const getFreshnessForViralityLevel = (viralityLevel) => {
    if (viralityLevel <= 25) {
        // SAFE: Past month - established trends
        return 'pm';
    } else if (viralityLevel <= 50) {
        // BALANCED: Past week - rising trends
        return 'pw';
    } else if (viralityLevel <= 75) {
        // AGGRESSIVE: Past day - emerging trends
        return 'pd';
    } else {
        // PREDICTIVE: Past day (most recent)
        return 'pd';
    }
};
```

### Search Strategy by Risk Level

```javascript
const getBraveSearchStrategy = (viralityLevel) => {
    if (viralityLevel <= 25) {
        // SAFE: Look for established discussions and proven topics
        return {
            endpoint: 'web',
            freshness: 'pm',
            result_filter: 'web,discussions',
            queryModifiers: ['popular', 'best selling', 'trending'],
            focus: 'Find topics with existing community discussion'
        };
    } else if (viralityLevel <= 50) {
        // BALANCED: Mix of news and discussions
        return {
            endpoint: 'web',
            freshness: 'pw',
            result_filter: 'news,discussions,web',
            queryModifiers: ['trending', 'viral', 'growing'],
            focus: 'Find rising topics gaining momentum'
        };
    } else if (viralityLevel <= 75) {
        // AGGRESSIVE: Focus on breaking news
        return {
            endpoint: 'news',  // Use dedicated news endpoint
            freshness: 'pd',
            count: 30,
            queryModifiers: ['breaking', 'new', 'just announced'],
            focus: 'Find emerging stories before they peak'
        };
    } else {
        // PREDICTIVE: Latest everything
        return {
            endpoint: 'news',
            freshness: 'pd',
            count: 50,  // Max results
            queryModifiers: ['emerging', 'first', 'early signs'],
            focus: 'Catch weak signals and early indicators'
        };
    }
};
```

---

## Complete Brave Agent Implementation

```javascript
const fetchBraveSignals = async (query, viralityLevel) => {
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) return { web: "", news: "", discussions: "" };

    const date = getCurrentDateContext();
    const strategy = getBraveSearchStrategy(viralityLevel);

    // Build search URL based on strategy
    const baseUrl = strategy.endpoint === 'news'
        ? 'https://api.search.brave.com/res/v1/news/search'
        : 'https://api.search.brave.com/res/v1/web/search';

    const params = new URLSearchParams({
        q: `${query} ${date.month} ${date.year}`,
        country: 'US',
        count: String(strategy.count || 20),
        freshness: strategy.freshness,
        extra_snippets: 'true',
        spellcheck: 'true'
    });

    // Add result_filter for web search
    if (strategy.result_filter) {
        params.append('result_filter', strategy.result_filter);
    }

    try {
        const response = await fetch(`${baseUrl}?${params}`, {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': apiKey
            }
        });

        if (!response.ok) {
            console.error('Brave API error:', response.status);
            return { web: "", news: "", discussions: "" };
        }

        const data = await response.json();
        return formatBraveResults(data, date, query);

    } catch (error) {
        console.error('Brave Search failed:', error);
        return { web: "", news: "", discussions: "" };
    }
};

const formatBraveResults = (data, date, query) => {
    let output = `\n=== BRAVE WEB INTELLIGENCE (${date.fullDate}) ===\n`;
    output += `Query: "${query}"\n\n`;

    // Format web results
    if (data.web?.results?.length > 0) {
        output += `--- WEB RESULTS ---\n`;
        data.web.results.forEach(r => {
            output += `[${r.url}]\n`;
            output += `Title: ${r.title}\n`;
            output += `Content: ${r.description}\n`;
            if (r.extra_snippets?.length > 0) {
                output += `Extra: ${r.extra_snippets.join(' | ')}\n`;
            }
            output += `Age: ${r.age || 'unknown'}\n\n`;
        });
    }

    // Format news results
    if (data.news?.results?.length > 0) {
        output += `--- NEWS RESULTS ---\n`;
        data.news.results.forEach(r => {
            output += `[${r.url}]\n`;
            output += `Source: ${r.source?.name || 'Unknown'}\n`;
            output += `Title: ${r.title}\n`;
            output += `Content: ${r.description}\n`;
            output += `Age: ${r.age || 'unknown'}\n\n`;
        });
    }

    // Format discussion results
    if (data.discussions?.results?.length > 0) {
        output += `--- DISCUSSIONS (Reddit, Forums) ---\n`;
        data.discussions.results.forEach(r => {
            output += `[${r.url}]\n`;
            output += `Title: ${r.title}\n`;
            output += `Content: ${r.description}\n\n`;
        });
    }

    // For dedicated news endpoint (different structure)
    if (data.results && !data.web) {
        output += `--- NEWS RESULTS ---\n`;
        data.results.forEach(r => {
            output += `[${r.url}]\n`;
            output += `Source: ${r.source?.name || 'Unknown'}\n`;
            output += `Title: ${r.title}\n`;
            output += `Content: ${r.description}\n`;
            output += `Age: ${r.age || 'unknown'}\n\n`;
        });
    }

    output += `\nINSTRUCTION: Extract exact phrases, customer language, and trending topics from these results.\n`;

    return output;
};
```

---

## Parallel Search Strategy

For comprehensive coverage, run multiple searches in parallel:

```javascript
const fetchBraveSignalsComprehensive = async (query, viralityLevel) => {
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) return "";

    const date = getCurrentDateContext();
    const freshness = getFreshnessForViralityLevel(viralityLevel);

    // Run parallel searches for different content types
    const [webResults, newsResults] = await Promise.all([
        // Web + Discussions search
        fetch(`https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({
            q: `${query} ${date.month} ${date.year}`,
            country: 'US',
            count: '20',
            freshness: freshness,
            result_filter: 'web,discussions',
            extra_snippets: 'true'
        })}`, {
            headers: {
                'Accept': 'application/json',
                'X-Subscription-Token': apiKey
            }
        }).then(r => r.json()).catch(() => null),

        // Dedicated News search (up to 50 results)
        fetch(`https://api.search.brave.com/res/v1/news/search?${new URLSearchParams({
            q: `${query}`,
            country: 'US',
            count: '30',
            freshness: freshness,
            extra_snippets: 'true'
        })}`, {
            headers: {
                'Accept': 'application/json',
                'X-Subscription-Token': apiKey
            }
        }).then(r => r.json()).catch(() => null)
    ]);

    return combineResults(webResults, newsResults, date, query);
};
```

---

## Cost Optimization

- **Pro AI:** $9 per 1,000 requests
- **Rate Limit:** 50 requests/second
- Parallel searches count as separate requests
- Use `count` parameter wisely - don't request more than needed

### Cost per Search Strategy

| Strategy | Requests | Cost |
|----------|----------|------|
| Single web search | 1 | $0.009 |
| Web + News parallel | 2 | $0.018 |
| Full coverage (web + news + discussions) | 2-3 | $0.018-$0.027 |

---

## Troubleshooting

### Common Issues

1. **Empty results**: Check freshness isn't too restrictive
2. **No discussions**: Not all queries have forum content
3. **Rate limited**: Stay under 50 req/sec
4. **Missing result types**: Verify `result_filter` values are correct

### Debug Logging

```javascript
console.log('Brave request:', {
    endpoint: baseUrl,
    query: params.get('q'),
    freshness: params.get('freshness'),
    result_filter: params.get('result_filter')
});

console.log('Brave response:', {
    webResults: data.web?.results?.length || 0,
    newsResults: data.news?.results?.length || 0,
    discussions: data.discussions?.results?.length || 0
});
```

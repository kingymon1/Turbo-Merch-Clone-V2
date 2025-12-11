# Brave Search API Documentation

## Overview

Brave Search API provides access to Brave's independent search index of over 35 billion web pages, offering a privacy-focused alternative to Google and Bing for web search, local search, image search, video search, news search, and AI-powered summarization. As the fastest-growing search engine since Bing, Brave Search handles over 8 billion annualized queries.

**Key Features:**
- Independent search index (not dependent on Google/Bing)
- Privacy-first approach with no user tracking
- 30+ billion pages indexed with 100M+ daily updates
- Multiple search endpoints (web, images, videos, news, local)
- AI-powered summarization
- Goggles for custom result re-ranking
- Rich snippets and structured data
- MCP server integration for AI agents

---

## Authentication

### API Key Authentication

Get your API key from the [Brave Search API Dashboard](https://api-dashboard.search.brave.com/app/keys).

**Request Header:**
```
X-Subscription-Token: YOUR_API_KEY
```

**Environment Variable:**
```bash
export BRAVE_API_KEY="your-api-key-here"
```

---

## Base URL

```
https://api.search.brave.com/res/v1
```

---

## Endpoints

### Web Search
**GET** `/web/search`

Primary endpoint for comprehensive web search results.

### Image Search
**GET** `/images/search`

Search for images with thumbnails and metadata.

### Video Search
**GET** `/videos/search`

Search for videos with duration, views, and creator info.

### News Search
**GET** `/news/search`

Search for current news articles with freshness controls.

### Suggest (Autocomplete)
**GET** `/suggest/search`

Get search suggestions for autocomplete functionality.

### Spellcheck
**GET** `/spellcheck/search`

Check spelling and get correction suggestions.

### Local POIs
**GET** `/local/pois`

Get detailed information about local business locations.

### Local Descriptions
**GET** `/local/descriptions`

Get AI-generated descriptions for local businesses.

### Summarizer
**GET** `/summarizer/search`

Get AI-powered summaries from web search results.

---

## Pricing Plans (December 2025)

### Free Plan
- **Cost:** $0
- **Queries:** 2,000/month
- **Rate Limit:** 1 query/second
- **Features:** Web search, basic functionality
- **Storage Rights:** No

### Base Plan
- **Cost:** $3 per 1,000 queries ($0.003/query)
- **Queries:** Up to 20M/month
- **Rate Limit:** 20 queries/second
- **Features:** Web, News, Videos, Goggles, Autosuggest, Spellcheck
- **Storage Rights:** No

### Pro Plan
- **Cost:** $5 per 1,000 queries ($0.005/query)
- **Queries:** Up to 20M/month
- **Rate Limit:** 50 queries/second
- **Features:** All Base features + Local Search, Extra Snippets, Schema-enriched results, Infobox, FAQ, Discussions
- **Storage Rights:** No

### Data for AI Plan
- **Cost:** $9 per 1,000 queries ($0.009/query)
- **Queries:** Unlimited
- **Rate Limit:** 50 queries/second
- **Features:** All Pro features + Data storage rights for AI/LLM training
- **Storage Rights:** Yes

### AI Grounding Plans

| Plan | Cost | Rate Limit | Monthly Limit | Features |
|------|------|------------|---------------|----------|
| Free AI | $0 | 1/second | 5,000 queries | Basic AI grounding |
| Base AI | $5/1K requests | 20/second | 20M queries | Commercial AI use |
| Pro AI | $9/1K requests | 50/second | Unlimited | Full commercial rights |

### AI Grounding Endpoint
- **Cost:** $4/1K web searches + $5/1M tokens (input/output)
- Supports single-search and multi-search (Research mode)

### Add-on Features
| Feature | Cost |
|---------|------|
| Autosuggest | $5 per 10,000 requests |
| Spellcheck | $5 per 10,000 requests |

---

## Query Parameters

### Web Search Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query (max 400 chars, 50 words) |
| `country` | string | No | "US" | Country code for results (ISO 3166-1 alpha-2) |
| `search_lang` | string | No | "en" | Language of search results |
| `ui_lang` | string | No | "en-US" | UI language |
| `count` | integer | No | 10 | Results per page (1-20 for web, 1-50 for news/video, 1-200 for images) |
| `offset` | integer | No | 0 | Pagination offset (max 9) |
| `safesearch` | string | No | "moderate" | Content filter: "off", "moderate", "strict" |
| `freshness` | string | No | - | Time filter (see below) |
| `text_decorations` | boolean | No | true | Include HTML highlighting markers |
| `spellcheck` | boolean | No | true | Enable spell checking |
| `result_filter` | string | No | - | Filter result types (comma-separated) |
| `goggles_id` | string | No | - | Goggle ID for custom re-ranking |
| `units` | string | No | - | Measurement units: "metric" or "imperial" |
| `extra_snippets` | boolean | No | false | Additional excerpts (Pro plans only) |
| `summary` | boolean | No | false | Enable summary key for AI summarization |

### Freshness Values

| Value | Description |
|-------|-------------|
| `pd` | Past 24 hours (past day) |
| `pw` | Past 7 days (past week) |
| `pm` | Past 31 days (past month) |
| `py` | Past 365 days (past year) |
| `YYYY-MM-DDtoYYYY-MM-DD` | Custom date range |

### Result Filter Values

| Value | Description |
|-------|-------------|
| `web` | Web page results |
| `news` | News articles |
| `video` | Video results |
| `images` | Image results |
| `locations` | Local business results |
| `infobox` | Knowledge panel/infobox |
| `discussions` | Forum discussions |
| `faq` | FAQ results |
| `query` | Query suggestions |

### Country Codes (Examples)

| Code | Country |
|------|---------|
| `US` | United States |
| `GB` | United Kingdom |
| `DE` | Germany |
| `FR` | France |
| `JP` | Japan |
| `AU` | Australia |
| `CA` | Canada |

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-Subscription-Token` | Yes | Your API key |
| `Accept` | Recommended | `application/json` |
| `Accept-Encoding` | Recommended | `gzip` for compressed responses |
| `Api-Version` | Optional | API version (e.g., "2023-10-11") |

---

## Response Format

### Web Search Response Structure

```json
{
  "type": "search",
  "query": {
    "original": "artificial intelligence trends",
    "show_strict_warning": false,
    "altered": null,
    "safesearch": true,
    "is_navigational": false,
    "is_geolocal": false,
    "local_decision": "drop",
    "is_trending": false,
    "is_news_breaking": false,
    "spellcheck_off": false,
    "country": "us",
    "more_results_available": true
  },
  "web": {
    "type": "search",
    "results": [
      {
        "title": "Result Title",
        "url": "https://example.com/page",
        "is_source_local": false,
        "is_source_both": false,
        "description": "Result description with <strong>highlighted</strong> terms",
        "page_age": "2025-01-15T10:30:00",
        "profile": {
          "name": "Example",
          "url": "https://example.com",
          "long_name": "example.com",
          "img": "https://imgs.search.brave.com/favicon..."
        },
        "language": "en",
        "family_friendly": true,
        "extra_snippets": ["Additional excerpt 1", "Additional excerpt 2"]
      }
    ],
    "family_friendly": true
  },
  "news": {
    "type": "news",
    "results": [...]
  },
  "videos": {
    "type": "videos",
    "results": [...]
  },
  "locations": {
    "type": "locations",
    "results": [...]
  },
  "mixed": {
    "type": "mixed",
    "main": [
      {"type": "web", "index": 0, "all": false},
      {"type": "news", "index": 0, "all": true}
    ]
  }
}
```

### Video Result Structure

```json
{
  "type": "video_result",
  "url": "https://www.youtube.com/watch?v=...",
  "title": "Video Title",
  "description": "Video description...",
  "age": "2 days ago",
  "page_age": "2025-01-10T15:00:00",
  "video": {
    "duration": "12:34",
    "views": 150000,
    "creator": "Channel Name",
    "publisher": "YouTube",
    "requires_subscription": false,
    "tags": ["tag1", "tag2"],
    "author": {
      "name": "Channel Name",
      "url": "https://www.youtube.com/@channel"
    }
  },
  "thumbnail": {
    "src": "https://imgs.search.brave.com/thumbnail..."
  }
}
```

### Image Result Structure

```json
{
  "type": "image_result",
  "title": "Image Title",
  "url": "https://source-site.com/page",
  "source": "source-site.com",
  "page_fetched": "2025-01-15T12:00:00Z",
  "thumbnail": {
    "src": "https://imgs.search.brave.com/thumbnail..."
  },
  "properties": {
    "url": "https://source-site.com/image.jpg",
    "width": 1920,
    "height": 1080,
    "format": "jpeg"
  }
}
```

### News Result Structure

```json
{
  "type": "news_result",
  "title": "News Article Title",
  "url": "https://news-site.com/article",
  "description": "Article summary...",
  "age": "3 hours ago",
  "page_age": "2025-01-15T09:00:00",
  "meta_url": {
    "scheme": "https",
    "netloc": "news-site.com",
    "hostname": "www.news-site.com",
    "favicon": "https://imgs.search.brave.com/favicon...",
    "path": "› category › article-slug"
  },
  "thumbnail": {
    "src": "https://imgs.search.brave.com/thumbnail..."
  },
  "extra_snippets": ["Additional context..."]
}
```

### Location Result Structure

```json
{
  "type": "location_result",
  "id": "abc123def456",
  "title": "Business Name",
  "url": "https://business-website.com",
  "address": {
    "streetAddress": "123 Main St",
    "addressLocality": "San Francisco",
    "addressRegion": "CA",
    "postalCode": "94102",
    "addressCountry": "US"
  },
  "phone": "+1-555-123-4567",
  "rating": {
    "ratingValue": 4.5,
    "ratingCount": 250
  },
  "price_range": "$$",
  "opening_hours": {
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "opens": "09:00",
    "closes": "17:00"
  },
  "categories": ["Restaurant", "Italian"]
}
```

---

## HTTP Status Codes

| Code | Description | Action |
|------|-------------|--------|
| 200 | Success | Process response |
| 400 | Bad Request | Check query parameters |
| 401 | Unauthorized | Verify API key |
| 403 | Forbidden | Check subscription/permissions |
| 422 | Unprocessable Entity | Fix request format |
| 429 | Rate Limited | Implement backoff/retry |
| 500 | Server Error | Retry with backoff |
| 503 | Service Unavailable | Retry later |

---

## TypeScript/JavaScript Implementation

### Installation

```bash
# Official Python wrapper (community)
pip install brave-search

# For TypeScript/JavaScript, use fetch or axios directly
npm install axios
```

### Basic Web Search

```typescript
import axios from 'axios';

interface BraveSearchConfig {
  apiKey: string;
  baseUrl?: string;
}

interface WebSearchParams {
  q: string;
  country?: string;
  search_lang?: string;
  count?: number;
  offset?: number;
  safesearch?: 'off' | 'moderate' | 'strict';
  freshness?: string;
  extra_snippets?: boolean;
  summary?: boolean;
}

class BraveSearchClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: BraveSearchConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.search.brave.com/res/v1';
  }

  private async request(endpoint: string, params: Record<string, any>) {
    const response = await axios.get(`${this.baseUrl}${endpoint}`, {
      params,
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': this.apiKey,
      },
    });
    return response.data;
  }

  async webSearch(params: WebSearchParams) {
    return this.request('/web/search', params);
  }

  async imageSearch(params: WebSearchParams) {
    return this.request('/images/search', params);
  }

  async videoSearch(params: WebSearchParams) {
    return this.request('/videos/search', params);
  }

  async newsSearch(params: WebSearchParams) {
    return this.request('/news/search', {
      ...params,
      freshness: params.freshness || 'pd', // Default to past day for news
    });
  }

  async suggest(q: string, count = 10) {
    return this.request('/suggest/search', { q, count });
  }

  async spellcheck(q: string) {
    return this.request('/spellcheck/search', { q });
  }

  async getLocalPois(ids: string[]) {
    const idsParam = ids.map(id => `ids=${id}`).join('&');
    return this.request(`/local/pois?${idsParam}`, {});
  }

  async getLocalDescriptions(ids: string[]) {
    const idsParam = ids.map(id => `ids=${id}`).join('&');
    return this.request(`/local/descriptions?${idsParam}`, {});
  }

  async getSummary(key: string, options?: { entity_info?: boolean; inline_references?: boolean }) {
    return this.request('/summarizer/search', {
      key,
      ...options,
    });
  }
}

// Usage
const brave = new BraveSearchClient({
  apiKey: process.env.BRAVE_API_KEY!,
});

// Web search
const webResults = await brave.webSearch({
  q: 'artificial intelligence trends 2025',
  count: 20,
  country: 'US',
  search_lang: 'en',
  freshness: 'pm', // Past month
  extra_snippets: true,
});

console.log(webResults.web.results);
```

### With AI Summarization

```typescript
async function searchWithSummary(query: string) {
  const brave = new BraveSearchClient({
    apiKey: process.env.BRAVE_API_KEY!,
  });

  // Step 1: Search with summary enabled
  const searchResults = await brave.webSearch({
    q: query,
    count: 10,
    summary: true,
  });

  // Step 2: If summary key is available, get the AI summary
  if (searchResults.summarizer?.key) {
    const summary = await brave.getSummary(searchResults.summarizer.key, {
      entity_info: true,
      inline_references: true,
    });
    return {
      results: searchResults.web.results,
      summary: summary,
    };
  }

  return {
    results: searchResults.web.results,
    summary: null,
  };
}
```

### Complete Research Service Example

```typescript
interface SearchResult {
  title: string;
  url: string;
  description: string;
  source: string;
  age?: string;
  snippets?: string[];
}

interface ResearchResult {
  webResults: SearchResult[];
  newsResults: SearchResult[];
  videoResults: any[];
  summary?: string;
  query: string;
  timestamp: string;
}

class BraveResearchService {
  private client: BraveSearchClient;

  constructor(apiKey: string) {
    this.client = new BraveSearchClient({ apiKey });
  }

  async researchTopic(query: string): Promise<ResearchResult> {
    // Parallel requests for efficiency
    const [webSearch, newsSearch, videoSearch] = await Promise.all([
      this.client.webSearch({
        q: query,
        count: 20,
        country: 'US',
        freshness: 'pm',
        extra_snippets: true,
        summary: true,
      }),
      this.client.newsSearch({
        q: query,
        count: 10,
        freshness: 'pw',
      }),
      this.client.videoSearch({
        q: query,
        count: 10,
      }),
    ]);

    // Get AI summary if available
    let summaryText: string | undefined;
    if (webSearch.summarizer?.key) {
      try {
        const summaryResult = await this.client.getSummary(webSearch.summarizer.key, {
          inline_references: true,
        });
        summaryText = summaryResult.summary;
      } catch (error) {
        console.warn('Summary not available:', error);
      }
    }

    return {
      webResults: this.formatWebResults(webSearch.web?.results || []),
      newsResults: this.formatNewsResults(newsSearch.news?.results || []),
      videoResults: videoSearch.videos?.results || [],
      summary: summaryText,
      query: query,
      timestamp: new Date().toISOString(),
    };
  }

  private formatWebResults(results: any[]): SearchResult[] {
    return results.map(r => ({
      title: r.title,
      url: r.url,
      description: r.description?.replace(/<[^>]*>/g, '') || '',
      source: r.profile?.name || new URL(r.url).hostname,
      age: r.age,
      snippets: r.extra_snippets,
    }));
  }

  private formatNewsResults(results: any[]): SearchResult[] {
    return results.map(r => ({
      title: r.title,
      url: r.url,
      description: r.description?.replace(/<[^>]*>/g, '') || '',
      source: r.meta_url?.netloc || 'Unknown',
      age: r.age,
    }));
  }
}

// Usage
const research = new BraveResearchService(process.env.BRAVE_API_KEY!);

// Research a topic
const data = await research.researchTopic('machine learning applications');
console.log('Summary:', data.summary);
console.log('Top Results:', data.webResults.slice(0, 5));
```

### Error Handling with Retry

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on client errors (except rate limits)
      if (error.response?.status >= 400 &&
          error.response?.status < 500 &&
          error.response?.status !== 429) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

// Usage
const results = await withRetry(() =>
  brave.webSearch({ q: 'trending designs', count: 20 })
);
```

---

## Python Implementation

### Installation

```bash
pip install brave-search
```

### Basic Usage

```python
from brave import Brave
import os

# Initialize client
brave = Brave(api_key=os.environ.get('BRAVE_API_KEY'))

# Web search
results = brave.search(q="machine learning trends", count=20)

# Access results
web_results = results.web_results
news_results = results.news_results
video_results = results.video_results

# Get product prices (for e-commerce queries)
prices = results.product_prices()
price_range = results.product_price_ranges()

# Get average review score
avg_score = results.average_product_review_score()
```

### With Goggles (Custom Re-ranking)

```python
# Use a Goggle to prioritize specific sources
results = brave.search(
    q="software engineering best practices",
    count=20,
    goggles_id="https://raw.githubusercontent.com/example/goggle.goggle"
)
```

---

## Next.js API Route Example

```typescript
// app/api/brave-search/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const count = searchParams.get('count') || '10';

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({
        q: query,
        count,
        country: 'US',
        search_lang: 'en',
      })}`,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': process.env.BRAVE_API_KEY!,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Brave API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Brave Search error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

## MCP Server Integration

Brave provides an official MCP server for integration with AI agents like Claude.

### Installation via Smithery

```bash
npx -y @smithery/cli install brave
```

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@brave/brave-search-mcp-server"],
      "env": {
        "BRAVE_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `brave_web_search` | Comprehensive web search |
| `brave_local_search` | Local business search (Pro) |
| `brave_image_search` | Image search |
| `brave_video_search` | Video search |
| `brave_news_search` | News search |
| `brave_summarizer` | AI-powered summaries |

### MCP Tool Parameters

All tools support these common parameters:
- `query` (required): Search terms (max 400 chars, 50 words)
- `country`: Country code (default: "US")
- `search_lang`: Search language (default: "en")
- `count`: Results count
- `safesearch`: "off", "moderate", "strict"
- `freshness`: Time filter

### Environment Variables for MCP Server

| Variable | Default | Description |
|----------|---------|-------------|
| `BRAVE_API_KEY` | - | API key (required) |
| `BRAVE_MCP_TRANSPORT` | "stdio" | Transport: "stdio" or "http" |
| `BRAVE_MCP_PORT` | 8080 | HTTP server port |
| `BRAVE_MCP_HOST` | "0.0.0.0" | HTTP server host |
| `BRAVE_MCP_LOG_LEVEL` | "info" | Logging level |
| `BRAVE_MCP_ENABLED_TOOLS` | - | Tool whitelist |
| `BRAVE_MCP_DISABLED_TOOLS` | - | Tool blacklist |

---

## Goggles (Custom Re-ranking)

Goggles allow custom re-ranking of search results. They're defined as text files with rules and filters.

### Using a Goggle

```typescript
const results = await brave.webSearch({
  q: 'design trends',
  goggles_id: 'https://raw.githubusercontent.com/user/repo/main/my-goggle.goggle',
});
```

### Goggle Use Cases
- Boost results from specific domains
- Filter out certain sites
- Prioritize academic or archival sources
- Create niche-specific search experiences

---

## Rate Limits

| Plan | Queries/Second | Queries/Month |
|------|----------------|---------------|
| Free | 1 | 2,000 |
| Base | 20 | 20,000,000 |
| Pro | 50 | 20,000,000 |
| Data for AI | 50 | Unlimited |

**Notes:**
- Rate limits are per API key
- Exceeding limits returns 429 status code
- Implement exponential backoff for retries

---

## Best Practices

### Cost Optimization

1. **Use the Free tier for development** - 2,000 queries/month is sufficient for testing
2. **Cache results** - Store results for common queries
3. **Batch requests efficiently** - Group related searches
4. **Use appropriate count values** - Don't request more results than needed
5. **Filter result types** - Use `result_filter` to get only what you need

### Performance Optimization

1. **Enable gzip compression** - Use `Accept-Encoding: gzip` header
2. **Use pagination wisely** - Max offset is 9, plan accordingly
3. **Implement request queuing** - Respect rate limits
4. **Use freshness filters** - Reduce result set with time constraints

### Search Quality

1. **Use specific queries** - More specific = better results
2. **Leverage Goggles** - Custom re-ranking for your use case
3. **Enable extra_snippets** - More context per result (Pro)
4. **Use summary feature** - AI-powered synthesis (Pro)
5. **Combine endpoints** - Web + News + Video for comprehensive research

### Security

1. **Never expose API key client-side** - Use server-side proxies
2. **Validate user inputs** - Sanitize search queries
3. **Monitor usage** - Track API consumption
4. **Rotate keys periodically** - Regenerate API keys

---

## Environment Variables

```bash
# Required
BRAVE_API_KEY=your-api-key-here

# Optional for MCP Server
BRAVE_MCP_TRANSPORT=stdio
BRAVE_MCP_PORT=8080
BRAVE_MCP_LOG_LEVEL=info
```

---

## Additional Resources

- **API Dashboard**: https://api-dashboard.search.brave.com
- **Documentation**: https://api-dashboard.search.brave.com/app/documentation
- **Pricing Plans**: https://api-dashboard.search.brave.com/app/plans
- **MCP Server**: https://github.com/brave/brave-search-mcp-server
- **Python SDK**: https://pypi.org/project/brave-search/
- **API Landing Page**: https://brave.com/search/api/
- **Goggles**: https://search.brave.com/goggles
- **Smithery (MCP)**: https://smithery.ai/server/brave

---

*Documentation compiled from official Brave Search API reference. Last updated: December 2025.*

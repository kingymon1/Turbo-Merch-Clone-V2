# Decodo Web Scraping API Documentation

## Overview

Decodo (formerly Smartproxy) provides a comprehensive web scraping API that handles proxies, browsers, CAPTCHAs, and anti-bot mechanisms automatically. The API is designed for large-scale data extraction from eCommerce sites, search engines, social media platforms, and general websites.

**Key Features:**
- 125M+ residential IP pool with automatic rotation
- JavaScript rendering for dynamic pages
- Pre-built templates for major targets (Amazon, Google, YouTube, TikTok, etc.)
- Automatic CAPTCHA solving and anti-bot bypassing
- Synchronous (real-time) and asynchronous (batch) request modes
- Structured output in HTML, JSON, CSV, or Markdown formats
- Success-based pricing (only pay for successful requests)

## Authentication

Decodo uses HTTP Basic Authentication with username and password credentials.

**Base URL:** `https://scraper-api.decodo.com/v2`

**Getting Credentials:**
1. Sign up at https://dashboard.decodo.com
2. Navigate to Scraping APIs and Pricing
3. Choose between Core and Advanced plans
4. Find your username, password, and authentication token in the Scraper tab

```bash
# Basic Auth format
curl -u username:password 'https://scraper-api.decodo.com/v2/scrape' \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "target": "universal"}'
```

## Pricing Plans

### Core Plans (Essential scraping)
- **100K requests**: $29/month ($0.29/1K requests)
- **Lowest tier**: ~$0.08/1K requests at high volume
- **Features**: Basic scraping, 8 geo locations, HTML output only
- **Limitations**: No JS rendering, no target templates, no task scheduling

### Advanced Plans (Full customization)
- **23K requests**: $20/month (~$0.88/1K requests with SCRAPE30 code)
- **82K requests**: $69/month (~$0.84/1K requests)
- **216K requests**: $179/month (~$0.81/1K requests)
- **455K requests**: $349/month (~$0.77/1K requests)
- **950K requests**: $699/month (~$0.74/1K requests)
- **2M requests**: $1,399/month (~$0.70/1K requests)

**Advanced Plan Features:**
- Pre-built target templates with dedicated parsers
- JavaScript rendering
- All geo locations (195+)
- Multiple output formats (HTML, JSON, CSV, Markdown)
- Task scheduling (hourly, daily, weekly, monthly, custom cron)
- Browser actions (scroll, click, wait)

**Free Trial:** 7-day trial with 1K requests available for both plans.

## API Endpoints

### Synchronous (Real-time) Requests
**Endpoint:** `POST /v2/scrape`

Real-time scraping with open connection until response. Timeout limit: 150 seconds.

```bash
curl -u username:password 'https://scraper-api.decodo.com/v2/scrape' \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "target": "universal"
  }'
```

### Asynchronous Requests
**Endpoint:** `POST /v2/task`

Queue tasks and retrieve results later or via callback.

```bash
# Submit task
curl -u username:password 'https://scraper-api.decodo.com/v2/task' \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "target": "universal",
    "callback_url": "https://your-webhook.com/callback"
  }'

# Response contains task_id
# {"id": "7039164056019693569", ...}

# Retrieve results
curl -u username:password 'https://scraper-api.decodo.com/v2/task/7039164056019693569/results'
```

### Batch Requests
**Endpoint:** `POST /v2/task/batch`

Submit up to 3,000 URLs/queries in a single batch. One batch must have only one target type.

```bash
curl -u username:password 'https://scraper-api.decodo.com/v2/task/batch' \
  -H "Content-Type: application/json" \
  -d '{
    "target": "google_search",
    "domain": "com",
    "queries": ["keyword1", "keyword2", "keyword3"],
    "parse": true
  }'
```

## Request Parameters

| Parameter | Default | Description | Core |
|-----------|---------|-------------|------|
| `url` or `query` | null | **Required.** Target URL or search query | ✅ (url only) |
| `target` | null | Target template name (e.g., `google_search`, `amazon_product`) | ❌ |
| `headless` | null | `html` for JS rendering, `png` for screenshot | ❌ |
| `geo` | auto | Geographic location (e.g., `United States`, `Germany`) | ✅ (8 locations) |
| `domain` | `com` | Top-level domain (e.g., `com`, `co.uk`, `de`) | ❌ |
| `locale` | matched to domain | Web interface language (e.g., `en-US`, `de-DE`) | ❌ |
| `headers` | null | Custom request headers | ❌ |
| `cookies` | null | Custom cookies | ❌ |
| `force_headers` | false | Force custom headers to be used | ❌ |
| `force_cookies` | false | Force custom cookies to be used | ❌ |
| `device_type` | `desktop` | `desktop`, `desktop_chrome`, `desktop_firefox`, `mobile`, `mobile_android`, `mobile_ios` | ❌ |
| `parse` | false | Return structured JSON data | ❌ |
| `session_id` | null | Sticky session for up to 10 minutes | ❌ |
| `http_method` | `GET` | HTTP method (`GET` or `POST`) | ✅ |
| `payload` | null | Base64-encoded POST body | ✅ |
| `successful_status_codes` | null | Additional status codes to accept (e.g., `401`, `404`) | ✅ |
| `markdown` | false | Parse HTML to Markdown (reduces LLM token count) | ❌ |
| `xhr` | false | Capture XHR and fetch requests | ❌ |
| `callback_url` | null | Webhook URL for async results | ✅ |

**Core Plan Supported Geo Locations:** `US`, `CA`, `GB`, `DE`, `FR`, `NL`, `JP`, `RO`

## Target Templates (Advanced Plans Only)

### Amazon Targets
| Target | Description | Required Params |
|--------|-------------|-----------------|
| `amazon` | Any Amazon URL | `url` |
| `amazon_product` | Product by ASIN | `query` (ASIN) |
| `amazon_pricing` | Pricing by ASIN | `query` (ASIN) |
| `amazon_search` | Search results | `query` |
| `amazon_sellers` | Seller listings | `query` (ASIN) |
| `amazon_bestsellers` | Bestseller rankings | `url` or `query` |

```javascript
// Amazon product example
const params = {
  target: 'amazon_product',
  query: 'B0BSHF7WHW',  // ASIN
  geo: 'United States',
  parse: true
};
```

### Google Targets
| Target | Description | Required Params |
|--------|-------------|-----------------|
| `google_search` | Search results | `query`, `domain` |
| `google_ads` | Search with ads | `query`, `domain` |
| `google_shopping_search` | Shopping search | `query` |
| `google_shopping_product` | Shopping product | `query` (product ID) |
| `google_maps` | Maps results | `query` |
| `google_suggest` | Autocomplete | `query` |
| `google_travel_hotels` | Hotel search | `query` |
| `google_lens` | Visual search | `url` (image URL) |
| `google_ai_mode` | AI Mode results | `query` |

```javascript
// Google search example
const params = {
  target: 'google_search',
  query: 'best running shoes 2025',
  domain: 'com',
  geo: 'New York,New York,United States',
  parse: true
};
```

### Social Media Targets
| Target | Description | Required Params |
|--------|-------------|-----------------|
| `reddit_post` | Reddit post | `url` |
| `reddit_subreddit` | Subreddit | `url` |
| `reddit_user` | User profile | `url` |
| `tiktok_post` | TikTok video | `url` |
| `tiktok_shop_product` | TikTok Shop product | `url` |
| `tiktok_shop_search` | TikTok Shop search | `query` |
| `youtube_transcript` | Video transcript | `url` |
| `youtube_metadata` | Video metadata | `url` |

### eCommerce Targets
| Target | Description | Required Params |
|--------|-------------|-----------------|
| `walmart` | Any Walmart URL | `url` |
| `walmart_product` | Product details | `url` |
| `walmart_search` | Search results | `query` |
| `target` | Any Target.com URL | `url` |
| `target_product` | Product details | `url` |
| `target_search` | Search results | `query` |

### Other Targets
| Target | Description | Required Params |
|--------|-------------|-----------------|
| `universal` | Any website | `url` |
| `bing_search` | Bing search | `query` |
| `perplexity` | Perplexity AI query | `query` |
| `chatgpt` | ChatGPT query | `query` |
| `video` | Video download | `url` |

## Response Format

### Successful Response (200)
```json
{
  "results": [
    {
      "content": "<html>...</html>",
      "status_code": 200,
      "url": "https://example.com",
      "task_id": "6971034977135771649",
      "created_at": "2022-09-01 09:24:14",
      "updated_at": "2022-09-01 09:24:17"
    }
  ]
}
```

### Parsed Response (with `parse: true`)
```json
{
  "results": [
    {
      "content": {
        "title": "Product Title",
        "price": "$29.99",
        "rating": 4.5,
        "reviews_count": 1234,
        ...
      },
      "status_code": 200,
      "url": "...",
      "task_id": "...",
      "parse_status": "success"
    }
  ]
}
```

## Response Codes

| Code | Status | Description | Billable |
|------|--------|-------------|----------|
| 200 | Success | Request completed successfully | ✅ |
| 204 | No Content | Async job still processing, retry later | ❌ |
| 400 | Bad Request | Invalid request structure | ❌ |
| 401 | Unauthorized | Invalid or missing credentials | ❌ |
| 403 | Forbidden | Account lacks access to resource | ❌ |
| 404 | Not Found | Target URL not found | ✅ |
| 429 | Too Many Requests | Rate limit exceeded | ❌ |
| 500 | Server Error | Service temporarily unavailable | ❌ |
| 503 | Service Unavailable | Maintenance or overload | ❌ |

**Note:** Responses with 2xx or 4xx status codes are considered successful (billable). 5xx codes are retried automatically.

## Implementation Examples

### TypeScript/Node.js

```typescript
import axios from 'axios';

interface DecodoConfig {
  username: string;
  password: string;
}

interface ScrapeParams {
  url?: string;
  query?: string;
  target: string;
  parse?: boolean;
  geo?: string;
  headless?: 'html' | 'png';
  markdown?: boolean;
}

interface ScrapeResult {
  content: string | object;
  status_code: number;
  url: string;
  task_id: string;
  created_at: string;
  updated_at: string;
  parse_status?: string;
}

async function scrape(
  config: DecodoConfig,
  params: ScrapeParams
): Promise<ScrapeResult[]> {
  const response = await axios.post(
    'https://scraper-api.decodo.com/v2/scrape',
    params,
    {
      auth: {
        username: config.username,
        password: config.password
      },
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 150000 // 150 second timeout
    }
  );

  return response.data.results;
}

// Usage: Amazon product scrape
async function scrapeAmazonProduct(asin: string) {
  const config = {
    username: process.env.DECODO_USERNAME!,
    password: process.env.DECODO_PASSWORD!
  };

  const results = await scrape(config, {
    target: 'amazon_product',
    query: asin,
    geo: 'United States',
    parse: true
  });

  return results[0].content;
}

// Usage: Google search
async function googleSearch(query: string) {
  const config = {
    username: process.env.DECODO_USERNAME!,
    password: process.env.DECODO_PASSWORD!
  };

  const results = await scrape(config, {
    target: 'google_search',
    query,
    domain: 'com',
    parse: true
  });

  return results[0].content;
}
```

### Python

```python
import requests
import os
from typing import Optional, Dict, Any, List

class DecodoScraper:
    BASE_URL = 'https://scraper-api.decodo.com/v2'

    def __init__(self, username: str, password: str):
        self.auth = (username, password)
        self.headers = {'Content-Type': 'application/json'}

    def scrape(
        self,
        target: str,
        url: Optional[str] = None,
        query: Optional[str] = None,
        parse: bool = False,
        geo: Optional[str] = None,
        headless: Optional[str] = None,
        markdown: bool = False,
        **kwargs
    ) -> List[Dict[str, Any]]:
        """Synchronous scrape request."""
        params = {
            'target': target,
            'parse': parse,
            'markdown': markdown,
            **kwargs
        }

        if url:
            params['url'] = url
        if query:
            params['query'] = query
        if geo:
            params['geo'] = geo
        if headless:
            params['headless'] = headless

        response = requests.post(
            f'{self.BASE_URL}/scrape',
            json=params,
            auth=self.auth,
            headers=self.headers,
            timeout=150
        )
        response.raise_for_status()
        return response.json()['results']

    def scrape_async(
        self,
        target: str,
        callback_url: Optional[str] = None,
        **kwargs
    ) -> str:
        """Asynchronous scrape request. Returns task_id."""
        params = {'target': target, **kwargs}
        if callback_url:
            params['callback_url'] = callback_url

        response = requests.post(
            f'{self.BASE_URL}/task',
            json=params,
            auth=self.auth,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()['id']

    def get_task_results(self, task_id: str) -> List[Dict[str, Any]]:
        """Get results for an async task."""
        response = requests.get(
            f'{self.BASE_URL}/task/{task_id}/results',
            auth=self.auth
        )
        response.raise_for_status()
        return response.json()['results']

    def batch_scrape(
        self,
        target: str,
        queries: Optional[List[str]] = None,
        urls: Optional[List[str]] = None,
        **kwargs
    ) -> str:
        """Batch scrape up to 3000 URLs/queries. Returns batch_id."""
        params = {'target': target, **kwargs}
        if queries:
            params['queries'] = queries
        if urls:
            params['urls'] = urls

        response = requests.post(
            f'{self.BASE_URL}/task/batch',
            json=params,
            auth=self.auth,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()['id']


# Usage examples
if __name__ == '__main__':
    scraper = DecodoScraper(
        username=os.environ['DECODO_USERNAME'],
        password=os.environ['DECODO_PASSWORD']
    )

    # Amazon product scrape
    results = scraper.scrape(
        target='amazon_product',
        query='B0BSHF7WHW',
        geo='United States',
        parse=True
    )
    print(results[0]['content'])

    # Google search with markdown output
    results = scraper.scrape(
        target='google_search',
        query='python web scraping tutorial',
        domain='com',
        parse=True,
        markdown=True
    )
    print(results[0]['content'])

    # Universal scrape any URL
    results = scraper.scrape(
        target='universal',
        url='https://example.com',
        headless='html',  # Enable JS rendering
        markdown=True
    )
    print(results[0]['content'])
```

### Next.js API Route

```typescript
// app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';

const DECODO_USERNAME = process.env.DECODO_USERNAME!;
const DECODO_PASSWORD = process.env.DECODO_PASSWORD!;

interface ScrapeRequest {
  target: string;
  url?: string;
  query?: string;
  parse?: boolean;
  geo?: string;
  markdown?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: ScrapeRequest = await request.json();

    const credentials = Buffer.from(
      `${DECODO_USERNAME}:${DECODO_PASSWORD}`
    ).toString('base64');

    const response = await fetch(
      'https://scraper-api.decodo.com/v2/scrape',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${credentials}`
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      throw new Error(`Decodo API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Scrape failed' },
      { status: 500 }
    );
  }
}
```

## Error Handling with Retry Logic

```typescript
import axios, { AxiosError } from 'axios';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

async function scrapeWithRetry(
  params: any,
  config: RetryConfig = { maxRetries: 3, baseDelay: 1000, maxDelay: 30000 }
): Promise<any> {
  const { maxRetries, baseDelay, maxDelay } = config;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        'https://scraper-api.decodo.com/v2/scrape',
        params,
        {
          auth: {
            username: process.env.DECODO_USERNAME!,
            password: process.env.DECODO_PASSWORD!
          },
          headers: { 'Content-Type': 'application/json' },
          timeout: 150000
        }
      );

      return response.data;

    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      // Don't retry on client errors (except 429)
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw error;
      }

      // Last attempt, throw error
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate exponential backoff delay
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );

      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## MCP Server Integration (Claude Code/Claude Desktop)

Decodo provides an official MCP server for integration with Claude Desktop, Cursor, Windsurf, and other MCP-compatible clients.

### Installation via Smithery
Visit https://smithery.ai/server/decodo-mcp-server and follow the instructions for your MCP client.

### Manual Installation

**GitHub:** https://github.com/Decodo/mcp-web-scraper

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "decodo-mcp": {
      "command": "node",
      "args": ["/path/to/decodo-mcp/build/index.js"],
      "env": {
        "SCRAPER_API_USERNAME": "your_username",
        "SCRAPER_API_PASSWORD": "your_password"
      }
    }
  }
}
```

**Features:**
- Easy web data access from websites
- Geographic flexibility (bypass geo-restrictions)
- Enhanced privacy and anonymity
- Reliable scraping with anti-detection
- Seamless integration with popular MCP clients

### Claude Code CLI
```bash
claude mcp add decodo-mcp \
  -e SCRAPER_API_USERNAME=your_username \
  -e SCRAPER_API_PASSWORD=your_password \
  -- npx @decodo/mcp-server
```

## LangChain Integration

Decodo provides official LangChain tools for TypeScript/JavaScript.

**Package:** `@decodo/langchain-ts`

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from '@langchain/agents';
import { DecodoUniversalTool, DecodoGoogleSearchTool } from '@decodo/langchain-ts';

const decodoTool = new DecodoUniversalTool({
  username: process.env.SCRAPER_API_USERNAME!,
  password: process.env.SCRAPER_API_PASSWORD!
});

const googleSearchTool = new DecodoGoogleSearchTool({
  username: process.env.SCRAPER_API_USERNAME!,
  password: process.env.SCRAPER_API_PASSWORD!
});

const model = new ChatOpenAI({ model: 'gpt-4o-mini' });

const agent = createAgent({
  llm: model,
  tools: [decodoTool, googleSearchTool]
});

const result = await agent.invoke({
  messages: [
    {
      role: 'user',
      content: 'Scrape the Wikipedia NBA 2025 season page and tell me who won.'
    }
  ]
});
```

## Best Practices

### 1. Use Target Templates When Available
Target templates include specialized unblocking strategies and dedicated parsers. Always prefer `amazon_product` over `universal` when scraping Amazon products.

### 2. Enable Parsing for Structured Data
Set `parse: true` to get structured JSON instead of raw HTML. This reduces post-processing and improves reliability.

### 3. Use Markdown for LLM Integration
Set `markdown: true` to reduce token count when feeding results to language models.

### 4. Handle Rate Limits Gracefully
Implement exponential backoff for 429 errors. Contact support if you consistently hit rate limits.

### 5. Use Async for Large Jobs
For batch processing, use asynchronous endpoints with callbacks to avoid timeout issues.

### 6. Leverage Sessions for Multi-Page Scraping
Use `session_id` to maintain the same IP for related requests (e.g., login → dashboard → data).

### 7. Specify Geo Location for Local Results
Always set `geo` parameter for location-dependent searches (Google, Amazon, Walmart).

### 8. Test in Playground First
Use the Dashboard Playground to test configurations before implementing in code.

## Rate Limits and Concurrency

- **Open connection timeout:** 150 seconds for synchronous requests
- **Batch limit:** 3,000 URLs/queries per batch request
- **Session duration:** Up to 10 minutes with `session_id`
- **Rate limits:** Based on subscription tier (contact support for specifics)

## Support Resources

- **Documentation:** https://help.decodo.com/docs
- **GitHub Examples:** https://github.com/Decodo/Web-Scraping-API
- **Dashboard:** https://dashboard.decodo.com
- **Support Email:** support@decodo.com
- **24/7 Live Chat:** Available on website
- **Discord Community:** https://discord.gg/r3aGGJF5tZ

## Environment Variables

```bash
# .env
DECODO_USERNAME=your_scraper_username
DECODO_PASSWORD=your_scraper_password

# Alternative naming (for MCP server)
SCRAPER_API_USERNAME=your_scraper_username
SCRAPER_API_PASSWORD=your_scraper_password
```

---

*Documentation compiled from official Decodo docs and API reference. Last updated: December 2025.*

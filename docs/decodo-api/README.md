# Decodo API Reference

## What is Decodo?

Decodo (formerly Smartproxy) provides eCommerce scraping APIs. We use it to get Amazon and Etsy product data for marketplace intelligence.

**Documentation:** https://docs.decodo.com/scraping-api/ecommerce

**Dashboard:** https://dashboard.decodo.com/

## How We Use It

We fetch marketplace data to help the AI make better design decisions:

1. **Amazon Search** - Find t-shirt products for a given topic
2. **Etsy Search** - Find handmade/POD shirt products
3. **Product Details** - Get detailed info on specific products (ASIN lookup)
4. **Reviews** - Get customer reviews for sentiment analysis

The data helps us understand:
- What's already selling (saturation)
- Price ranges in a niche
- Keywords that work
- Gaps in the market

## Where the API Key Goes

Add to your `.env` file:

```
DECODO_USERNAME=your_username
DECODO_PASSWORD=your_password
NEXT_PUBLIC_MARKETPLACE_ENABLED=true
```

**Get credentials from:** https://dashboard.decodo.com/ (API section)

## Key Files

| File | Purpose |
|------|---------|
| `services/marketplaceIntelligence.ts` | Main API integration - search, parse, build context |
| `services/marketplaceLearning.ts` | Stores data over time, learns patterns |
| `prisma/schema.prisma` | Database models for marketplace data |
| `.env.example` | Template with required env vars |

## API Endpoints We Use

All requests go to: `https://scraper-api.decodo.com/v2/scrape`

### Amazon Search
```json
{
  "target": "amazon_search",
  "query": "hiking t-shirt",
  "locale": "en-US",
  "page_from": 1,
  "parse": true
}
```

### Etsy Search
```json
{
  "target": "etsy_search",
  "query": "hiking shirt",
  "parse": true
}
```

### Amazon Product (by ASIN)
```json
{
  "target": "amazon_product",
  "query": "B08XYZ1234",
  "locale": "en-US",
  "parse": true
}
```

### Amazon Reviews
```json
{
  "target": "amazon_reviews",
  "query": "B08XYZ1234",
  "locale": "en-US",
  "page_from": 1,
  "parse": true
}
```

## Authentication

Basic Auth header with base64-encoded `username:password`:

```
Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
```

## Important Notes

### Graceful Degradation
The system **never fails** if Decodo is unavailable. If the API is down, misconfigured, or rate-limited, we just skip marketplace data and continue with other sources.

### Caching
Results are cached for 24 hours in-memory. Same search won't hit the API twice in a day.

### Mode-Aware Behavior
Marketplace data is interpreted differently based on virality mode:

| Mode | How Marketplace Data is Used |
|------|------------------------------|
| Safe (0-25) | Follow the market - prioritize proven bestsellers |
| Balanced (26-50) | Validate trends - find gaps to differentiate |
| Aggressive (51-75) | Find whitespace - low competition is good |
| Predictive (76-100) | Inverse signal - if it exists, you're too late |

### Learning Engine
When `NEXT_PUBLIC_MARKETPLACE_ENABLED=true` and database is configured:
- Scraped products are stored for pattern analysis
- Over time, learns what design styles/keywords work
- Learned patterns are included in AI context

### Cost Considerations
- Each unique search = 1 API call
- Caching reduces repeat calls
- Only fetches when `MARKETPLACE_ENABLED=true`
- Typical usage: 2 calls per trend search (Amazon + Etsy)

## Troubleshooting

**"API not configured"** - Check `DECODO_USERNAME` and `DECODO_PASSWORD` in `.env`

**"Request timed out"** - API has 30s timeout. May indicate Decodo issues.

**No data returned** - Check if query is too specific. Try broader terms.

**Enable logging** - Look for `[MARKETPLACE]` in console output

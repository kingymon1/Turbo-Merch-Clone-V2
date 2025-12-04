# Grok API Reference

## Quick Reference

| Item | Value |
|------|-------|
| **Docs URL** | https://docs.x.ai/docs/guides/tools/overview |
| **API Endpoint** | `https://api.x.ai/v1/responses` (Agent Tools) |
| **Legacy Endpoint** | `https://api.x.ai/v1/chat/completions` (deprecated Dec 15, 2025) |
| **Auth** | Bearer token in Authorization header |
| **Default Model** | `grok-4-1-fast-reasoning` |

## Pricing

| Type | Cost |
|------|------|
| **Input tokens** | $0.20 per 1M tokens |
| **Cached tokens** | $0.05 per 1M tokens |
| **Output tokens** | $0.50 per 1M tokens |
| **Live Search sources** | $25 per 1,000 sources ($0.025 per source) |

## Where API Key Goes

```env
# .env file
NEXT_PUBLIC_GROK_API_KEY=your_grok_api_key_here
GROK_MODEL=grok-4-1-fast-reasoning
```

Get your API key from: https://x.ai/api

## Key Files

| File | Purpose |
|------|---------|
| `app/api/grok/route.ts` | API route that proxies requests to xAI |
| `services/geminiService.ts` | Contains `fetchGrokSignals()` and `unleashedGrokAgent()` |

---

## Agent Tools API (Current - Recommended)

The Agent Tools API uses the `/v1/responses` endpoint with a `tools` array. The model decides when and how to search.

### Request Format

```javascript
const response = await fetch('https://api.x.ai/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: "grok-4-1-fast-reasoning",
    input: [
      { role: "system", content: "You have access to search tools..." },
      { role: "user", content: "What's trending about AI?" }
    ],
    tools: [
      { type: "web_search" },
      { type: "x_search" }
    ],
    temperature: 0.3
  })
});
```

### Key Differences from Legacy API

| Aspect | Agent Tools API | Legacy Live Search API |
|--------|-----------------|----------------------|
| Endpoint | `/v1/responses` | `/v1/chat/completions` |
| Message field | `input` | `messages` |
| Search config | `tools: [{ type: "..." }]` | `search_parameters: { ... }` |
| Response field | `output` array | `choices` array |
| Model control | Model decides when to search | Manual mode control |

### Available Tools

| Tool | Description |
|------|-------------|
| `web_search` | Search the web for current information |
| `x_search` | Search X/Twitter for posts and discussions |

### Response Format

```javascript
{
  "id": "resp_...",
  "output": [
    {
      "type": "message",
      "content": "Based on my search..."
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300
  }
}
```

### Parsing the Response

```javascript
// Agent Tools API response parsing
let content = "";
if (data.output) {
    content = data.output
        .filter(item => item.type === "message")
        .map(item => item.content)
        .join("\n");
} else if (data.choices?.[0]?.message?.content) {
    // Fallback to legacy format
    content = data.choices[0].message.content;
}
```

---

## Available Models

| Model | Description | Recommended Use |
|-------|-------------|-----------------|
| `grok-4-1-fast-reasoning` | Latest, optimized for tool calling (2M context) | **Default - Best for agentic search** |
| `grok-4` | Full reasoning model | Complex analysis |
| `grok-3` | Production model | General use |
| `grok-3-mini` | Smaller/faster | Quick queries |

All models support both Agent Tools and Live Search APIs.

---

## TurboMerch Integration

### Virality Level Strategy

We adjust search guidance based on the virality slider:

| Level | Strategy | Search Guidance |
|-------|----------|-----------------|
| Safe (0-25) | Established | Focus on proven viral content with high engagement |
| Balanced (26-50) | Rising | Look for moderately popular but growing trends |
| Aggressive (51-75) | Emerging | Find newer content that's gaining traction |
| Predictive (76-100) | Underground | Hunt for small accounts, niche communities |

### Implementation

```javascript
const GROK_MODEL = process.env.GROK_MODEL || 'grok-4-1-fast-reasoning';

// Virality-based search guidance
let searchGuidance = "";
if (viralityLevel <= 25) {
    searchGuidance = "Focus on ESTABLISHED, proven viral content with high engagement.";
} else if (viralityLevel <= 50) {
    searchGuidance = "Look for RISING trends - moderately popular but growing.";
} else if (viralityLevel <= 75) {
    searchGuidance = "Find EMERGING trends - newer content that's gaining traction.";
} else {
    searchGuidance = "Hunt for the UNDERGROUND - small accounts, niche communities.";
}

// Request with Agent Tools API
const response = await fetch('/api/grok', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        model: GROK_MODEL,
        input: [
            { role: "system", content: `Search strategy: ${searchGuidance}` },
            { role: "user", content: `Search for: "${query}"` }
        ],
        tools: [
            { type: "web_search" },
            { type: "x_search" }
        ],
        temperature: 0.3
    })
});
```

---

## Cost Tracking

We log costs in `app/api/grok/route.ts`:

```javascript
const usage = data.usage || {};
if (usage.prompt_tokens || usage.completion_tokens) {
    const inputCost = (usage.prompt_tokens || 0) * 0.20 / 1_000_000;
    const outputCost = (usage.completion_tokens || 0) * 0.50 / 1_000_000;
    console.log(`[GROK API] Tokens - Input: ${usage.prompt_tokens || 0}, Output: ${usage.completion_tokens || 0}`);
    console.log(`[GROK API] Cost: $${(inputCost + outputCost).toFixed(6)}`);
}
```

---

## Troubleshooting

### 400 Bad Request

**Possible causes:**
1. Using wrong endpoint for the request format
2. Using `messages` instead of `input` for Agent Tools API
3. Using undocumented parameters

**Fix:** Ensure request format matches the endpoint:
- `/v1/responses` requires `input` + `tools`
- `/v1/chat/completions` requires `messages` + `search_parameters`

### Empty Results

1. Verify model has tool access enabled
2. Check prompts instruct the model to use search tools
3. Try increasing temperature slightly

### 403 Forbidden

Verify your API key has the required permissions.

### Debug Logging

Check server console for `[GROK API]` logs:
- Request mode (Agent Tools vs Legacy)
- Model being used
- Token usage and cost
- Error details if request fails

---

## Legacy Live Search API (Deprecated Dec 15, 2025)

> **WARNING:** This API is deprecated and will stop working December 15, 2025. Migrate to Agent Tools API.

### Enabling Live Search

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

### search_parameters Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mode` | string | `"auto"` | `"off"`, `"auto"`, or `"on"` |
| `from_date` | string | none | ISO8601 format `"YYYY-MM-DD"` |
| `to_date` | string | none | ISO8601 format `"YYYY-MM-DD"` |
| `return_citations` | boolean | `true` | Include source URLs in response |
| `sources` | array | `["web", "news", "x"]` | Array of source config objects |

### Data Sources

| Source | Description | Supported Parameters |
|--------|-------------|---------------------|
| `"web"` | Search websites | `country`, `excluded_websites`, `allowed_websites`, `safe_search` |
| `"x"` | Search X/Twitter posts | `included_x_handles`, `excluded_x_handles`, `post_favorite_count`, `post_view_count` |
| `"news"` | Search news sources | `country`, `excluded_websites`, `safe_search` |
| `"rss"` | Fetch from RSS feed | `links` |

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-04 | Migrated to Agent Tools API with grok-4-1-fast-reasoning |
| 2025-12-04 | Added dual API support (Agent Tools + Legacy) |
| 2025-12-04 | Removed `max_search_results` (causes 400 errors) |
| 2025-12-04 | Confirmed grok-4 supports search_parameters |
| 2025-12-04 | Added comprehensive parameter documentation |

# Perplexity API Complete Documentation

> **Purpose**: This document provides Claude Code with comprehensive documentation for implementing and working with the Perplexity API. It consolidates official SDK information, API specifications, and implementation patterns.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Available Models](#available-models)
4. [API Endpoints](#api-endpoints)
5. [Chat Completions API](#chat-completions-api)
6. [Search API](#search-api)
7. [Request Parameters Reference](#request-parameters-reference)
8. [Response Structure](#response-structure)
9. [TypeScript/JavaScript Implementation](#typescriptjavascript-implementation)
10. [Python Implementation](#python-implementation)
11. [Streaming](#streaming)
12. [Error Handling](#error-handling)
13. [Best Practices](#best-practices)
14. [MCP Server Integration](#mcp-server-integration)
15. [Pricing Reference](#pricing-reference)

---

## Overview

Perplexity API provides AI-powered search and chat completions with real-time web access. Key differentiators:

- **Real-time web search**: Models fetch current information from the web
- **Source citations**: Responses include references for verifiability
- **OpenAI-compatible**: API structure mirrors OpenAI's Chat Completions API
- **Multiple model tiers**: From fast/cheap to deep research capabilities

**Base URL**: `https://api.perplexity.ai`

**Primary Endpoint**: `POST /chat/completions`

---

## Authentication

All requests require an API key passed in the Authorization header:

```
Authorization: Bearer YOUR_PERPLEXITY_API_KEY
```

### Getting an API Key

1. Create a Perplexity account at perplexity.ai
2. Navigate to API settings
3. Add a payment method
4. Purchase credits (Pro users get $5 monthly free credit)
5. Generate an API key

### Environment Variable (Recommended)

```bash
export PERPLEXITY_API_KEY="pplx-xxxxxxxxxxxxxxxx"
```

---

## Available Models

### Current Sonar Models (Recommended)

| Model | Description | Context | Best For |
|-------|-------------|---------|----------|
| `sonar` | Fast, lightweight, affordable | 127K | Quick Q&A, simple queries |
| `sonar-pro` | Multi-step queries, 2× citations | 200K | Complex research, detailed answers |
| `sonar-reasoning` | Chain-of-thought with web search | 127K | Logical reasoning tasks |
| `sonar-reasoning-pro` | Advanced reasoning | 127K | Complex problem-solving |
| `sonar-deep-research` | Comprehensive multi-step research | 128K | In-depth reports, synthesis |

### Model Selection Guide

- **`sonar`**: Default choice for most queries. Fast and cost-effective.
- **`sonar-pro`**: When you need thorough answers with more sources.
- **`sonar-reasoning`**: For questions requiring step-by-step logic.
- **`sonar-deep-research`**: For comprehensive research reports.

---

## API Endpoints

### Chat Completions (Primary)

```
POST https://api.perplexity.ai/chat/completions
```

Generates AI responses with optional web search grounding.

### Search (Separate API)

```
POST https://api.perplexity.ai/search
```

Returns ranked web search results with filtering. Use when you want raw search data to process yourself.

---

## Chat Completions API

### Basic Request Structure

```typescript
interface ChatCompletionRequest {
  model: string;                    // Required: e.g., "sonar", "sonar-pro"
  messages: Message[];              // Required: conversation messages

  // Optional parameters
  max_tokens?: number;              // Max response length
  temperature?: number;             // 0-2, lower = more focused
  top_p?: number;                   // 0-1, nucleus sampling
  stream?: boolean;                 // Enable streaming

  // Perplexity-specific options
  search_domain_filter?: string[];  // Limit search to specific domains
  return_citations?: boolean;       // Include source URLs
  return_images?: boolean;          // Include images in results
  return_related_questions?: boolean; // Get follow-up suggestions
  search_recency_filter?: string;   // 'day', 'week', 'month', 'year'
  search_after_date_filter?: string; // ISO date string
  search_before_date_filter?: string; // ISO date string
  web_search_options?: {
    search_context_size?: 'high' | 'medium' | 'low';
  };
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### Minimal Example (curl)

```bash
curl -X POST https://api.perplexity.ai/chat/completions \
  -H "Authorization: Bearer ${PERPLEXITY_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonar",
    "messages": [
      {"role": "system", "content": "Be precise and concise."},
      {"role": "user", "content": "What are the latest AI developments?"}
    ]
  }'
```

---

## Search API

The Search API returns raw web search results for custom processing.

### Request Structure

```typescript
interface SearchRequest {
  query: string;           // Search query
  max_results?: number;    // Number of results (default: 5)
  // Additional filtering options available
}
```

### Example

```typescript
const search = await client.search.create({
  query: "latest AI developments 2024",
  max_results: 5
});

for (const result of search.results) {
  console.log(`${result.title}: ${result.url}`);
}
```

---

## Request Parameters Reference

### Core Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | Required | Model to use |
| `messages` | array | Required | Conversation messages |
| `max_tokens` | integer | Model default | Maximum response tokens |
| `temperature` | float | 0.2 | Randomness (0-2) |
| `top_p` | float | 0.9 | Nucleus sampling threshold |
| `stream` | boolean | false | Enable streaming |

### Search Control Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `search_domain_filter` | string[] | Allowlist/denylist domains (max 20). Prefix with `-` to deny. |
| `search_recency_filter` | string | Filter by time: `'day'`, `'week'`, `'month'`, `'year'` |
| `search_after_date_filter` | string | Only content after this date (ISO format) |
| `search_before_date_filter` | string | Only content before this date (ISO format) |
| `return_citations` | boolean | Include source URLs in response |
| `return_images` | boolean | Include images |
| `return_related_questions` | boolean | Suggest follow-up questions |

### Search Context Size

```typescript
web_search_options: {
  search_context_size: 'high' | 'medium' | 'low'
}
```

- **high**: Maximum depth, more expensive, best for complex queries
- **medium**: Balanced approach
- **low**: Cost-optimized, good for straightforward queries

### Domain Filtering Examples

```typescript
// Only search these domains
search_domain_filter: ["amazon.com", "reddit.com"]

// Exclude these domains (prefix with -)
search_domain_filter: ["-pinterest.com", "-facebook.com"]
```

---

## Response Structure

### Standard Response

```typescript
interface ChatCompletionResponse {
  id: string;                    // Unique completion ID
  model: string;                 // Model used
  object: "chat.completion";
  created: number;               // Unix timestamp

  choices: [{
    index: number;
    finish_reason: "stop" | "length" | null;
    message: {
      role: "assistant";
      content: string;           // The response text
    };
    delta?: {                    // For streaming
      role?: string;
      content?: string;
    };
  }];

  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };

  // Perplexity-specific
  citations?: string[];          // Source URLs (when return_citations: true)
}
```

### Example Response

```json
{
  "id": "d1988dfd-e67b-4ef6-9ac8-4209b88a9628",
  "model": "sonar",
  "created": 1725820758,
  "object": "chat.completion",
  "choices": [{
    "index": 0,
    "finish_reason": "stop",
    "message": {
      "role": "assistant",
      "content": "The latest AI developments include..."
    }
  }],
  "usage": {
    "prompt_tokens": 21,
    "completion_tokens": 77,
    "total_tokens": 98
  },
  "citations": [
    "https://example.com/source1",
    "https://example.com/source2"
  ]
}
```

---

## TypeScript/JavaScript Implementation

### Installation

```bash
# Official SDK (recommended for Node.js)
npm install perplexityai

# Alternative: Use OpenAI SDK with custom base URL
npm install openai
```

### Using Official SDK

```typescript
import Perplexity from 'perplexityai';

const client = new Perplexity({
  apiKey: process.env.PERPLEXITY_API_KEY
});

// Chat completion
const response = await client.chat.completions.create({
  model: 'sonar',
  messages: [
    { role: 'system', content: 'Be precise and concise.' },
    { role: 'user', content: 'What are the latest developments in AI?' }
  ]
});

console.log(response.choices[0].message.content);

// Search
const searchResults = await client.search.create({
  query: 'latest AI developments 2024',
  max_results: 5
});
```

### Using OpenAI SDK (Alternative)

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: 'https://api.perplexity.ai'
});

const response = await client.chat.completions.create({
  model: 'sonar',
  messages: [
    { role: 'user', content: 'What is quantum computing?' }
  ]
});
```

### Using Fetch (No Dependencies)

```typescript
async function queryPerplexity(
  query: string,
  options: {
    model?: string;
    systemPrompt?: string;
    searchDomains?: string[];
    recencyFilter?: 'day' | 'week' | 'month' | 'year';
  } = {}
): Promise<string> {
  const {
    model = 'sonar',
    systemPrompt = 'Be precise and concise.',
    searchDomains,
    recencyFilter
  } = options;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      return_citations: true,
      ...(searchDomains && { search_domain_filter: searchDomains }),
      ...(recencyFilter && { search_recency_filter: recencyFilter })
    })
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Usage
const answer = await queryPerplexity('What are trending t-shirt designs?', {
  model: 'sonar-pro',
  searchDomains: ['amazon.com', 'etsy.com'],
  recencyFilter: 'week'
});
```

### Next.js API Route Example

```typescript
// app/api/research/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { query, domains } = await request.json();

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'You are a market research assistant. Provide data-driven insights with specific examples and trends.'
        },
        { role: 'user', content: query }
      ],
      return_citations: true,
      search_recency_filter: 'month',
      ...(domains && { search_domain_filter: domains })
    })
  });

  const data = await response.json();

  return NextResponse.json({
    content: data.choices[0].message.content,
    citations: data.citations || [],
    usage: data.usage
  });
}
```

---

## Python Implementation

### Installation

```bash
# Official SDK
pip install perplexityai

# Or use requests for direct API calls
pip install requests
```

### Using Official SDK

```python
import os
from perplexity import Perplexity

client = Perplexity(
    api_key=os.environ.get("PERPLEXITY_API_KEY")
)

# Chat completion
response = client.chat.completions.create(
    model="sonar",
    messages=[
        {"role": "system", "content": "Be precise and concise."},
        {"role": "user", "content": "What are the latest AI developments?"}
    ]
)

print(response.choices[0].message.content)

# Search
search = client.search.create(
    query="latest AI developments 2024",
    max_results=5
)

for result in search.results:
    print(f"{result.title}: {result.url}")
```

### Using Requests (Direct API)

```python
import os
import requests

def query_perplexity(
    query: str,
    model: str = "sonar",
    system_message: str = "Be precise and concise.",
    search_domains: list = None,
    recency_filter: str = None
) -> dict:
    """Query Perplexity API with optional filters."""

    api_key = os.environ.get("PERPLEXITY_API_KEY")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": query}
        ],
        "return_citations": True
    }

    if search_domains:
        payload["search_domain_filter"] = search_domains

    if recency_filter:
        payload["search_recency_filter"] = recency_filter

    response = requests.post(
        "https://api.perplexity.ai/chat/completions",
        headers=headers,
        json=payload
    )

    response.raise_for_status()
    return response.json()

# Usage
result = query_perplexity(
    "What are trending print-on-demand niches?",
    model="sonar-pro",
    search_domains=["amazon.com", "etsy.com", "reddit.com"],
    recency_filter="week"
)

print(result["choices"][0]["message"]["content"])
print("Sources:", result.get("citations", []))
```

### Async Python

```python
import os
import asyncio
from perplexity import AsyncPerplexity

async def main():
    client = AsyncPerplexity(
        api_key=os.environ.get("PERPLEXITY_API_KEY")
    )

    response = await client.chat.completions.create(
        model="sonar",
        messages=[
            {"role": "user", "content": "Latest AI news"}
        ]
    )

    print(response.choices[0].message.content)

asyncio.run(main())
```

---

## Streaming

### TypeScript Streaming

```typescript
const stream = await client.chat.completions.create({
  model: 'sonar',
  messages: [{ role: 'user', content: 'Tell me about AI' }],
  stream: true
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
```

### Python Streaming

```python
response = client.chat.completions.create(
    model="sonar",
    messages=[{"role": "user", "content": "Tell me about AI"}],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

### Fetch Streaming (Browser/Node)

```typescript
const response = await fetch('https://api.perplexity.ai/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'sonar',
    messages: [{ role: 'user', content: 'Tell me about AI' }],
    stream: true
  })
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader!.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

  for (const line of lines) {
    const data = line.slice(6); // Remove 'data: ' prefix
    if (data === '[DONE]') continue;

    try {
      const parsed = JSON.parse(data);
      const content = parsed.choices[0]?.delta?.content;
      if (content) console.log(content);
    } catch (e) {
      // Skip malformed chunks
    }
  }
}
```

---

## Error Handling

### Error Types

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Invalid or missing API key |
| 403 | Forbidden | Access denied |
| 404 | Not Found | Endpoint not found |
| 429 | Rate Limit | Too many requests |
| 500+ | Server Error | Perplexity service issues |

### TypeScript Error Handling

```typescript
import Perplexity, {
  APIConnectionError,
  RateLimitError,
  APIStatusError
} from 'perplexityai';

try {
  const response = await client.chat.completions.create({
    model: 'sonar',
    messages: [{ role: 'user', content: 'Hello' }]
  });
} catch (error) {
  if (error instanceof APIConnectionError) {
    console.error('Connection failed:', error.cause);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited, retry after delay');
  } else if (error instanceof APIStatusError) {
    console.error(`API error ${error.status}:`, error.message);
  }
}
```

### Retry Logic

```typescript
async function queryWithRetry(
  query: string,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: 'sonar',
        messages: [{ role: 'user', content: query }]
      });
      return response.choices[0].message.content;
    } catch (error) {
      lastError = error as Error;

      // Don't retry on 4xx errors (except 429)
      if (error instanceof APIStatusError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 429) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

---

## Best Practices

### Query Optimization

1. **Be specific**: Vague queries get vague answers
2. **Use system prompts**: Guide the response format and style
3. **Constrain domains**: Use `search_domain_filter` for focused results
4. **Use recency filters**: Get current information with `search_recency_filter`

### Cost Optimization

1. **Start with `sonar`**: Only upgrade to `sonar-pro` when needed
2. **Use `search_context_size: 'low'`** for simple queries
3. **Limit `max_tokens`** to what you actually need
4. **Cache responses** when appropriate

### System Prompt Examples

```typescript
// For concise answers
{ role: 'system', content: 'Be precise and concise. Provide only essential information.' }

// For research
{ role: 'system', content: 'You are a research assistant. Provide comprehensive analysis with specific data points and trends. Always cite your sources.' }

// For structured output
{ role: 'system', content: 'Respond in JSON format with keys: summary, key_points (array), sources (array).' }

// For market research
{ role: 'system', content: 'You are a market research analyst specializing in e-commerce trends. Focus on actionable insights, specific product examples, and data-driven recommendations.' }
```

### Important Notes

1. **System prompts and online search**: The search subsystem does not attend to the system prompt. System prompts only affect style, tone, and language of the response, not what is searched.

2. **No `/models` endpoint**: Unlike OpenAI, Perplexity does not have a `/models` endpoint. The full URL is `https://api.perplexity.ai/chat/completions` (not `/chat/completions/models`).

3. **Citations**: Enable `return_citations: true` to get source URLs for verification.

---

## MCP Server Integration

Perplexity offers an official MCP (Model Context Protocol) server for integration with Claude Code and other AI tools.

### Claude Code Installation

```bash
# Open Claude Code
claude

# Add the Perplexity MCP server
claude mcp add perplexity --transport stdio \
  --env PERPLEXITY_API_KEY=your_key_here \
  -- npx -y perplexity-mcp
```

### Manual Configuration

Add to your MCP configuration file:

```json
{
  "mcpServers": {
    "perplexity": {
      "command": "npx",
      "args": ["-y", "@perplexity-ai/mcp-server"],
      "env": {
        "PERPLEXITY_API_KEY": "your_key_here",
        "PERPLEXITY_TIMEOUT_MS": "600000"
      }
    }
  }
}
```

---

## Pricing Reference

### Sonar Models

| Model | Request Fee | Input | Output |
|-------|-------------|-------|--------|
| sonar | $5/1K requests | $1/M tokens | $1/M tokens |
| sonar-pro | $5/1K requests | $3/M tokens | $15/M tokens |
| sonar-reasoning | $5/1K requests | $1/M tokens | $5/M tokens |
| sonar-deep-research | Higher tier | $2/M tokens | $8/M tokens |

### Search Context Pricing

Higher search context sizes (`high`, `medium`, `low`) affect the request fee. Use `low` for simple queries to minimize costs.

### Cost Estimation

For a typical query:
- ~100 input tokens (prompt)
- ~500 output tokens (response)
- 1 search request

**Sonar cost**: ~$0.005 + ~$0.0001 + ~$0.0005 = ~$0.006 per query

---

## Quick Reference Card

```typescript
// Minimal working example
const response = await fetch('https://api.perplexity.ai/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'sonar',  // or 'sonar-pro', 'sonar-reasoning'
    messages: [
      { role: 'system', content: 'Be precise and concise.' },
      { role: 'user', content: 'Your query here' }
    ],
    return_citations: true,           // Get source URLs
    search_recency_filter: 'week',    // Only recent results
    search_domain_filter: ['amazon.com', 'reddit.com'],  // Limit sources
    web_search_options: {
      search_context_size: 'medium'   // Balance cost/quality
    }
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
console.log('Sources:', data.citations);
```

---

*Documentation compiled from official Perplexity SDK, API reference, and community resources. Last updated: December 2025.*

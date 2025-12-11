# Google Gemini API Documentation

## Overview

Google Gemini is a family of multimodal AI models developed by Google DeepMind. The Gemini API provides access to these models for text generation, image understanding, code generation, reasoning, and multimodal tasks. This documentation covers authentication, models, endpoints, pricing, and implementation for integration with the Amazon Merch trend research system.

**Key Features:**
- Multimodal understanding (text, images, video, audio, documents)
- Native image generation capabilities
- Built-in tools (Google Search grounding, Code Execution, URL Context)
- Function calling for external API integration
- 1M+ token context windows
- Streaming support
- Batch processing with 50% cost reduction

---

## Authentication

### API Key Authentication (Recommended for Development)

Get your API key from [Google AI Studio](https://aistudio.google.com/apikey).

**Environment Variable:**
```bash
export GEMINI_API_KEY="your-api-key-here"
```

**Request Header:**
```
x-goog-api-key: YOUR_API_KEY
```

### OAuth 2.0 (Production/Vertex AI)

For enterprise deployments via Vertex AI, use Google Cloud OAuth:

```typescript
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});
const credentials = await auth.getApplicationDefault();
```

---

## Base URLs

| Platform | Base URL |
|----------|----------|
| Gemini Developer API | `https://generativelanguage.googleapis.com/v1beta` |
| Vertex AI | `https://{REGION}-aiplatform.googleapis.com/v1` |

---

## Available Models

### Production Models (Stable)

| Model | Model String | Context Window | Best For |
|-------|--------------|----------------|----------|
| **Gemini 3 Pro** | `gemini-3-pro-preview` | 1M tokens | Most powerful multimodal, agentic tasks |
| **Gemini 2.5 Pro** | `gemini-2.5-pro` | 1M tokens | Complex reasoning, coding, long context |
| **Gemini 2.5 Flash** | `gemini-2.5-flash` | 1M tokens | Balanced performance, thinking mode |
| **Gemini 2.5 Flash-Lite** | `gemini-2.5-flash-lite` | 1M tokens | Cost-effective, high throughput |
| **Gemini 2.0 Flash** | `gemini-2.0-flash` | 1M tokens | Multimodal, agentic workflows |
| **Gemini 2.0 Flash-Lite** | `gemini-2.0-flash-lite` | 1M tokens | Fastest, lowest cost |

### Specialized Models

| Model | Model String | Purpose |
|-------|--------------|---------|
| **Gemini Embedding** | `gemini-embedding-001` | Text embeddings |
| **Gemini 2.5 Flash Image** | `gemini-2.5-flash-image` | Native image generation |
| **Gemini 3 Pro Image** | `gemini-3-pro-image-preview` | Advanced image generation (Nano Banana) |
| **Imagen 4** | `imagen-4.0-generate-001` | High-quality image generation |

### Model Selection Guide for Amazon Merch Research

| Use Case | Recommended Model | Reasoning |
|----------|-------------------|-----------|
| Trend analysis & research | `gemini-2.5-flash` | Balance of quality and cost with thinking |
| Batch product analysis | `gemini-2.5-flash-lite` | Cost-effective for high volume |
| Complex market research | `gemini-2.5-pro` | Deep reasoning capabilities |
| Design brief generation | `gemini-2.5-flash` | Good creative output |
| Real-time search grounding | `gemini-2.5-flash` | Native Google Search tool |

---

## API Endpoints

### Generate Content (Standard)

**POST** `/v1beta/models/{model}:generateContent`

Standard synchronous request that returns complete response.

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          {"text": "Analyze trending t-shirt designs for summer 2025"}
        ]
      }
    ]
  }'
```

### Generate Content (Streaming)

**POST** `/v1beta/models/{model}:streamGenerateContent`

Server-Sent Events (SSE) streaming for real-time responses.

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{"parts": [{"text": "List 10 trending design niches"}]}]
  }'
```

### Count Tokens

**POST** `/v1beta/models/{model}:countTokens`

Estimate token usage before making requests.

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:countTokens" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{"parts": [{"text": "Your prompt text here"}]}]
  }'
```

### List Models

**GET** `/v1beta/models`

List all available models and their capabilities.

---

## Request Parameters

### Generation Config

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `temperature` | float | Randomness (0.0-2.0) | 1.0 |
| `topP` | float | Nucleus sampling | 0.95 |
| `topK` | integer | Top-k sampling | 40 |
| `maxOutputTokens` | integer | Max response tokens | Model-dependent |
| `stopSequences` | string[] | Stop generation tokens | [] |
| `responseMimeType` | string | `text/plain` or `application/json` | `text/plain` |
| `responseSchema` | object | JSON schema for structured output | null |

### Safety Settings

| Category | Options |
|----------|---------|
| `HARM_CATEGORY_HARASSMENT` | `BLOCK_NONE`, `BLOCK_LOW_AND_ABOVE`, `BLOCK_MEDIUM_AND_ABOVE`, `BLOCK_ONLY_HIGH` |
| `HARM_CATEGORY_HATE_SPEECH` | Same options |
| `HARM_CATEGORY_SEXUALLY_EXPLICIT` | Same options |
| `HARM_CATEGORY_DANGEROUS_CONTENT` | Same options |

### Request Body Structure

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {"text": "Your prompt"},
        {"inlineData": {"mimeType": "image/png", "data": "base64..."}}
      ]
    }
  ],
  "systemInstruction": {
    "parts": [{"text": "System prompt"}]
  },
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 2048,
    "responseMimeType": "application/json"
  },
  "tools": [
    {"google_search": {}},
    {"code_execution": {}}
  ],
  "safetySettings": [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
  ]
}
```

---

## Response Format

### Standard Response

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {"text": "Generated response text"}
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0,
      "safetyRatings": [
        {"category": "HARM_CATEGORY_HARASSMENT", "probability": "NEGLIGIBLE"}
      ]
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 50,
    "candidatesTokenCount": 150,
    "totalTokenCount": 200
  }
}
```

### Finish Reasons

| Reason | Description |
|--------|-------------|
| `STOP` | Natural completion |
| `MAX_TOKENS` | Hit maxOutputTokens limit |
| `SAFETY` | Blocked by safety filters |
| `RECITATION` | Blocked for recitation |
| `OTHER` | Unknown reason |

---

## Built-in Tools

### Google Search Grounding

Ground responses with real-time web search results.

```json
{
  "tools": [{"google_search": {}}],
  "contents": [{"parts": [{"text": "What are the latest Amazon Merch design trends?"}]}]
}
```

**Response includes `groundingMetadata`:**
```json
{
  "groundingMetadata": {
    "searchEntryPoint": {"renderedContent": "..."},
    "groundingChunks": [
      {"web": {"uri": "https://example.com", "title": "Article Title"}}
    ],
    "groundingSupports": [
      {"segment": {"text": "..."}, "groundingChunkIndices": [0]}
    ]
  }
}
```

### Code Execution

Execute Python code within the model for calculations and data processing.

```json
{
  "tools": [{"code_execution": {}}],
  "contents": [{"parts": [{"text": "Calculate the profit margin for these prices..."}]}]
}
```

### URL Context

Provide URLs as additional context for the model.

```json
{
  "tools": [{"url_context": {}}],
  "contents": [{"parts": [{"text": "Analyze the content at https://example.com"}]}]
}
```

### Function Calling

Connect Gemini to external APIs and tools.

```javascript
const tools = [{
  functionDeclarations: [{
    name: "get_amazon_trends",
    description: "Fetch current Amazon Merch trending designs",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", description: "Product category" },
        timeframe: { type: "string", enum: ["day", "week", "month"] }
      },
      required: ["category"]
    }
  }]
}];
```

---

## Pricing (December 2025)

### Gemini 3 Pro Preview (Paid Only)

| Tier | Input (per 1M tokens) | Output (per 1M tokens) |
|------|----------------------|------------------------|
| Standard (≤200K) | $2.00 | $12.00 |
| Standard (>200K) | $4.00 | $18.00 |
| Batch (≤200K) | $1.00 | $6.00 |
| Batch (>200K) | $2.00 | $9.00 |

### Gemini 2.5 Pro

| Tier | Input (per 1M tokens) | Output (per 1M tokens) |
|------|----------------------|------------------------|
| Free | Free | Free |
| Paid Standard (≤200K) | $1.25 | $10.00 |
| Paid Standard (>200K) | $2.50 | $15.00 |
| Batch (≤200K) | $0.625 | $5.00 |
| Batch (>200K) | $1.25 | $7.50 |

### Gemini 2.5 Flash

| Tier | Input (per 1M tokens) | Output (per 1M tokens) |
|------|----------------------|------------------------|
| Free | Free | Free |
| Paid Standard | $0.30 (text/image/video), $1.00 (audio) | $2.50 |
| Batch | $0.15 (text/image/video), $0.50 (audio) | $1.25 |

### Gemini 2.5 Flash-Lite

| Tier | Input (per 1M tokens) | Output (per 1M tokens) |
|------|----------------------|------------------------|
| Free | Free | Free |
| Paid Standard | $0.10 (text/image/video), $0.30 (audio) | $0.40 |
| Batch | $0.05 (text/image/video), $0.15 (audio) | $0.20 |

### Gemini 2.0 Flash

| Tier | Input (per 1M tokens) | Output (per 1M tokens) |
|------|----------------------|------------------------|
| Free | Free | Free |
| Paid Standard | $0.10 (text/image/video), $0.70 (audio) | $0.40 |
| Batch | $0.05 (text/image/video), $0.35 (audio) | $0.20 |

### Gemini 2.0 Flash-Lite

| Tier | Input (per 1M tokens) | Output (per 1M tokens) |
|------|----------------------|------------------------|
| Free | Free | Free |
| Paid Standard | $0.075 | $0.30 |
| Batch | $0.0375 | $0.15 |

### Tools Pricing

| Tool | Free Tier | Paid Tier |
|------|-----------|-----------|
| Google Search | 500 RPD | 1,500 RPD free, then $35/1,000 prompts |
| Google Maps | 500 RPD | 1,500 RPD free, then $25/1,000 prompts |
| Code Execution | Free | Free |
| URL Context | Free | Charged as input tokens |
| Embeddings | Free | $0.15/1M tokens |

### Context Caching

| Model | Cache Read | Storage (per hour) |
|-------|------------|-------------------|
| Gemini 2.5 Pro | 10% of input price | $4.50/1M tokens |
| Gemini 2.5 Flash | $0.03 (text/image) | $1.00/1M tokens |
| Gemini 2.0 Flash | $0.025 (text/image) | $1.00/1M tokens |

---

## Rate Limits

### Free Tier

| Model | RPM | TPM | RPD |
|-------|-----|-----|-----|
| Gemini 2.5 Pro | 5 | 250,000 | 25-100 |
| Gemini 2.5 Flash | 10 | 250,000 | 250-500 |
| Gemini 2.5 Flash-Lite | 15 | 250,000 | 1,000 |
| Gemini 2.0 Flash | 15 | 1,000,000 | 1,500 |

### Paid Tier 1

| Model | RPM | TPM | RPD |
|-------|-----|-----|-----|
| Gemini 2.5 Pro | 150 | 2,000,000 | No limit |
| Gemini 2.5 Flash | 300 | 2,000,000 | No limit |
| Gemini 2.0 Flash | 300 | 2,000,000 | No limit |

### Paid Tier 2 (Requires $250 spending + 30 days)

| Model | RPM | TPM | RPD |
|-------|-----|-----|-----|
| Gemini 2.5 Pro | 1,000 | 4,000,000 | No limit |
| Gemini 2.5 Flash | 2,000 | 4,000,000 | No limit |

**Note:** Rate limits apply per project, not per API key. RPD resets at midnight Pacific Time.

---

## TypeScript/JavaScript Implementation

### Installation

```bash
npm install @google/genai
```

### Basic Usage

```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateContent(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  return response.text;
}
```

### Streaming Response

```typescript
async function streamContent(prompt: string): Promise<void> {
  const response = await ai.models.generateContentStream({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  for await (const chunk of response) {
    process.stdout.write(chunk.text);
  }
}
```

### With System Instruction

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Analyze these trending design categories',
  config: {
    systemInstruction: 'You are an expert Amazon Merch trend analyst. Provide actionable insights for print-on-demand designers.',
    temperature: 0.7,
    maxOutputTokens: 2048,
  }
});
```

### Structured JSON Output

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'List 5 trending t-shirt design niches',
  config: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'object',
      properties: {
        niches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              searchVolume: { type: 'string' },
              competition: { type: 'string' },
              trendDirection: { type: 'string', enum: ['rising', 'stable', 'declining'] }
            }
          }
        }
      }
    }
  }
});

const data = JSON.parse(response.text);
```

### With Google Search Grounding

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'What are the current trending Amazon Merch design themes for Q1 2025?',
  config: {
    tools: [{ google_search: {} }]
  }
});

// Access grounding metadata
console.log(response.candidates[0].groundingMetadata);
```

### Function Calling

```typescript
import { FunctionDeclaration, FunctionCallingConfigMode } from '@google/genai';

const getTrendsFunction: FunctionDeclaration = {
  name: 'get_amazon_trends',
  description: 'Fetch trending products from Amazon',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Product category' },
      marketplace: { type: 'string', enum: ['US', 'UK', 'DE', 'JP'] }
    },
    required: ['category']
  }
};

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Find trending t-shirt designs in the US market',
  config: {
    tools: [{ functionDeclarations: [getTrendsFunction] }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.AUTO
      }
    }
  }
});

// Check for function calls
if (response.functionCalls) {
  for (const fc of response.functionCalls) {
    console.log(`Call function: ${fc.name}`, fc.args);
    // Execute your function and send results back
  }
}
```

### Multi-turn Chat

```typescript
const chat = ai.chats.create({
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction: 'You are a helpful Amazon Merch research assistant.'
  }
});

// First turn
const response1 = await chat.sendMessage('What niches are trending right now?');
console.log(response1.text);

// Follow-up (maintains context)
const response2 = await chat.sendMessage('Which of those has the least competition?');
console.log(response2.text);
```

### Complete Amazon Merch Research Service

```typescript
import { GoogleGenAI } from '@google/genai';

interface TrendAnalysis {
  niche: string;
  searchVolume: string;
  competition: string;
  opportunity_score: number;
  design_suggestions: string[];
  keywords: string[];
}

interface ResearchResult {
  trends: TrendAnalysis[];
  market_insights: string;
  recommendations: string[];
  sources: string[];
}

class GeminiResearchService {
  private ai: GoogleGenAI;
  private model = 'gemini-2.5-flash';

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });
  }

  async analyzeTrends(query: string): Promise<ResearchResult> {
    const systemPrompt = `You are an expert Amazon Merch on Demand market research analyst.
Analyze trends and provide actionable insights for print-on-demand designers.
Always ground your analysis in current market data.
Return structured JSON with trend analysis, market insights, and recommendations.`;

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: query,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ google_search: {} }],
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            trends: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  niche: { type: 'string' },
                  searchVolume: { type: 'string' },
                  competition: { type: 'string' },
                  opportunity_score: { type: 'number' },
                  design_suggestions: { type: 'array', items: { type: 'string' } },
                  keywords: { type: 'array', items: { type: 'string' } }
                }
              }
            },
            market_insights: { type: 'string' },
            recommendations: { type: 'array', items: { type: 'string' } },
            sources: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    });

    return JSON.parse(response.text);
  }

  async generateDesignBrief(niche: string, keywords: string[]): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: `Create a detailed design brief for an Amazon Merch t-shirt design.
Niche: ${niche}
Target Keywords: ${keywords.join(', ')}

Include:
1. Design concept and style recommendations
2. Color palette suggestions
3. Typography recommendations
4. Key visual elements
5. Target audience description
6. Compliance notes for Amazon Merch`,
      config: {
        temperature: 0.8,
        maxOutputTokens: 2048
      }
    });

    return response.text;
  }

  async batchAnalyze(niches: string[]): Promise<TrendAnalysis[]> {
    // Use Promise.all with rate limiting for batch processing
    const results: TrendAnalysis[] = [];
    const batchSize = 5;
    const delayMs = 1000; // 1 second between batches

    for (let i = 0; i < niches.length; i += batchSize) {
      const batch = niches.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(niche => this.analyzeSingleNiche(niche))
      );
      results.push(...batchResults);

      if (i + batchSize < niches.length) {
        await this.delay(delayMs);
      }
    }

    return results;
  }

  private async analyzeSingleNiche(niche: string): Promise<TrendAnalysis> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-lite', // Use lite for batch operations
      contents: `Analyze the Amazon Merch niche: "${niche}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            niche: { type: 'string' },
            searchVolume: { type: 'string' },
            competition: { type: 'string' },
            opportunity_score: { type: 'number' },
            design_suggestions: { type: 'array', items: { type: 'string' } },
            keywords: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    });

    return JSON.parse(response.text);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const gemini = new GeminiResearchService();

// Single trend analysis
const trends = await gemini.analyzeTrends('trending cat-themed t-shirt designs');
console.log(trends);

// Generate design brief
const brief = await gemini.generateDesignBrief('cat lovers', ['funny cats', 'cat mom', 'cute kittens']);
console.log(brief);

// Batch analysis
const batchResults = await gemini.batchAnalyze(['dog lovers', 'fitness motivation', 'retro gaming']);
console.log(batchResults);
```

---

## Python Implementation

### Installation

```bash
pip install google-genai
```

### Basic Usage

```python
from google import genai

client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))

response = client.models.generate_content(
    model='gemini-2.5-flash',
    contents='Analyze trending Amazon Merch design niches'
)
print(response.text)
```

### Streaming

```python
for chunk in client.models.generate_content_stream(
    model='gemini-2.5-flash',
    contents='List trending design categories'
):
    print(chunk.text, end='')
```

### With Tools

```python
response = client.models.generate_content(
    model='gemini-2.5-flash',
    contents='What are the latest Amazon Merch trends?',
    config={
        'tools': [{'google_search': {}}]
    }
)
```

---

## Next.js API Route Example

```typescript
// app/api/gemini/route.ts
import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(request: NextRequest) {
  try {
    const { prompt, useSearch = false } = await request.json();

    const config: any = {
      temperature: 0.7,
      maxOutputTokens: 2048,
    };

    if (useSearch) {
      config.tools = [{ google_search: {} }];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config,
    });

    return NextResponse.json({
      success: true,
      text: response.text,
      usage: response.usageMetadata,
    });
  } catch (error: any) {
    console.error('Gemini API Error:', error);

    if (error.status === 429) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad Request | Fix request parameters |
| 401 | Unauthorized | Check API key |
| 403 | Forbidden | Check permissions/quotas |
| 404 | Not Found | Check model name |
| 429 | Rate Limited | Implement backoff/retry |
| 500 | Server Error | Retry with backoff |
| 503 | Service Unavailable | Retry later |

### Retry Logic with Exponential Backoff

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
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
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
const response = await withRetry(() =>
  ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  })
);
```

---

## Best Practices

### Cost Optimization

1. **Use Flash-Lite for high-volume operations** - 75% cheaper than Flash
2. **Enable batch processing** - 50% discount for non-real-time workloads
3. **Implement context caching** - Reduce repeated token costs
4. **Use structured output schemas** - More predictable token usage
5. **Monitor token usage** - Use countTokens before large requests

### Performance Optimization

1. **Choose the right model** - Don't over-engineer with Pro when Flash suffices
2. **Use streaming** - Better UX for long responses
3. **Implement request queuing** - Respect rate limits
4. **Cache common responses** - Reduce redundant API calls
5. **Use system instructions** - More consistent, focused outputs

### Rate Limit Management

1. **Track usage per project** - Limits are project-wide
2. **Implement exponential backoff** - Handle 429 errors gracefully
3. **Use multiple projects** - For production isolation
4. **Consider Tier 2** - Worth it for production workloads
5. **Use Batch API** - For non-time-sensitive operations

### Security

1. **Never expose API keys client-side** - Use server-side proxies
2. **Rotate API keys regularly** - Create new keys periodically
3. **Monitor usage** - Set up alerts for unusual activity
4. **Use OAuth for production** - More secure than API keys
5. **Implement request validation** - Sanitize user inputs

---

## Comparison with Other APIs

| Feature | Gemini | Perplexity | Grok | Decodo |
|---------|--------|------------|------|--------|
| **Primary Use** | General AI + Search grounding | AI Research + Citations | AI Chat + X/Twitter | Web Scraping |
| **Search Capability** | Native Google Search tool | Built-in with citations | Real-time X/Twitter | Amazon/Google templates |
| **Structured Output** | Native JSON schema | Text-based | Text-based | Parsed HTML/JSON |
| **Batch Processing** | Yes (50% discount) | No | No | Yes (3K URLs) |
| **Context Window** | 1M-2M tokens | 128K tokens | 131K tokens | N/A |
| **Free Tier** | Yes (generous) | Limited | Limited | Trial only |
| **Best For Merch** | Trend analysis with search | Validated research | Social trends | Product data |

### Recommended Usage in Amazon Merch System

| Task | Primary API | Backup API |
|------|-------------|------------|
| Trend research | Gemini (with search grounding) | Perplexity |
| Social trend validation | Grok | Gemini |
| Product data scraping | Decodo | N/A |
| Design brief generation | Gemini | Perplexity |
| Keyword research | Gemini (with search) | Perplexity |
| Competitor analysis | Decodo + Gemini | Perplexity |

---

## Environment Variables

```bash
# Required
GEMINI_API_KEY=your-api-key-here

# Optional (for Vertex AI)
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_REGION=us-central1
```

---

## Additional Resources

- **Official Documentation**: https://ai.google.dev/gemini-api/docs
- **API Reference**: https://ai.google.dev/api
- **Google AI Studio**: https://aistudio.google.com
- **Pricing**: https://ai.google.dev/gemini-api/docs/pricing
- **Rate Limits**: https://ai.google.dev/gemini-api/docs/rate-limits
- **Cookbook (Examples)**: https://github.com/google-gemini/cookbook
- **TypeScript SDK**: https://www.npmjs.com/package/@google/genai
- **Python SDK**: https://pypi.org/project/google-genai/

---

*Documentation compiled from official Google AI documentation. Last updated: December 2025.*

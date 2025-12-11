# xAI Grok API Complete Documentation

> **Purpose**: This document provides Claude Code with comprehensive documentation for implementing and working with the xAI Grok API. It consolidates official SDK information, API specifications, and implementation patterns.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Available Models](#available-models)
4. [API Endpoints](#api-endpoints)
5. [Chat Completions API](#chat-completions-api)
6. [Request Parameters Reference](#request-parameters-reference)
7. [Response Structure](#response-structure)
8. [TypeScript/JavaScript Implementation](#typescriptjavascript-implementation)
9. [Python Implementation](#python-implementation)
10. [Streaming](#streaming)
11. [Live Search](#live-search)
12. [Agentic Tool Calling](#agentic-tool-calling)
13. [Function Calling](#function-calling)
14. [Image Understanding](#image-understanding)
15. [Image Generation](#image-generation)
16. [Structured Outputs](#structured-outputs)
17. [Error Handling](#error-handling)
18. [Best Practices](#best-practices)
19. [Pricing Reference](#pricing-reference)

---

## Overview

xAI's Grok API provides access to the Grok family of large language models. Key features:

- **OpenAI/Anthropic SDK Compatible**: Same structure, just change base URL
- **Real-time Search**: Live Search and agentic tools for current information
- **X (Twitter) Integration**: Native X search capabilities
- **Multimodal**: Text, image understanding, and image generation
- **Function Calling**: Tool use and structured outputs
- **Large Context Windows**: Up to 256K tokens (Grok 4), 2M tokens (Grok 4.1 Fast)

**Base URL**: `https://api.x.ai/v1`

**Console**: `https://console.x.ai`

**Documentation**: `https://docs.x.ai`

---

## Authentication

All requests require an API key passed in the Authorization header:

```
Authorization: Bearer YOUR_XAI_API_KEY
```

### Getting an API Key

1. Go to `console.x.ai`
2. Sign up with email, X (Twitter), or Google
3. Add credits to your account (or use free beta credits)
4. Navigate to API Keys section
5. Click "Create API Key" and name it
6. Copy immediately—it's hidden after closing the dialog

### Environment Variable (Recommended)

```bash
export XAI_API_KEY="xai-xxxxxxxxxxxxxxxx"
```

---

## Available Models

### Current Models (December 2025)

| Model | Context | Best For | Input $/M | Output $/M |
|-------|---------|----------|-----------|------------|
| `grok-4` | 256K | Flagship reasoning, complex tasks | $3.00 | $15.00 |
| `grok-4-fast-reasoning` | 256K | Fast reasoning with lower cost | Lower | Lower |
| `grok-4-fast-non-reasoning` | 256K | Quick responses, no reasoning | Lower | Lower |
| `grok-4-1-fast` | 2M | Agentic tool calling, massive context | $0.20 | $0.50 |
| `grok-4-1-fast-non-reasoning` | 2M | Fast agentic without reasoning | $0.20 | $0.50 |
| `grok-code-fast-1` | - | Agentic coding workflows | $0.20 | $1.50 |
| `grok-3` | 131K | General purpose, legacy | ~$3.00 | ~$15.00 |
| `grok-3-fast` | 131K | Faster inference | Lower | Lower |
| `grok-3-mini` | 131K | Lightweight, cost-effective | Lower | Lower |
| `grok-3-mini-fast` | 131K | Fastest, most affordable | Lowest | Lowest |
| `grok-2-image` | - | Image generation (Aurora) | $0.07/image | - |

### Model Selection Guide

- **`grok-4`**: Best quality, complex reasoning, production use
- **`grok-4-1-fast`**: Agentic tool calling with huge 2M context window
- **`grok-code-fast-1`**: Coding tasks, CI/CD integration
- **`grok-3-mini-fast`**: High-volume, cost-sensitive applications
- **`grok-2-image`**: Image generation with Aurora model

### Model Aliases

xAI provides aliases for automatic updates:
- `grok-4-latest` → Latest Grok 4 version
- `grok-code-fast` → Latest coding model

---

## API Endpoints

### Chat Completions (Primary)

```
POST https://api.x.ai/v1/chat/completions
```

Standard chat completions endpoint, compatible with OpenAI SDK.

### Responses API (Agentic)

```
POST https://api.x.ai/v1/responses
```

For server-side agentic tool calling with web_search, x_search, code_execution.

### Image Generation

```
POST https://api.x.ai/v1/images/generations
```

Generate images using the Aurora model.

### Models List

```
GET https://api.x.ai/v1/models
```

List available models.

---

## Chat Completions API

### Basic Request Structure

```typescript
interface ChatCompletionRequest {
  model: string;                    // Required: e.g., "grok-4"
  messages: Message[];              // Required: conversation messages

  // Optional parameters
  max_tokens?: number;              // Max response length
  temperature?: number;             // 0-2, lower = more focused
  top_p?: number;                   // 0-1, nucleus sampling
  stream?: boolean;                 // Enable streaming

  // Tool/Function calling
  tools?: Tool[];                   // Available tools
  tool_choice?: string | object;    // 'auto', 'required', 'none', or specific

  // Structured output
  response_format?: {
    type: 'json_object' | 'json_schema';
    json_schema?: object;
  };

  // Live Search (deprecated Dec 15, 2025)
  search_parameters?: SearchParameters;
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
}
```

### Minimal Example (curl)

```bash
curl https://api.x.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-4",
    "messages": [
      {"role": "system", "content": "You are Grok, a helpful AI assistant."},
      {"role": "user", "content": "What is the meaning of life?"}
    ]
  }'
```

---

## Request Parameters Reference

### Core Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | Required | Model to use |
| `messages` | array | Required | Conversation messages |
| `max_tokens` | integer | Model default | Maximum response tokens |
| `temperature` | float | 1.0 | Randomness (0-2) |
| `top_p` | float | 1.0 | Nucleus sampling threshold |
| `stream` | boolean | false | Enable streaming |

### Tool Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tools` | array | Array of tool definitions |
| `tool_choice` | string/object | How to select tools: 'auto', 'required', 'none' |
| `parallel_tool_calls` | boolean | Allow multiple simultaneous tool calls |

### Important Notes

- **Grok 4 does NOT support**: `presence_penalty`, `frequency_penalty`, `stop`, `reasoning_effort`
- **No role order limitation**: You can mix system, user, assistant roles in any sequence
- **Supported image types**: jpg/jpeg, png (for vision models)
- **Max images per request**: 20

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
    finish_reason: "stop" | "length" | "tool_calls" | null;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: ToolCall[];
    };
  }];

  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };

  // With Live Search
  citations?: string[];
}
```

---

## TypeScript/JavaScript Implementation

### Installation

```bash
# Official xAI SDK (recommended)
npm install @ai-sdk/xai

# Or use OpenAI SDK with custom base URL
npm install openai
```

### Using AI SDK (@ai-sdk/xai)

```typescript
import { xai } from '@ai-sdk/xai';
import { generateText, streamText } from 'ai';

// Basic completion
const { text } = await generateText({
  model: xai('grok-4'),
  prompt: 'What is the meaning of life?'
});

// With messages
const { text } = await generateText({
  model: xai('grok-4'),
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing.' }
  ]
});

// Streaming
const result = streamText({
  model: xai('grok-4'),
  prompt: 'Write a poem about AI'
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### Using OpenAI SDK (Compatible)

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1'
});

const response = await client.chat.completions.create({
  model: 'grok-4',
  messages: [
    { role: 'system', content: 'You are Grok, a helpful assistant.' },
    { role: 'user', content: 'What are the latest AI trends?' }
  ]
});

console.log(response.choices[0].message.content);
```

### Using Fetch (No Dependencies)

```typescript
async function queryGrok(
  query: string,
  options: {
    model?: string;
    systemPrompt?: string;
    temperature?: number;
  } = {}
): Promise<string> {
  const {
    model = 'grok-4',
    systemPrompt = 'You are Grok, a helpful AI assistant.',
    temperature = 0.7
  } = options;

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      temperature
    })
  });

  if (!response.ok) {
    throw new Error(`xAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Usage
const answer = await queryGrok('What is quantum computing?');
```

### Next.js API Route Example

```typescript
// app/api/grok/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { query, model = 'grok-4' } = await request.json();

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: query }
      ]
    })
  });

  const data = await response.json();

  return NextResponse.json({
    content: data.choices[0].message.content,
    usage: data.usage
  });
}
```

---

## Python Implementation

### Installation

```bash
# Official xAI SDK
pip install xai-sdk

# Or use OpenAI SDK with custom base URL
pip install openai
```

### Using Official xAI SDK

```python
import os
from xai_sdk import Client
from xai_sdk.chat import user, system

client = Client(
    api_key=os.getenv("XAI_API_KEY"),
    timeout=3600  # Longer timeout for reasoning models
)

# Create chat
chat = client.chat.create(model="grok-4")
chat.append(system("You are Grok, a helpful AI assistant."))
chat.append(user("What is the meaning of life?"))

# Get response
response = chat.sample()
print(response.content)
```

### Using OpenAI SDK (Compatible)

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("XAI_API_KEY"),
    base_url="https://api.x.ai/v1"
)

response = client.chat.completions.create(
    model="grok-4",
    messages=[
        {"role": "system", "content": "You are Grok, a helpful assistant."},
        {"role": "user", "content": "Explain quantum computing."}
    ]
)

print(response.choices[0].message.content)
```

### Using Requests (Direct API)

```python
import os
import requests

def query_grok(
    query: str,
    model: str = "grok-4",
    system_message: str = "You are Grok, a helpful AI assistant.",
    temperature: float = 0.7
) -> dict:
    """Query xAI Grok API."""

    api_key = os.environ.get("XAI_API_KEY")

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
        "temperature": temperature
    }

    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers=headers,
        json=payload
    )

    response.raise_for_status()
    return response.json()

# Usage
result = query_grok("What are the latest developments in AI?")
print(result["choices"][0]["message"]["content"])
```

---

## Streaming

### Python Streaming with xAI SDK

```python
import os
from xai_sdk import Client
from xai_sdk.chat import user, system

client = Client(api_key=os.getenv("XAI_API_KEY"))

chat = client.chat.create(model="grok-4")
chat.append(system("You are a helpful assistant."))
chat.append(user("Tell me a story about AI."))

for response, chunk in chat.stream():
    if chunk.content:
        print(chunk.content, end="", flush=True)
```

### TypeScript Streaming

```typescript
const response = await fetch('https://api.x.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'grok-4',
    messages: [{ role: 'user', content: 'Tell me a story' }],
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
    const data = line.slice(6);
    if (data === '[DONE]') continue;

    try {
      const parsed = JSON.parse(data);
      const content = parsed.choices[0]?.delta?.content;
      if (content) process.stdout.write(content);
    } catch (e) {
      // Skip malformed chunks
    }
  }
}
```

---

## Live Search

> **Note**: Live Search API will be deprecated by December 15, 2025. Migrate to the Agentic Tool Calling API.

Live Search enables real-time web and X (Twitter) data in responses.

### Python Example

```python
import os
from xai_sdk import Client
from xai_sdk.chat import user
from xai_sdk.search import SearchParameters, web_source, news_source

client = Client(api_key=os.getenv("XAI_API_KEY"))

chat = client.chat.create(
    model="grok-4",
    search_parameters=SearchParameters(
        mode="auto",              # 'auto', 'on', 'off'
        return_citations=True,
        max_search_results=10,
        sources=[
            web_source(excluded_websites=["wikipedia.org"]),
            news_source()
        ]
    )
)

chat.append(user("What is the latest news about AI?"))
response = chat.sample()

print(response.content)
print("Citations:", response.citations)
```

### Date Filtering

```python
from datetime import datetime
from xai_sdk.search import SearchParameters

search_parameters = SearchParameters(
    mode="auto",
    from_date=datetime(2025, 1, 1),
    to_date=datetime(2025, 12, 31)
)
```

### Live Search Pricing

- **$25 per 1,000 sources used** ($0.025 per source)

---

## Agentic Tool Calling

The Responses API provides server-side tools that execute autonomously on xAI servers.

### Available Server-Side Tools

| Tool | Description |
|------|-------------|
| `web_search` | Search web and browse pages |
| `x_search` | Search X posts, users, threads |
| `code_execution` | Execute Python code |

### Python Example

```python
import os
from xai_sdk import Client
from xai_sdk.chat import user
from xai_sdk.tools import web_search, x_search, code_execution

client = Client(api_key=os.getenv("XAI_API_KEY"))

chat = client.chat.create(
    model="grok-4-1-fast",
    tools=[
        web_search(),
        x_search(),
        code_execution()
    ]
)

chat.append(user("What are the latest updates from xAI?"))

# Stream with real-time tool visibility
for response, chunk in chat.stream():
    # See tool calls as they happen
    for tool_call in chunk.tool_calls:
        print(f"Calling tool: {tool_call.name}")

    if chunk.content:
        print(chunk.content, end="")
```

### Web Search with Options

```python
from xai_sdk.tools import web_search

chat = client.chat.create(
    model="grok-4-1-fast",
    tools=[
        web_search(
            allowed_domains=["techcrunch.com", "reuters.com"],  # Max 5
            # OR excluded_domains=["wikipedia.org"],
            enable_image_understanding=True
        )
    ]
)
```

### X Search with Date Filtering

```python
from datetime import datetime
from xai_sdk.tools import x_search

chat = client.chat.create(
    model="grok-4-1-fast",
    tools=[
        x_search(
            from_date=datetime(2025, 10, 1),
            to_date=datetime(2025, 10, 10),
            enable_image_understanding=True,
            enable_video_understanding=True
        )
    ]
)
```

### Agentic Tool Pricing

- **Token usage**: Billed at model rates
- **Tool invocations**: Per-tool fees (varies)
- Costs scale with query complexity as agent decides tool usage

---

## Function Calling

Define your own tools that Grok can call.

### Python Example

```python
import os
import json
from xai_sdk import Client
from xai_sdk.chat import tool, tool_result, user

client = Client(api_key=os.getenv('XAI_API_KEY'))

# Define tools
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City and state, e.g., San Francisco, CA"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "default": "fahrenheit"
                    }
                },
                "required": ["location"]
            }
        }
    }
]

# Your tool implementation
def get_weather(location: str, unit: str = "fahrenheit") -> str:
    # Your actual implementation
    return json.dumps({"location": location, "temperature": 72, "unit": unit})

chat = client.chat.create(model="grok-4", tools=tools)
chat.append(user("What's the weather in San Francisco?"))

response = chat.sample()

# Handle tool calls
if response.tool_calls:
    for tool_call in response.tool_calls:
        if tool_call.function.name == "get_weather":
            args = json.loads(tool_call.function.arguments)
            result = get_weather(**args)
            chat.append(tool_result(tool_call.id, result))

    # Get final response
    final_response = chat.sample()
    print(final_response.content)
```

### TypeScript Example

```typescript
import { xai } from '@ai-sdk/xai';
import { streamText, tool } from 'ai';
import { z } from 'zod';

const result = streamText({
  model: xai('grok-4'),
  tools: {
    getWeather: tool({
      description: 'Get the current temperature in a given location',
      parameters: z.object({
        location: z.string().describe('City and state'),
        unit: z.enum(['celsius', 'fahrenheit']).default('fahrenheit')
      }),
      execute: async ({ location, unit }) => {
        return { location, temperature: 72, unit };
      }
    })
  },
  prompt: "What's the weather in San Francisco?"
});
```

---

## Image Understanding

Grok can analyze images passed in messages.

### Python Example

```python
import os
import base64
from xai_sdk import Client
from xai_sdk.chat import user, image

client = Client(api_key=os.getenv('XAI_API_KEY'))

# From URL
chat = client.chat.create(model="grok-4")
chat.append(
    user(
        "What's in this image?",
        image(
            image_url="https://example.com/image.jpg",
            detail="high"  # 'high' or 'low'
        )
    )
)
response = chat.sample()
print(response.content)

# From Base64
def encode_image(image_path):
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

base64_image = encode_image("local_image.jpg")
chat.append(
    user(
        "Describe this image",
        image(image_url=f"data:image/jpeg;base64,{base64_image}", detail="high")
    )
)
```

### Multiple Images

```python
chat.append(
    user(
        "Compare these images",
        image(image_url="https://example.com/image1.jpg", detail="high"),
        image(image_url="https://example.com/image2.jpg", detail="high")
    )
)
```

### Raw API Request

```json
{
  "model": "grok-4",
  "messages": [{
    "role": "user",
    "content": [
      {
        "type": "image_url",
        "image_url": {
          "url": "data:image/jpeg;base64,<base64_string>",
          "detail": "high"
        }
      },
      {
        "type": "text",
        "text": "What is in this image?"
      }
    ]
  }]
}
```

---

## Image Generation

Generate images using the Aurora model (`grok-2-image`).

### Python Example

```python
import os
from xai_sdk import Client

client = Client(api_key=os.getenv('XAI_API_KEY'))

# Single image (URL)
response = client.image.sample(
    model="grok-2-image",
    prompt="A cat in a tree",
    image_format="url"
)
print(response.url)

# Single image (Base64)
response = client.image.sample(
    model="grok-2-image",
    prompt="A futuristic cityscape at sunset",
    image_format="base64"
)
# response.image contains raw bytes

# Multiple images (up to 10)
response = client.image.sample_batch(
    model="grok-2-image",
    prompt="A robot playing chess",
    n=4,
    image_format="url"
)
for img in response:
    print(img.url)
```

### curl Example

```bash
curl https://api.x.ai/v1/images/generations \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-2-image",
    "prompt": "A 1920s travel poster of Mars, retro palette",
    "n": 1
  }'
```

### Image Generation Notes

- **Endpoint**: `https://api.x.ai/v1/images/generations` (different from chat)
- **Output format**: JPEG
- **Max per request**: 10 images
- **Rate limit**: 5 requests per second
- **Pricing**: $0.07 per image
- **NOT supported**: `quality`, `size`, `style` parameters
- Prompts are automatically revised by a chat model before generation

---

## Structured Outputs

Force Grok to return JSON matching a specific schema.

### Python with Pydantic

```python
import os
from pydantic import BaseModel, Field
from typing import List
from xai_sdk import Client
from xai_sdk.chat import system, user

class Product(BaseModel):
    name: str = Field(description="Product name")
    price: float = Field(description="Price in USD")
    category: str = Field(description="Product category")

class ProductList(BaseModel):
    products: List[Product]

client = Client(api_key=os.getenv('XAI_API_KEY'))

chat = client.chat.create(
    model="grok-4",
    response_format=ProductList  # Pydantic model
)

chat.append(system("Extract product information from text."))
chat.append(user("iPhone 15 Pro costs $999, MacBook Air is $1299"))

response = chat.sample()
products = ProductList.model_validate_json(response.content)
print(products)
```

### TypeScript with Zod

```typescript
import { xai } from '@ai-sdk/xai';
import { generateObject } from 'ai';
import { z } from 'zod';

const ProductSchema = z.object({
  products: z.array(z.object({
    name: z.string(),
    price: z.number(),
    category: z.string()
  }))
});

const { object } = await generateObject({
  model: xai('grok-4'),
  schema: ProductSchema,
  prompt: 'iPhone 15 Pro costs $999, MacBook Air is $1299'
});

console.log(object.products);
```

### Supported Types

- String, Number, Integer, Boolean
- Array, Object, Enum
- Nested objects and arrays

---

## Error Handling

### Error Types

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Invalid or missing API key |
| 403 | Forbidden | Access denied |
| 429 | Rate Limit | Too many requests |
| 500+ | Server Error | xAI service issues |

### Usage Guidelines Violation

If your request violates usage guidelines, you'll be charged a **$0.05 fee** per request.

### Python Error Handling

```python
import time
import random

def query_with_retry(client, messages, max_retries=3):
    for attempt in range(max_retries):
        try:
            chat = client.chat.create(model="grok-4")
            for msg in messages:
                chat.append(msg)
            return chat.sample()
        except Exception as e:
            if "429" in str(e):  # Rate limited
                delay = (2 ** attempt) + random.uniform(0, 0.1)
                print(f"Rate limited, waiting {delay}s...")
                time.sleep(delay)
            elif "401" in str(e):
                raise Exception("Invalid API key")
            else:
                raise
    raise Exception("Max retries exceeded")
```

### TypeScript Error Handling

```typescript
async function queryWithRetry(
  query: string,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-4',
          messages: [{ role: 'user', content: query }]
        })
      });

      if (response.status === 429) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError;
}
```

---

## Best Practices

### Prompt Engineering

```typescript
// Job first - state the outcome
{ role: 'system', content: 'Draft a 100-word executive summary.' }

// Lock Grok into character
{ role: 'system', content: 'You are a concise financial analyst.' }

// Context before question
{ role: 'user', content: 'Given this data: [data]... What trends do you see?' }

// Positive instructions
{ role: 'system', content: 'Return JSON with keys: title, summary, tags.' }

// Guardrails
{ role: 'system', content: "If unsure, reply exactly 'I don't know'." }
```

### Cost Optimization

1. **Start with `grok-3-mini-fast`** for simple queries
2. **Use `grok-4-1-fast`** for agentic tasks (optimized pricing)
3. **Cache frequent prompts** client-side
4. **Use cached input tokens** when possible (75% cheaper)
5. **Batch requests** during off-peak times

### Model Selection by Use Case

| Use Case | Recommended Model |
|----------|-------------------|
| Customer chat at scale | `grok-3-mini-fast` |
| Complex coding agent | `grok-4` |
| Latency-sensitive dashboards | `grok-3-fast` |
| OCR, diagram analysis | `grok-4` (vision) |
| Marketing creatives | `grok-2-image` |
| Agentic research | `grok-4-1-fast` |
| CI/CD code tasks | `grok-code-fast-1` |

### Important Notes

1. **No knowledge of current events** without Live Search or agentic tools
2. **Timeout for reasoning models**: Use longer timeouts (3600s recommended)
3. **OpenAI/Anthropic SDK compatible**: Just change base URL and API key
4. **Regional endpoints available**: e.g., `https://us-west-1.api.x.ai/v1`

---

## Pricing Reference

### Token Pricing (per million tokens)

| Model | Input | Output | Cached Input |
|-------|-------|--------|--------------|
| grok-4 | $3.00 | $15.00 | $0.75 |
| grok-4-fast | Lower | Lower | - |
| grok-4-1-fast | $0.20 | $0.50 | - |
| grok-code-fast-1 | $0.20 | $1.50 | - |
| grok-3 | ~$3.00 | ~$15.00 | - |
| grok-3-mini | Lower | Lower | - |

### Other Pricing

| Feature | Price |
|---------|-------|
| Live Search | $25/1K sources ($0.025/source) |
| Image Generation | $0.07/image |
| Usage Guideline Violation | $0.05/request |

### Free Credits

- Beta program may include free monthly credits
- Check console.x.ai for current promotions

---

## Quick Reference Card

```typescript
// Minimal working example
const response = await fetch('https://api.x.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'grok-4',  // or 'grok-4-1-fast' for agentic
    messages: [
      { role: 'system', content: 'You are Grok, a helpful assistant.' },
      { role: 'user', content: 'Your query here' }
    ],
    temperature: 0.7,
    max_tokens: 1000
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

---

## Migration from Other Providers

xAI API is compatible with OpenAI and Anthropic SDKs:

```python
# OpenAI → xAI
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("XAI_API_KEY"),  # Change key
    base_url="https://api.x.ai/v1"      # Change URL
)
# Rest of code stays the same!
```

```typescript
// OpenAI → xAI (TypeScript)
const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1'
});
// Same API calls work!
```

---

*Documentation compiled from official xAI docs, SDK references, and community resources. Last updated: December 2025.*

# Anthropic Claude API Documentation

## Overview

Anthropic's Claude API provides access to a family of AI models designed for safety, reliability, and advanced reasoning. Claude models excel at complex tasks like coding, analysis, content generation, and multi-step agentic workflows. The API is available directly from Anthropic, as well as through AWS Bedrock and Google Cloud Vertex AI.

**Key Capabilities:**
- **Text Generation:** Conversational AI with deep reasoning
- **Vision:** Image and document analysis
- **PDF Support:** Native PDF document processing
- **Tool Use (Function Calling):** Connect to external systems and APIs
- **Extended Thinking:** Visible step-by-step reasoning process
- **Citations:** Source attribution for document-grounded responses
- **Prompt Caching:** Up to 90% cost reduction on repeated content
- **Batch Processing:** 50% discount for async workloads
- **Structured Outputs:** Guaranteed JSON schema conformance
- **Web Search & Fetch:** Built-in tools for web access

---

## Authentication

### API Key Authentication

All API requests require an API key passed via the `x-api-key` header.

**Headers:**
```
x-api-key: YOUR_API_KEY
anthropic-version: 2023-06-01
Content-Type: application/json
```

**Get API Key:**
1. Create account at https://console.anthropic.com
2. Navigate to API Keys section
3. Create and securely store your key

**Environment Variable:**
```bash
export ANTHROPIC_API_KEY="sk-ant-your-api-key-here"
```

**Security Notes:**
- API keys cannot be viewed again after creation
- Use environment variables, not hardcoded keys
- New accounts receive $5 in free credits (no credit card required)

---

## Base URL

```
https://api.anthropic.com/v1
```

**Alternative Providers:**
- AWS Bedrock: Regional endpoints via AWS SDK
- Google Vertex AI: Regional endpoints via Google Cloud

---

## Available Models (December 2025)

### Current Models

| Model | Model ID | Context | Max Output | Best For |
|-------|----------|---------|------------|----------|
| **Claude Opus 4.5** | `claude-opus-4-5-20251124` | 200K | 64K | Maximum intelligence, complex reasoning |
| **Claude Sonnet 4.5** | `claude-sonnet-4-5-20250929` | 200K (1M beta) | 64K | Best coding, production agents |
| **Claude Haiku 4.5** | `claude-haiku-4-5-20251001` | 200K | 64K | Near-frontier, fastest, cost-effective |
| Claude Opus 4.1 | `claude-opus-4-1-20250805` | 200K | 32K | Advanced coding, agentic workflows |
| Claude Sonnet 4 | `claude-sonnet-4-20250514` | 200K (1M beta) | 64K | Balanced performance |
| Claude Sonnet 3.7 | `claude-3-7-sonnet-20250219` | 200K | 128K | Step-by-step reasoning |
| Claude Haiku 3.5 | `claude-3-5-haiku-20241022` | 200K | 8K | Fast, efficient |
| Claude Haiku 3 | `claude-3-haiku-20240307` | 200K | 4K | Fastest, cheapest |

**Model Aliases** (auto-update to latest):
- `claude-opus-4-5-latest`
- `claude-sonnet-4-5-latest`
- `claude-haiku-4-5-latest`

**Note:** Use specific model versions (e.g., `claude-sonnet-4-5-20250929`) in production for consistent behavior.

### Model Selection Guide

| Use Case | Recommended Model |
|----------|-------------------|
| Complex coding, multi-day projects | Claude Opus 4.5 |
| Production agents, everyday coding | Claude Sonnet 4.5 |
| High-volume tasks, real-time apps | Claude Haiku 4.5 |
| Budget-conscious, simple tasks | Claude Haiku 3.5 / Haiku 3 |
| Educational, visible reasoning | Claude Sonnet 3.7 |

---

## Pricing (December 2025)

### Standard Pricing (per 1M tokens)

| Model | Input | Output | Cache Write (5m) | Cache Read |
|-------|-------|--------|------------------|------------|
| Claude Opus 4.5 | $5.00 | $25.00 | $6.25 | $0.50 |
| Claude Sonnet 4.5 | $3.00 | $15.00 | $3.75 | $0.30 |
| Claude Haiku 4.5 | $1.00 | $5.00 | $1.25 | $0.10 |
| Claude Opus 4.1 | $15.00 | $75.00 | $18.75 | $1.50 |
| Claude Sonnet 4 | $3.00 | $15.00 | $3.75 | $0.30 |
| Claude Sonnet 3.7 | $3.00 | $15.00 | $3.75 | $0.30 |
| Claude Haiku 3.5 | $0.80 | $4.00 | $1.00 | $0.08 |
| Claude Haiku 3 | $0.25 | $1.25 | $0.31 | $0.025 |

### Batch API Pricing

**50% discount** on both input and output tokens:

| Model | Batch Input | Batch Output |
|-------|-------------|--------------|
| Claude Opus 4.5 | $2.50 | $12.50 |
| Claude Sonnet 4.5 | $1.50 | $7.50 |
| Claude Haiku 4.5 | $0.50 | $2.50 |

### Long Context Pricing (>200K tokens)

For Sonnet 4/4.5 with 1M context window enabled:
- Input: 2x base price ($6.00/1M for Sonnet 4.5)
- Output: 1.5x base price ($22.50/1M for Sonnet 4.5)

### Prompt Caching Pricing

| Cache Type | Write Cost | Read Cost |
|------------|------------|-----------|
| 5-minute TTL (default) | 1.25x base input | 0.1x base input |
| 1-hour TTL | 2x base input | 0.1x base input |

### Extended Thinking

Thinking tokens are charged at output token rates. Use the `budget_tokens` parameter to control costs.

---

## API Endpoints

### Messages API

**POST** `https://api.anthropic.com/v1/messages`

The primary endpoint for all Claude interactions.

```typescript
interface MessagesRequest {
  model: string;                    // Required: Model ID
  messages: Message[];              // Required: Conversation messages
  max_tokens: number;               // Required: Max output tokens
  system?: string | SystemBlock[];  // Optional: System prompt
  temperature?: number;             // 0-1, default 1
  top_p?: number;                   // Nucleus sampling
  top_k?: number;                   // Top-k sampling
  stop_sequences?: string[];        // Stop generation sequences
  stream?: boolean;                 // Enable streaming
  tools?: Tool[];                   // Function definitions
  tool_choice?: ToolChoice;         // Tool selection preference
  metadata?: { user_id?: string };  // Optional metadata
  thinking?: ThinkingConfig;        // Extended thinking settings
}

interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface ContentBlock {
  type: 'text' | 'image' | 'document' | 'tool_use' | 'tool_result';
  // Type-specific fields
}
```

### Message Batches API

**POST** `https://api.anthropic.com/v1/messages/batches`

Process large volumes asynchronously at 50% discount.

```typescript
interface BatchRequest {
  requests: {
    custom_id: string;
    params: MessagesRequest;
  }[];
}
```

### Token Counting API

**POST** `https://api.anthropic.com/v1/messages/count_tokens`

Count tokens before sending a request.

```typescript
interface TokenCountRequest {
  model: string;
  messages: Message[];
  system?: string | SystemBlock[];
  tools?: Tool[];
}
```

---

## Messages API Request Structure

### Basic Request

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "What are the key principles of effective technical documentation?" }
  ]
});
```

### With System Prompt

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  system: "You are an expert technical writer specializing in clear, concise documentation.",
  messages: [
    { role: "user", content: "Explain the benefits of modular software architecture." }
  ]
});
```

### Multi-turn Conversation

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "I'm building a REST API for a mobile app." },
    { role: "assistant", content: "Great! Let me help you with that..." },
    { role: "user", content: "What authentication method should I use?" }
  ]
});
```

### With Images (Vision)

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: base64ImageData
          }
        },
        {
          type: "text",
          text: "Analyze this image and describe its key visual elements."
        }
      ]
    }
  ]
});
```

**Image Constraints:**
- Max 20 images per request
- Max size: 3.75 MB per image
- Max dimensions: 8,000 x 8,000 px
- Supported formats: JPEG, PNG, GIF, WebP

### With PDF Documents

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64PdfData
          }
        },
        {
          type: "text",
          text: "Summarize the key findings from this market research report."
        }
      ]
    }
  ]
});
```

**PDF Constraints:**
- Max 5 documents per request
- Max size: 4.5 MB per document

---

## Response Structure

```typescript
interface MessagesResponse {
  id: string;                        // Unique response ID
  type: "message";
  role: "assistant";
  content: ContentBlock[];           // Response content
  model: string;                     // Model used
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}
```

---

## Tool Use (Function Calling)

### Defining Tools

```typescript
const tools = [
  {
    name: "get_weather",
    description: "Get the current weather for a location",
    input_schema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City and state, e.g., San Francisco, CA"
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "Temperature unit"
        }
      },
      required: ["location"]
    }
  }
];
```

### Strict Tool Use (Structured Outputs)

Guarantee schema conformance with `strict: true`:

```typescript
const tools = [
  {
    name: "search_database",
    description: "Search the database for records",
    strict: true,  // Enables guaranteed schema conformance
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        table: {
          type: "string",
          enum: ["users", "products", "orders"]
        }
      },
      required: ["query", "table"],
      additionalProperties: false  // Required for strict mode
    }
  }
];
```

### Tool Use Flow

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Step 1: Initial request with tools
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  tools: tools,
  messages: [
    { role: "user", content: "What's the weather in San Francisco?" }
  ]
});

// Step 2: Check if Claude wants to use a tool
if (response.stop_reason === "tool_use") {
  const toolUse = response.content.find(block => block.type === "tool_use");

  // Step 3: Execute the tool
  const toolResult = await executeYourTool(toolUse.name, toolUse.input);

  // Step 4: Send result back to Claude
  const finalResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    tools: tools,
    messages: [
      { role: "user", content: "What's the weather in San Francisco?" },
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(toolResult)
          }
        ]
      }
    ]
  });
}
```

### Built-in Server Tools

Claude provides server-side tools that don't require implementation:

```typescript
// Web Search Tool
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  tools: [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 10  // Optional: limit searches
    }
  ],
  messages: [
    { role: "user", content: "What are the latest developments in AI technology?" }
  ]
});

// Web Fetch Tool
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  tools: [
    {
      type: "web_fetch_20250305",
      name: "web_fetch"
    }
  ],
  messages: [
    { role: "user", content: "Fetch and analyze the content from https://example.com/trends" }
  ]
});
```

---

## Extended Thinking

Extended thinking enables Claude to show step-by-step reasoning for complex problems.

### Enabling Extended Thinking

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 16000,
  thinking: {
    type: "enabled",
    budget_tokens: 10000  // Minimum 1024
  },
  messages: [
    { role: "user", content: "Analyze the advantages and disadvantages of microservices architecture." }
  ]
});

// Response includes thinking blocks
for (const block of response.content) {
  if (block.type === "thinking") {
    console.log("Reasoning:", block.thinking);
  } else if (block.type === "text") {
    console.log("Response:", block.text);
  }
}
```

### Interleaved Thinking (with Tools)

For Claude 4 models, enable thinking between tool calls:

```typescript
const response = await anthropic.messages.create({
  model: "claude-opus-4-5-20251124",
  max_tokens: 16000,
  betas: ["interleaved-thinking-2025-05-14"],
  thinking: {
    type: "enabled",
    budget_tokens: 10000
  },
  tools: tools,
  messages: [
    { role: "user", content: "Research and analyze the top 5 cloud computing platforms" }
  ]
});
```

### Effort Parameter (Opus 4.5)

Control reasoning depth vs. token usage:

```typescript
const response = await anthropic.messages.create({
  model: "claude-opus-4-5-20251124",
  max_tokens: 8000,
  effort: "medium",  // "low" | "medium" | "high"
  messages: [
    { role: "user", content: "Optimize this product listing..." }
  ]
});
```

---

## Prompt Caching

Reduce costs up to 90% and latency up to 85% by caching repeated content.

### Basic Caching

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  system: [
    {
      type: "text",
      text: "You are an expert technical assistant...",  // This gets cached
      cache_control: { type: "ephemeral" }
    }
  ],
  messages: [
    { role: "user", content: "Analyze this design..." }
  ]
});

// Check cache usage in response
console.log("Cache created:", response.usage.cache_creation_input_tokens);
console.log("Cache read:", response.usage.cache_read_input_tokens);
```

### 1-Hour Cache TTL

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  betas: ["extended-cache-ttl-2025-04-11"],
  system: [
    {
      type: "text",
      text: longDocumentContent,
      cache_control: {
        type: "ephemeral",
        ttl: "1h"  // 1-hour cache
      }
    }
  ],
  messages: [
    { role: "user", content: "Question about the document..." }
  ]
});
```

### Cache Requirements

- Minimum tokens: 1,024 (Sonnet/Opus), 2,048 (Haiku)
- Maximum breakpoints: 4 per request
- Cache order: tools -> system -> messages
- TTL refreshes on each cache hit

---

## Citations

Ground responses in source documents with automatic attribution.

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "text",
            media_type: "text/plain",
            data: documentContent
          },
          citations: { enabled: true }
        },
        {
          type: "text",
          text: "What are the key findings? Cite your sources."
        }
      ]
    }
  ]
});

// Response includes citation references
for (const block of response.content) {
  if (block.type === "text" && block.citations) {
    console.log("Citations:", block.citations);
  }
}
```

---

## Streaming

Receive responses as they're generated using Server-Sent Events (SSE).

```typescript
const stream = await anthropic.messages.stream({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "Write a product description..." }
  ]
});

for await (const event of stream) {
  if (event.type === "content_block_delta") {
    if (event.delta.type === "text_delta") {
      process.stdout.write(event.delta.text);
    }
  }
}

// Get final message
const finalMessage = await stream.finalMessage();
```

### Streaming Event Types

| Event | Description |
|-------|-------------|
| `message_start` | Beginning of response |
| `content_block_start` | Start of content block |
| `content_block_delta` | Incremental content |
| `content_block_stop` | End of content block |
| `message_delta` | Message-level updates |
| `message_stop` | End of response |

---

## Batch Processing

Process large volumes at 50% discount with 24-hour turnaround.

### Creating a Batch

```typescript
const batch = await anthropic.messages.batches.create({
  requests: [
    {
      custom_id: "request-1",
      params: {
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [
          { role: "user", content: "Summarize: cloud computing benefits" }
        ]
      }
    },
    {
      custom_id: "request-2",
      params: {
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [
          { role: "user", content: "Summarize: machine learning applications" }
        ]
      }
    }
    // Up to 100,000 requests per batch
  ]
});

console.log("Batch ID:", batch.id);
console.log("Status:", batch.processing_status);
```

### Checking Batch Status

```typescript
const status = await anthropic.messages.batches.retrieve(batch.id);
console.log("Status:", status.processing_status);
// "in_progress" | "ended"

if (status.processing_status === "ended") {
  // Download results
  const results = await anthropic.messages.batches.results(batch.id);
  for await (const result of results) {
    console.log(result.custom_id, result.result);
  }
}
```

---

## TypeScript/JavaScript Implementation

### Installation

```bash
npm install @anthropic-ai/sdk
```

### Configuration

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

---

## Python Implementation

### Installation

```bash
pip install anthropic
```

### Basic Usage

```python
import anthropic
import os

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# Basic message
response = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Explain the benefits of microservices architecture"}
    ]
)

print(response.content[0].text)
```

### With Tools

```python
response = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=1024,
    tools=[
        {
            "name": "get_weather",
            "description": "Get current weather for a location",
            "input_schema": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"},
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
                },
                "required": ["location"]
            }
        }
    ],
    messages=[
        {"role": "user", "content": "What's the weather in San Francisco?"}
    ]
)

for block in response.content:
    if block.type == "tool_use":
        print(f"Tool: {block.name}")
        print(f"Input: {block.input}")
```

### Streaming

```python
with client.messages.stream(
    model="claude-sonnet-4-5-20250929",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Write a product description..."}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

---

## Error Handling

```typescript
import Anthropic from '@anthropic-ai/sdk';

async function safeApiCall<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        throw error; // Don't retry auth errors
      }

      if (error instanceof Anthropic.RateLimitError) {
        const retryAfter = error.headers?.['retry-after'] || 60;
        console.log(`Rate limited, waiting ${retryAfter}s`);
        await new Promise(r => setTimeout(r, Number(retryAfter) * 1000));
        continue;
      }

      if (error instanceof Anthropic.APIStatusError) {
        if (error.status >= 500) {
          // Exponential backoff for server errors
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      throw error;
    }
  }

  throw new Error("Max retries exceeded");
}
```

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad request | Check parameters |
| 401 | Unauthorized | Check API key |
| 403 | Forbidden | Check permissions |
| 404 | Not found | Check endpoint |
| 429 | Rate limited | Apply backoff |
| 500+ | Server error | Retry with backoff |

---

## Rate Limits

Limits vary by usage tier (based on deposit/spend history):

| Tier | Requests/min | Input tokens/min | Output tokens/min |
|------|--------------|------------------|-------------------|
| Tier 1 | 50 | 40,000 | 8,000 |
| Tier 2 | 1,000 | 80,000 | 16,000 |
| Tier 3 | 2,000 | 160,000 | 32,000 |
| Tier 4 | 4,000 | 400,000 | 80,000 |

**Best Practices:**
- Monitor `x-ratelimit-*` response headers
- Implement exponential backoff
- Use batch API for high-volume workloads
- Consider model-specific limits (Opus has lower limits)

---

## Best Practices

### Cost Optimization

1. **Use appropriate models:**
   - Haiku 4.5 for high-volume, simple tasks (5x cheaper than Sonnet)
   - Sonnet 4.5 for balanced production use
   - Opus 4.5 only for complex reasoning

2. **Leverage prompt caching:**
   - Cache system prompts, examples, and reference documents
   - Up to 90% savings on cached content
   - 5-minute default TTL refreshes on use

3. **Use batch API:**
   - 50% discount for async processing
   - Ideal for bulk keyword analysis, listing generation

4. **Optimize prompts:**
   - Be concise but clear
   - Use structured outputs to reduce retries
   - Set appropriate max_tokens limits

### Quality Optimization

1. **Use extended thinking** for complex analysis
2. **Enable strict tool use** for guaranteed schema conformance
3. **Use citations** for document-grounded responses
4. **Provide clear examples** in system prompts

### Production Best Practices

1. **Use specific model versions** (not aliases) for consistency
2. **Implement comprehensive error handling**
3. **Monitor token usage** and costs
4. **Set up rate limit handling** with backoff
5. **Use streaming** for better user experience

---

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-your-api-key

# Optional
ANTHROPIC_BASE_URL=https://api.anthropic.com  # For proxies
```

---

## Additional Resources

- **API Reference:** https://docs.anthropic.com/en/api
- **Console:** https://console.anthropic.com
- **Pricing:** https://www.anthropic.com/pricing
- **Prompt Library:** https://docs.anthropic.com/en/prompt-library
- **Cookbook:** https://github.com/anthropics/anthropic-cookbook
- **SDK (TypeScript):** https://github.com/anthropics/anthropic-sdk-typescript
- **SDK (Python):** https://github.com/anthropics/anthropic-sdk-python
- **Model Deprecations:** https://docs.anthropic.com/en/docs/about-claude/models/model-deprecations
- **Status:** https://status.anthropic.com

---

*Last Updated: December 2025*

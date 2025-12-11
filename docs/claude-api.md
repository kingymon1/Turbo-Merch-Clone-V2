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

**Use Cases for Amazon Merch:**
- Generate SEO-optimized product listings and descriptions
- Analyze competitor products and market trends
- Build intelligent research assistants
- Create automated content generation pipelines
- Develop multi-step workflows with tool orchestration
- Process and analyze design documents and images

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
    { role: "user", content: "What are the key elements of a successful Amazon product listing?" }
  ]
});
```

### With System Prompt

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  system: "You are an expert Amazon Merch on Demand consultant specializing in SEO-optimized product listings.",
  messages: [
    { role: "user", content: "Create a title and bullet points for a vintage gaming t-shirt design." }
  ]
});
```

### Multi-turn Conversation

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "I'm designing a t-shirt for cat lovers." },
    { role: "assistant", content: "Great choice! Cat-themed products are popular..." },
    { role: "user", content: "What keywords should I target?" }
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
          text: "Analyze this t-shirt design for potential Amazon Merch listing."
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
    name: "get_product_data",
    description: "Fetch product information from Amazon by ASIN",
    input_schema: {
      type: "object",
      properties: {
        asin: {
          type: "string",
          description: "Amazon Standard Identification Number"
        },
        marketplace: {
          type: "string",
          enum: ["US", "UK", "DE", "JP"],
          description: "Amazon marketplace"
        }
      },
      required: ["asin"]
    }
  }
];
```

### Strict Tool Use (Structured Outputs)

Guarantee schema conformance with `strict: true`:

```typescript
const tools = [
  {
    name: "analyze_keyword",
    description: "Analyze a keyword for Amazon Merch potential",
    strict: true,  // Enables guaranteed schema conformance
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string" },
        category: {
          type: "string",
          enum: ["apparel", "accessories", "home"]
        }
      },
      required: ["keyword", "category"],
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
    { role: "user", content: "Get product data for ASIN B08N5WRWNW" }
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
      { role: "user", content: "Get product data for ASIN B08N5WRWNW" },
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
    { role: "user", content: "What are the current trending t-shirt designs?" }
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
    { role: "user", content: "Analyze the market potential for a quantum computing themed t-shirt line." }
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
    { role: "user", content: "Research and analyze the top 5 competitors for cat-themed t-shirts" }
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
      text: "You are an Amazon Merch expert...",  // This gets cached
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
          { role: "user", content: "Analyze keyword: vintage gaming" }
        ]
      }
    },
    {
      custom_id: "request-2",
      params: {
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [
          { role: "user", content: "Analyze keyword: cat lover" }
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

### Complete Amazon Merch Service

```typescript
import Anthropic from '@anthropic-ai/sdk';

interface ProductListing {
  title: string;
  bulletPoints: string[];
  description: string;
  searchTerms: string[];
}

interface KeywordAnalysis {
  keyword: string;
  score: number;
  competition: 'low' | 'medium' | 'high';
  reasoning: string;
}

class ClaudeMerchService {
  private anthropic: Anthropic;
  private model = "claude-sonnet-4-5-20250929";

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  async generateProductListing(
    designDescription: string,
    targetKeywords: string[]
  ): Promise<ProductListing> {
    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: `You are an expert Amazon Merch on Demand listing optimizer.
Create SEO-optimized listings that follow Amazon's guidelines:
- Title: Max 200 characters, front-loaded with keywords
- Bullet points: 5 points, max 256 characters each
- Description: Max 2000 characters, benefit-focused
- Search terms: 7 terms, max 250 characters total

Always respond with valid JSON matching the ProductListing schema.`,
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: [
        {
          role: "user",
          content: `Create a product listing for this t-shirt design:
Description: ${designDescription}
Target keywords: ${targetKeywords.join(', ')}`
        }
      ],
      tools: [
        {
          name: "create_listing",
          description: "Create a structured product listing",
          strict: true,
          input_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              bulletPoints: {
                type: "array",
                items: { type: "string" }
              },
              description: { type: "string" },
              searchTerms: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["title", "bulletPoints", "description", "searchTerms"],
            additionalProperties: false
          }
        }
      ],
      tool_choice: { type: "tool", name: "create_listing" }
    });

    const toolUse = response.content.find(b => b.type === "tool_use");
    if (toolUse && toolUse.type === "tool_use") {
      return toolUse.input as ProductListing;
    }

    throw new Error("Failed to generate listing");
  }

  async analyzeKeywords(keywords: string[]): Promise<KeywordAnalysis[]> {
    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      thinking: {
        type: "enabled",
        budget_tokens: 5000
      },
      messages: [
        {
          role: "user",
          content: `Analyze these keywords for Amazon Merch potential:
${keywords.map((k, i) => `${i + 1}. ${k}`).join('\n')}

For each keyword, provide:
- Score (1-10)
- Competition level (low/medium/high)
- Reasoning`
        }
      ],
      tools: [
        {
          name: "keyword_analysis",
          strict: true,
          input_schema: {
            type: "object",
            properties: {
              analyses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    keyword: { type: "string" },
                    score: { type: "number" },
                    competition: {
                      type: "string",
                      enum: ["low", "medium", "high"]
                    },
                    reasoning: { type: "string" }
                  },
                  required: ["keyword", "score", "competition", "reasoning"],
                  additionalProperties: false
                }
              }
            },
            required: ["analyses"],
            additionalProperties: false
          }
        }
      ],
      tool_choice: { type: "tool", name: "keyword_analysis" }
    });

    const toolUse = response.content.find(b => b.type === "tool_use");
    if (toolUse && toolUse.type === "tool_use") {
      return (toolUse.input as { analyses: KeywordAnalysis[] }).analyses;
    }

    throw new Error("Failed to analyze keywords");
  }

  async analyzeDesignImage(imageBase64: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: imageBase64
              }
            },
            {
              type: "text",
              text: `Analyze this t-shirt design for Amazon Merch:
1. Describe the design elements
2. Suggest target audience
3. Recommend keywords
4. Identify potential issues (trademark, quality, etc.)
5. Rate marketability (1-10)`
            }
          ]
        }
      ]
    });

    const textBlock = response.content.find(b => b.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "";
  }

  async researchTrends(topic: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5
        }
      ],
      messages: [
        {
          role: "user",
          content: `Research current trends for "${topic}" in the print-on-demand / t-shirt market.
Include:
- Popular sub-niches
- Trending designs styles
- Seasonal opportunities
- Competition analysis`
        }
      ]
    });

    const textBlock = response.content.find(b => b.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "";
  }

  async batchAnalyzeKeywords(keywords: string[]): Promise<void> {
    const requests = keywords.map((keyword, index) => ({
      custom_id: `keyword-${index}`,
      params: {
        model: this.model,
        max_tokens: 500,
        messages: [
          {
            role: "user" as const,
            content: `Analyze "${keyword}" for Amazon Merch. Score 1-10, competition level, and brief reasoning. Respond in JSON.`
          }
        ]
      }
    }));

    const batch = await this.anthropic.messages.batches.create({ requests });
    console.log("Batch created:", batch.id);
    console.log("Check status with: anthropic.messages.batches.retrieve(batch.id)");
  }

  estimateCost(options: {
    inputTokens: number;
    outputTokens: number;
    cached?: boolean;
    batch?: boolean;
  }): number {
    // Sonnet 4.5 pricing
    let inputRate = 3.00;  // per 1M tokens
    let outputRate = 15.00;

    if (options.cached) {
      inputRate = 0.30;  // Cache read rate
    }

    if (options.batch) {
      inputRate *= 0.5;
      outputRate *= 0.5;
    }

    const inputCost = (options.inputTokens / 1_000_000) * inputRate;
    const outputCost = (options.outputTokens / 1_000_000) * outputRate;

    return Math.round((inputCost + outputCost) * 10000) / 10000;
  }
}

// Usage
const claude = new ClaudeMerchService(process.env.ANTHROPIC_API_KEY!);

// Generate listing
const listing = await claude.generateProductListing(
  "A vintage-style pixel art design featuring a retro game controller with 80s synthwave colors",
  ["retro gaming", "pixel art", "80s", "gamer gift", "vintage"]
);

console.log("Generated listing:", listing);

// Analyze keywords
const analysis = await claude.analyzeKeywords([
  "cat mom",
  "dog dad",
  "plant parent",
  "coffee lover"
]);

console.log("Keyword analysis:", analysis);
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
        {"role": "user", "content": "Create a product title for a cat-themed t-shirt"}
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
            "name": "analyze_keyword",
            "description": "Analyze keyword potential",
            "input_schema": {
                "type": "object",
                "properties": {
                    "keyword": {"type": "string"},
                    "score": {"type": "number"},
                    "reasoning": {"type": "string"}
                },
                "required": ["keyword", "score", "reasoning"]
            }
        }
    ],
    messages=[
        {"role": "user", "content": "Analyze 'vintage gaming' as a merch keyword"}
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

## Comparison with OpenAI

| Feature | Claude | OpenAI |
|---------|--------|--------|
| Best coding model | Sonnet 4.5 | GPT-4.1 |
| Visible reasoning | Extended thinking | - |
| Prompt caching | Native (90% savings) | 50-90% savings |
| Batch discount | 50% | 50% |
| Context window | 200K (1M beta) | 1M (GPT-4.1) |
| Document support | Native PDF | File API |
| Citations | Native feature | - |

---

*Last Updated: December 2025*

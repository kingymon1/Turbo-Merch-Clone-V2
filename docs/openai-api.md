# OpenAI API Documentation

## Overview

OpenAI provides a comprehensive suite of AI models accessible via API, including text generation (GPT), image generation (DALL-E/GPT Image), speech-to-text (Whisper), text-to-speech (TTS), embeddings, and reasoning models (o-series). The platform offers multiple APIs including the new Responses API (March 2025), Chat Completions, and specialized endpoints for audio, images, and embeddings.

**Key Capabilities:**
- **Text Generation:** GPT-4.1, GPT-4o, GPT-5, and reasoning models (o1, o3, o4-mini)
- **Image Generation:** DALL-E 3, GPT Image 1
- **Speech-to-Text:** Whisper, GPT-4o Transcribe
- **Text-to-Speech:** TTS, TTS HD, GPT-4o-mini-tts
- **Embeddings:** text-embedding-3-small, text-embedding-3-large
- **Function Calling:** Structured outputs with tool use
- **Built-in Tools:** Web search, file search, code interpreter, computer use

---

## Authentication

### API Key Authentication

All API requests require an API key passed via HTTP header.

**Header:**
```
Authorization: Bearer YOUR_API_KEY
```

**Get API Key:**
1. Create account at https://platform.openai.com
2. Navigate to API keys section
3. Generate and securely store your secret key

**Environment Variable:**
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

**Security Notes:**
- Never expose API keys in client-side code
- Use environment variables or secret management
- Your HTTP client must support SNI (Server Name Indication)

---

## Base URL

```
https://api.openai.com/v1
```

---

## Available Models (December 2025)

### GPT Models (Text Generation)

| Model | Context | Description | Best For |
|-------|---------|-------------|----------|
| `gpt-4.1` | 1M tokens | Latest flagship, excellent coding | Production apps, coding |
| `gpt-4.1-mini` | 1M tokens | Fast, cost-effective | High-volume tasks |
| `gpt-4.1-nano` | 1M tokens | Fastest, cheapest | Classification, simple tasks |
| `gpt-4o` | 128K tokens | Multimodal (text, image, audio) | Vision tasks, general use |
| `gpt-4o-mini` | 128K tokens | Smaller multimodal | Cost-sensitive apps |
| `gpt-5` | 1M tokens | Latest premium model | Complex reasoning |
| `gpt-5-mini` | 1M tokens | Balanced performance | General production |
| `gpt-5-nano` | 1M tokens | Budget option | High volume |

### Reasoning Models (o-series)

| Model | Context | Description | Best For |
|-------|---------|-------------|----------|
| `o3` | 200K tokens | Most capable reasoning | Complex STEM, research |
| `o3-pro` | 200K tokens | Extended reasoning | Hard problems |
| `o4-mini` | 200K tokens | Fast reasoning | Quick complex tasks |
| `o1` | 128K tokens | Original reasoning model | Multi-step analysis |

**Note:** Reasoning models use "reasoning tokens" for internal thinking, billed as output tokens but not visible in responses.

### Image Models

| Model | Description | Pricing |
|-------|-------------|---------|
| `gpt-image-1` | Latest flagship image generation | $0.011-$0.25/image |
| `gpt-image-1-mini` | Cost-effective image generation | $0.005-$0.052/image |
| `dall-e-3` | Previous generation, proven quality | $0.04-$0.12/image |
| `dall-e-2` | Legacy, lowest cost | $0.016-$0.02/image |

### Audio Models

| Model | Description | Pricing |
|-------|-------------|---------|
| `whisper-1` | General speech recognition | $0.006/minute |
| `gpt-4o-transcribe` | Advanced transcription | $0.006/minute |
| `gpt-4o-mini-transcribe` | Cost-effective transcription | $0.003/minute |
| `tts-1` | Text-to-speech (standard) | $15/1M characters |
| `tts-1-hd` | Text-to-speech (HD quality) | $30/1M characters |
| `gpt-4o-mini-tts` | Multimodal TTS | ~$0.015/minute |

### Embedding Models

| Model | Dimensions | Pricing |
|-------|------------|---------|
| `text-embedding-3-large` | Up to 3072 | $0.13/1M tokens |
| `text-embedding-3-small` | Up to 1536 | $0.02/1M tokens |
| `text-embedding-ada-002` | 1536 (legacy) | $0.10/1M tokens |

---

## Pricing (December 2025)

### GPT Model Pricing (per 1M tokens)

| Model | Input | Output | Cached Input |
|-------|-------|--------|--------------|
| gpt-4.1 | $2.00 | $8.00 | $0.50 (75% off) |
| gpt-4.1-mini | $0.40 | $1.60 | $0.10 |
| gpt-4.1-nano | $0.10 | $0.40 | $0.025 |
| gpt-4o | $2.50 | $10.00 | $1.25 (50% off) |
| gpt-4o-mini | $0.15 | $0.60 | $0.075 |
| gpt-5 | $1.25 | $10.00 | $0.125 (90% off) |
| gpt-5-mini | ~$0.25 | ~$2.00 | - |

### Reasoning Model Pricing (per 1M tokens)

| Model | Input | Output |
|-------|-------|--------|
| o3 | $10.00 | $40.00 |
| o3-pro | Higher | Higher |
| o4-mini | $1.10 | $4.40 |
| o1 | $15.00 | $60.00 |

### Image Pricing

**GPT Image 1:**
| Quality | Square (1024x1024) | Portrait/Landscape |
|---------|-------------------|-------------------|
| Low | $0.011 | $0.016 |
| Medium | $0.04 | $0.07 |
| High | $0.17 | $0.25 |

**DALL-E 3:**
| Quality | 1024x1024 | 1024x1792 / 1792x1024 |
|---------|-----------|----------------------|
| Standard | $0.04 | $0.08 |
| HD | $0.08 | $0.12 |

### Batch API Discount

- **50% off** input and output tokens
- Asynchronous processing within 24 hours
- Available for most models

### Prompt Caching

- GPT-5 family: 90% discount on cached tokens
- GPT-4.1 family: 75% discount
- GPT-4o/o-series: 50% discount
- Cache persists 5-10 minutes

---

## API Endpoints

### Chat Completions API

**POST** `https://api.openai.com/v1/chat/completions`

Standard conversational API for text generation.

```typescript
interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;        // 0-2, default 1
  max_tokens?: number;         // Max output tokens
  top_p?: number;              // Nucleus sampling
  frequency_penalty?: number;  // -2 to 2
  presence_penalty?: number;   // -2 to 2
  stop?: string | string[];    // Stop sequences
  stream?: boolean;            // Enable streaming
  tools?: Tool[];              // Function definitions
  tool_choice?: string | object;
  response_format?: ResponseFormat;
  seed?: number;               // For reproducibility
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
```

### Responses API (Recommended - March 2025)

**POST** `https://api.openai.com/v1/responses`

Newer unified API with built-in tool orchestration.

**Key Advantages:**
- Agentic by default - handles multi-tool workflows
- 40-80% better cache utilization
- Built-in tools: web_search, file_search, code_interpreter
- Stateful context with `store: true`
- Future-proofed for new models

```typescript
interface ResponsesRequest {
  model: string;
  input: string | Message[];
  instructions?: string;        // System-level guidance
  tools?: Tool[];
  store?: boolean;              // Maintain state
  stream?: boolean;
  response_format?: ResponseFormat;
}
```

### Images API

**POST** `https://api.openai.com/v1/images/generations`

```typescript
interface ImageGenerationRequest {
  model: 'dall-e-3' | 'dall-e-2' | 'gpt-image-1';
  prompt: string;
  n?: number;                   // Number of images (1 for DALL-E 3)
  size?: '1024x1024' | '1024x1792' | '1792x1024' | '256x256' | '512x512';
  quality?: 'standard' | 'hd' | 'low' | 'medium' | 'high';
  style?: 'vivid' | 'natural';  // DALL-E 3 only
  response_format?: 'url' | 'b64_json';
}
```

### Audio Transcription API

**POST** `https://api.openai.com/v1/audio/transcriptions`

```typescript
// Form data upload
interface TranscriptionRequest {
  file: File;                   // Audio file (mp3, mp4, wav, etc.)
  model: 'whisper-1' | 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe';
  language?: string;            // ISO-639-1 code
  prompt?: string;              // Guide transcription
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
  timestamp_granularities?: ('word' | 'segment')[];
}
```

### Text-to-Speech API

**POST** `https://api.openai.com/v1/audio/speech`

```typescript
interface SpeechRequest {
  model: 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts';
  input: string;                // Text to convert (max 4096 chars)
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  speed?: number;               // 0.25 to 4.0
}
```

### Embeddings API

**POST** `https://api.openai.com/v1/embeddings`

```typescript
interface EmbeddingsRequest {
  model: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';
  input: string | string[];     // Text to embed
  dimensions?: number;          // Reduce dimensions (text-embedding-3 only)
  encoding_format?: 'float' | 'base64';
}
```

### Moderation API

**POST** `https://api.openai.com/v1/moderations`

**Free to use** - checks content for harmful material.

```typescript
interface ModerationRequest {
  model?: 'omni-moderation-latest' | 'text-moderation-latest';
  input: string | string[];
}
```

---

## Function Calling & Structured Outputs

### Defining Functions (Tools)

```typescript
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a location",
      strict: true,  // Enable structured outputs
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City and state, e.g., San Francisco, CA"
          },
          unit: {
            type: ["string", "null"],  // Optional field
            enum: ["celsius", "fahrenheit"],
            description: "Temperature unit"
          }
        },
        required: ["location"],
        additionalProperties: false
      }
    }
  }
];
```

### Structured Output Response Format

```typescript
const response_format = {
  type: "json_schema",
  json_schema: {
    name: "product_analysis",
    strict: true,
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        keywords: {
          type: "array",
          items: { type: "string" }
        },
        score: { type: "number" },
        recommendation: {
          type: "string",
          enum: ["proceed", "revise", "reject"]
        }
      },
      required: ["title", "keywords", "score", "recommendation"],
      additionalProperties: false
    }
  }
};
```

---

## TypeScript/JavaScript Implementation

### Installation

```bash
npm install openai
```

### Basic Configuration

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

### Chat Completions

```typescript
async function generateContent(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0].message.content || '';
}
```

### Streaming Responses

```typescript
async function streamResponse(prompt: string): Promise<void> {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      process.stdout.write(content);
    }
  }
}
```

### Function Calling

```typescript
interface WeatherData {
  location: string;
  temperature: number;
  unit: string;
  conditions: string;
}

async function getWeather(location: string, unit: string = 'fahrenheit'): Promise<WeatherData> {
  // Your actual API call here
  return {
    location,
    temperature: 72,
    unit,
    conditions: "Sunny"
  };
}

async function analyzeWithTools(query: string): Promise<string> {
  const tools: OpenAI.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get the current weather for a location",
        strict: true,
        parameters: {
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
          required: ["location"],
          additionalProperties: false
        }
      }
    }
  ];

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'user', content: query }
  ];

  // First call - model decides if it needs to call a function
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages,
    tools,
    tool_choice: 'auto',
  });

  const message = response.choices[0].message;

  // Check if model wants to call a function
  if (message.tool_calls) {
    // Execute each function call
    for (const toolCall of message.tool_calls) {
      if (toolCall.function.name === 'get_weather') {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await getWeather(args.location, args.unit);

        // Add the tool response to messages
        messages.push(message);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Get final response with function results
    const finalResponse = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages,
    });

    return finalResponse.choices[0].message.content || '';
  }

  return message.content || '';
}
```

### Image Generation

```typescript
interface ImageResult {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

async function generateDesignConcept(
  description: string,
  options: {
    model?: 'dall-e-3' | 'gpt-image-1';
    size?: '1024x1024' | '1024x1792' | '1792x1024';
    quality?: 'standard' | 'hd' | 'low' | 'medium' | 'high';
    style?: 'vivid' | 'natural';
  } = {}
): Promise<ImageResult> {
  const {
    model = 'dall-e-3',
    size = '1024x1024',
    quality = 'standard',
    style = 'vivid'
  } = options;

  const response = await openai.images.generate({
    model,
    prompt: description,
    n: 1,
    size,
    quality,
    style,
    response_format: 'url',
  });

  return {
    url: response.data[0].url,
    revised_prompt: response.data[0].revised_prompt,
  };
}

// Usage
const design = await generateDesignConcept(
  "A minimalist logo featuring a retro sunset over mountains with vapor wave aesthetics",
  { quality: 'hd', style: 'vivid' }
);
```

### Embeddings for Similarity Search

```typescript
async function createEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 512,  // Reduce for storage efficiency
  });

  return response.data[0].embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

async function findSimilarDesigns(
  query: string,
  designEmbeddings: { id: string; embedding: number[] }[]
): Promise<{ id: string; similarity: number }[]> {
  const queryEmbedding = await createEmbedding(query);

  const similarities = designEmbeddings.map(design => ({
    id: design.id,
    similarity: cosineSimilarity(queryEmbedding, design.embedding),
  }));

  return similarities.sort((a, b) => b.similarity - a.similarity);
}
```

### Speech-to-Text (Whisper)

```typescript
import fs from 'fs';

async function transcribeAudio(filePath: string): Promise<string> {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: 'whisper-1',
    language: 'en',
    response_format: 'text',
  });

  return transcription;
}
```

### Text-to-Speech

```typescript
import fs from 'fs';

async function generateSpeech(
  text: string,
  outputPath: string,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'
): Promise<void> {
  const response = await openai.audio.speech.create({
    model: 'tts-1-hd',
    input: text,
    voice,
    response_format: 'mp3',
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}
```

---

## Python Implementation

### Installation

```bash
pip install openai
```

### Basic Usage

```python
from openai import OpenAI
import os

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Chat completion
response = client.chat.completions.create(
    model="gpt-4.1",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain the benefits of renewable energy"}
    ],
    temperature=0.7,
    max_tokens=500
)

print(response.choices[0].message.content)
```

### Image Generation

```python
response = client.images.generate(
    model="dall-e-3",
    prompt="A minimalist illustration of mountains and sunset",
    size="1024x1024",
    quality="hd",
    n=1
)

image_url = response.data[0].url
print(f"Image URL: {image_url}")
```

### Embeddings

```python
response = client.embeddings.create(
    model="text-embedding-3-small",
    input="artificial intelligence machine learning applications",
    dimensions=512
)

embedding = response.data[0].embedding
print(f"Embedding length: {len(embedding)}")
```

### Function Calling

```python
import json

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a location",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City and state, e.g., San Francisco, CA"
                    }
                },
                "required": ["location"],
                "additionalProperties": False
            }
        }
    }
]

response = client.chat.completions.create(
    model="gpt-4.1",
    messages=[{"role": "user", "content": "What's the weather in San Francisco?"}],
    tools=tools,
    tool_choice="auto"
)

if response.choices[0].message.tool_calls:
    tool_call = response.choices[0].message.tool_calls[0]
    args = json.loads(tool_call.function.arguments)
    print(f"Function called: {tool_call.function.name}")
    print(f"Arguments: {args}")
```

---

## Batch API

For non-time-sensitive workloads, use the Batch API to save 50% on costs.

```typescript
// Create batch file
const batchRequests = items.map((item, index) => ({
  custom_id: `request-${index}`,
  method: 'POST',
  url: '/v1/chat/completions',
  body: {
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'user', content: `Summarize: ${item}` }
    ],
    max_tokens: 200,
  }
}));

// Upload file and create batch
const file = await openai.files.create({
  file: fs.createReadStream('batch_requests.jsonl'),
  purpose: 'batch',
});

const batch = await openai.batches.create({
  input_file_id: file.id,
  endpoint: '/v1/chat/completions',
  completion_window: '24h',
});

// Check status
const status = await openai.batches.retrieve(batch.id);
console.log('Batch status:', status.status);

// Download results when complete
if (status.status === 'completed') {
  const results = await openai.files.content(status.output_file_id!);
  // Process results
}
```

---

## Error Handling

```typescript
import { APIError, RateLimitError, AuthenticationError } from 'openai';

async function safeAPICall<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (error instanceof AuthenticationError) {
        throw error; // Don't retry auth errors
      }

      if (error instanceof RateLimitError) {
        const retryAfter = parseInt(error.headers?.['retry-after'] || '60');
        console.log(`Rate limited, waiting ${retryAfter}s`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (error instanceof APIError) {
        if (error.status && error.status >= 500) {
          // Exponential backoff for server errors
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw error;
      }

      throw error;
    }
  }

  throw lastError!;
}
```

---

## Best Practices

### Cost Optimization

1. **Use appropriate models:**
   - GPT-4.1-nano for simple tasks (10x cheaper than GPT-4.1)
   - GPT-4.1-mini for medium complexity
   - GPT-4.1/GPT-5 for complex reasoning only

2. **Leverage caching:**
   - Use consistent system prompts
   - Cache persists 5-10 minutes
   - Up to 90% savings on repeated content

3. **Use Batch API:**
   - 50% off for non-urgent workloads
   - Process overnight for bulk operations

4. **Optimize prompts:**
   - Be concise but clear
   - Avoid redundant instructions
   - Use structured outputs to reduce retries

### Performance Optimization

1. **Enable streaming** for better UX
2. **Use parallel requests** for independent tasks
3. **Implement proper retry logic** with exponential backoff
4. **Set appropriate timeouts** (30s+ for complex tasks)

### Quality Optimization

1. **Use structured outputs** (`strict: true`) for reliable JSON
2. **Provide clear examples** in system prompts
3. **Use temperature 0** for deterministic outputs
4. **Validate outputs** before using in production

---

## Rate Limits

Limits vary by tier (based on usage history):

| Tier | Requests/min | Tokens/min | Tokens/day |
|------|--------------|------------|------------|
| Free | 3 | 40,000 | 200,000 |
| Tier 1 | 500 | 200,000 | - |
| Tier 2 | 5,000 | 450,000 | - |
| Tier 3+ | Higher | Higher | - |

**Handling Rate Limits:**
- Check `x-ratelimit-*` headers
- Implement exponential backoff
- Use `retry-after` header when available

---

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-your-api-key

# Optional
OPENAI_ORG_ID=org-your-org-id
OPENAI_PROJECT_ID=proj-your-project-id
OPENAI_BASE_URL=https://api.openai.com/v1  # For proxies
```

---

## Additional Resources

- **API Reference:** https://platform.openai.com/docs/api-reference
- **Models:** https://platform.openai.com/docs/models
- **Pricing:** https://openai.com/api/pricing
- **Playground:** https://platform.openai.com/playground
- **Cookbook:** https://cookbook.openai.com
- **Status:** https://status.openai.com
- **Community:** https://community.openai.com
- **Rate Limits:** https://platform.openai.com/docs/guides/rate-limits

---

## Migration Notes

### Assistants API -> Responses API

As of August 2025, the Assistants API is deprecated with sunset in August 2026. Migrate to Responses API:

- Use `store: true` for stateful conversations
- Built-in tools replace custom tool setup
- Instructions replace system messages
- More flexible input handling

### Chat Completions -> Responses API

The Responses API is recommended for new projects:

- Agentic by default
- Better caching (40-80% improvement)
- Native tool orchestration
- Future model support

---

*Last Updated: December 2025*

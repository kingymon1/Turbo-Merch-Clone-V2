# OpenAI GPT Image 1.5 API Documentation

> **Model ID:** `gpt-image-1.5`  
> **Release Date:** December 16, 2025  
> **Base URL:** `https://api.openai.com/v1`

---

## Overview

GPT Image 1.5 is OpenAI's flagship image generation model, offering significant improvements over gpt-image-1:

- **4x faster** generation speeds
- **20% cheaper** pricing
- Superior text rendering (especially dense/small text)
- Precise editing with face, logo, and composition preservation
- Transparent background support
- Better instruction following and prompt adherence

**Ideal for:** T-shirt design automation, print-on-demand, brand asset generation, product catalogs, marketing materials.

---

## Endpoints

### 1. Image Generation

```
POST https://api.openai.com/v1/images/generations
```

Generate images from text prompts or transform existing images.

### 2. Image Editing

```
POST https://api.openai.com/v1/images/edits
```

Modify existing images with mask-based inpainting.

### 3. Responses API (Conversational)

```
POST https://api.openai.com/v1/responses
```

Multi-turn image generation within chat context. 

> **Note:** As of launch, Responses API supports `gpt-image-1` and `gpt-image-1-mini`. Support for `gpt-image-1.5` is in progress.

---

## Authentication

```bash
Authorization: Bearer $OPENAI_API_KEY
Content-Type: application/json
```

**Requirement:** API Organization Verification may be required before accessing GPT Image models.

---

## Generation Endpoint

### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | string | ✅ | - | `"gpt-image-1.5"` |
| `prompt` | string | ✅ | - | Text description of desired image |
| `n` | integer | ❌ | 1 | Number of images (1-10) |
| `size` | string | ❌ | "1024x1024" | Image dimensions |
| `quality` | string | ❌ | "standard" | Output quality level |
| `format` | string | ❌ | "png" | Output file format |
| `background` | string | ❌ | "auto" | Background transparency |
| `compression` | integer | ❌ | 100 | Compression level (0-100) for webp/jpeg |
| `moderation` | string | ❌ | "auto" | Content filtering strictness |
| `stream` | boolean | ❌ | false | Enable streaming response |
| `user` | string | ❌ | - | End-user ID for abuse tracking |

### Size Options

| Value | Dimensions | Aspect Ratio | Use Case |
|-------|------------|--------------|----------|
| `"1024x1024"` | 1024×1024 | 1:1 (Square) | Standard t-shirt prints |
| `"1536x1024"` | 1536×1024 | 3:2 (Landscape) | Wide designs, banners |
| `"1024x1536"` | 1024×1536 | 2:3 (Portrait) | Tall designs, posters |
| `"auto"` | Model decides | Variable | Let AI choose optimal |

### Quality Options

| Value | Description | Cost |
|-------|-------------|------|
| `"standard"` | Good quality, faster generation | Base price |
| `"hd"` | Higher detail, slower generation | ~2x base price |
| `"low"` | Fastest, lower quality | Reduced |
| `"medium"` | Balanced | Between low and standard |
| `"auto"` | Model decides | Variable |

### Format Options

| Value | Transparency | Best For |
|-------|--------------|----------|
| `"png"` | ✅ Supported | Print-on-demand, designs needing transparency |
| `"webp"` | ✅ Supported | Web use, smaller file sizes |
| `"jpeg"` | ❌ No | Photos, where transparency not needed |

### Background Options

| Value | Description |
|-------|-------------|
| `"auto"` | Model decides based on prompt context |
| `"transparent"` | Force transparent background (PNG/WebP only) |
| `"opaque"` | Force solid background |

### Moderation Options

| Value | Description |
|-------|-------------|
| `"auto"` | Standard content filtering (default) |
| `"low"` | Less restrictive filtering |

---

## Edit Endpoint

### Additional Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | file/string | ✅ | Source image (file upload, URL, or base64) |
| `mask` | file/string | ❌ | Mask image for inpainting (transparent areas = edit regions) |
| `input_fidelity` | string | ❌ | `"high"` or `"low"` - controls preservation of input features |

### Input Fidelity

- `"high"`: Maximize preservation of original image features (faces, logos, composition)
- `"low"`: Allow more creative freedom in edits

> **Note:** `input_fidelity` is supported for `gpt-image-1` but may have different behavior in 1.5

---

## Image Input Requirements

| Requirement | Specification |
|-------------|---------------|
| **Formats** | PNG, WebP, JPG |
| **Max File Size** | 50 MB |
| **Dimensions** | No strict limits (auto-resized) |
| **Encoding** | Base64 for inline data |
| **Multiple Images** | Array supported in Responses API |

### Base64 Format

```
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
```

---

## Response Structure

### Successful Response

```json
{
  "created": 1713833628,
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAA...",
      "revised_prompt": "[Model's expanded interpretation of your prompt]"
    }
  ],
  "usage": {
    "total_tokens": 100,
    "input_tokens": 50,
    "output_tokens": 50,
    "input_tokens_details": {
      "text_tokens": 10,
      "image_tokens": 40
    }
  }
}
```

### Response Fields

| Field | Description |
|-------|-------------|
| `data[].b64_json` | Base64-encoded image data |
| `data[].url` | Temporary hosted URL (expires) |
| `data[].revised_prompt` | Model's interpretation of your prompt |
| `usage.input_tokens` | Tokens consumed by prompt/input images |
| `usage.output_tokens` | Tokens for generated images + reasoning |

### Token Estimation

- ~170 tokens per 1024×1024 input image
- Output tokens scale with image size and quality
- Text prompt tokens added separately

---

## Code Examples

### Python - Basic Generation

```python
import base64
from openai import OpenAI

client = OpenAI()

response = client.images.generate(
    model="gpt-image-1.5",
    prompt=your_prompt_variable,  # Pass your generated prompt here
    n=1,
    size="1024x1024",
    quality="hd",
    background="transparent"
)

# Save image
image_bytes = base64.b64decode(response.data[0].b64_json)
with open("design.png", "wb") as f:
    f.write(image_bytes)

print(f"Revised prompt: {response.data[0].revised_prompt}")
print(f"Tokens used: {response.usage.total_tokens}")
```

### Python - Batch Generation

```python
import base64
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def generate_design(prompt: str, index: int):
    response = await client.images.generate(
        model="gpt-image-1.5",
        prompt=prompt,
        n=1,
        size="1024x1024",
        quality="standard",
        background="transparent"
    )
    
    image_bytes = base64.b64decode(response.data[0].b64_json)
    with open(f"design_{index}.png", "wb") as f:
        f.write(image_bytes)
    
    return response

async def batch_generate(prompts: list[str]):
    tasks = [generate_design(prompt, i) for i, prompt in enumerate(prompts)]
    results = await asyncio.gather(*tasks)
    return results

# Usage
prompts = your_prompt_list  # List of prompts from your generation system
asyncio.run(batch_generate(prompts))
```

### Python - Image Editing

```python
import base64
from openai import OpenAI

client = OpenAI()

# Read source image
with open("original_design.png", "rb") as f:
    image_data = base64.b64encode(f.read()).decode()

response = client.images.edit(
    model="gpt-image-1.5",
    image=f"data:image/png;base64,{image_data}",
    prompt=your_edit_instruction,  # e.g., "Change the text to read '[NEW_TEXT]' while keeping the same style"
    size="1024x1024"
)

# Save edited image
edited_bytes = base64.b64decode(response.data[0].b64_json)
with open("edited_design.png", "wb") as f:
    f.write(edited_bytes)
```

### JavaScript/Node.js

```javascript
import OpenAI from "openai";
import { writeFile } from "fs/promises";

const client = new OpenAI();

async function generateDesign(prompt) {
  const response = await client.images.generate({
    model: "gpt-image-1.5",
    prompt: prompt,
    n: 1,
    size: "1024x1024",
    quality: "hd",
    background: "transparent"
  });

  const imageBuffer = Buffer.from(response.data[0].b64_json, "base64");
  await writeFile("design.png", imageBuffer);
  
  return response;
}

// Usage
generateDesign(yourPromptVariable);
```

### cURL - Basic Request

```bash
curl https://api.openai.com/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-image-1.5",
    "prompt": "'"$YOUR_PROMPT"'",
    "n": 1,
    "size": "1024x1024",
    "quality": "standard",
    "background": "transparent"
  }'
```

### cURL - Image Edit with Multiple Inputs

```bash
curl -X POST "https://api.openai.com/v1/images/edits" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "model=gpt-image-1.5" \
  -F "image[]=@input1.png" \
  -F "image[]=@input2.png" \
  -F "image[]=@input3.png" \
  -F "prompt=$YOUR_EDIT_PROMPT"
```

---

## Pricing

### Generation Costs (Estimated)

| Size | Quality | Approximate Cost |
|------|---------|------------------|
| 1024×1024 | Standard | ~$0.04 |
| 1024×1024 | HD | ~$0.08 |
| 1536×1024 | Standard | ~$0.06 |
| 1536×1024 | HD | ~$0.12 |
| 1024×1536 | Standard | ~$0.06 |
| 1024×1536 | HD | ~$0.12 |

> **20% cheaper** than gpt-image-1 for equivalent operations

### Token-Based Billing

- Input: Based on prompt text tokens + image dimension tokens
- Output: Includes generated image tokens + any "reasoning" text tokens

---

## Rate Limits

### By Tier

| Tier | RPM (Requests/Min) | TPM (Tokens/Min) |
|------|-------------------|------------------|
| Free | ~50 | Limited |
| Plus | ~50 | Standard |
| Team | Higher | Higher |
| Enterprise | ~5000+ | Custom |

### Rate Limit Headers

```
x-ratelimit-limit-requests: 50
x-ratelimit-remaining-requests: 49
x-ratelimit-reset-requests: 1.2s
x-ratelimit-limit-tokens: 40000
x-ratelimit-remaining-tokens: 39500
x-ratelimit-reset-tokens: 0.5s
```

---

## Error Handling

### Common Error Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| 400 | Bad Request | Check parameters, prompt format |
| 401 | Unauthorized | Verify API key |
| 403 | Forbidden | Check organization verification, permissions |
| 429 | Rate Limited | Implement exponential backoff |
| 500 | Server Error | Retry with backoff |

### Error Response Format

```json
{
  "error": {
    "message": "Rate limit exceeded",
    "type": "rate_limit_error",
    "param": null,
    "code": "rate_limit_exceeded"
  }
}
```

### Retry Strategy

```python
import time
from openai import OpenAI, RateLimitError

client = OpenAI()

def generate_with_retry(prompt, max_retries=5):
    for attempt in range(max_retries):
        try:
            return client.images.generate(
                model="gpt-image-1.5",
                prompt=prompt,
                n=1,
                size="1024x1024"
            )
        except RateLimitError:
            wait_time = 2 ** attempt  # Exponential backoff
            print(f"Rate limited. Waiting {wait_time}s...")
            time.sleep(wait_time)
    raise Exception("Max retries exceeded")
```

---

## Safety & Moderation

### Content Filtering

- Automatic NSFW/harmful content detection
- `moderation` parameter controls strictness
- C2PA metadata embedded for provenance tracking

### Organization Verification

Required for GPT Image models. Complete via OpenAI Developer Console.

---

## Best Practices for T-Shirt Designs

### Prompt Engineering

```python
# ✅ GOOD: Specific, detailed prompt structure
prompt = f"""
T-shirt design, {style_descriptor}:
- {text_element_if_any}
- {main_visual_element}
- Limited color palette (3-4 colors max)
- Transparent background
- Print-ready, high contrast
- No small details that won't print well
"""

# ❌ BAD: Vague prompt
prompt = "cool design"
```

### Text Rendering Tips

1. **Put text in quotes**: `"YOUR TEXT HERE"` helps ensure accurate rendering
2. **Specify typography**: Describe font style (bold, script, blocky, etc.)
3. **Keep text simple**: Fewer words = better accuracy
4. **Request high contrast**: Ensures readability on fabric

### Consistency Across Designs

```python
# Use consistent style descriptors via variables
style_prefix = f"""
T-shirt design, {your_style_system_descriptor},
limited color palette, {your_aesthetic_parameters},
transparent background, print-ready:
"""

# Apply to each design in a series
prompt = f"{style_prefix} {specific_design_description}"
```

### Editing Workflow

1. Generate base design
2. Use edit endpoint for refinements
3. Set `input_fidelity: "high"` to preserve key elements
4. Make one change at a time for best results

### What to Avoid

- Extremely complex scenes with many elements
- Very small text (won't print well anyway)
- Photorealistic requests (use for graphic/illustration styles)
- Hands and fine anatomy details (known weakness)

---

## Model Comparison

| Feature | gpt-image-1.5 | gpt-image-1 | gpt-image-1-mini |
|---------|---------------|-------------|------------------|
| Speed | 4x faster | Baseline | Fast |
| Quality | Best | High | Good |
| Price | 20% cheaper | Baseline | Cheapest |
| Text Rendering | Excellent | Good | Basic |
| Edit Precision | Best | Good | Limited |
| Recommended For | Production | General | Prototyping |

### Migration from DALL-E

```python
# Old DALL-E 3 code
response = client.images.generate(
    model="dall-e-3",
    prompt=your_prompt,
    size="1024x1024"
)

# New GPT Image 1.5 code
response = client.images.generate(
    model="gpt-image-1.5",  # Just change the model
    prompt=your_prompt,
    size="1024x1024",
    background="transparent"  # New option!
)
```

> **Note:** DALL-E 2 and DALL-E 3 endpoints deprecated, support ends May 12, 2026.

---

## Known Limitations

1. **Complex anatomy**: Hands, fingers sometimes malformed
2. **Scientific accuracy**: May struggle with technical diagrams
3. **Certain art styles**: Limited support for some specific drawing styles
4. **Responses API**: Not yet supported (only gpt-image-1 and mini)
5. **Rollout limits**: Initial access may have stricter rate limits

---

## Changelog

### December 16, 2025 - Initial Release
- GPT Image 1.5 released
- 4x speed improvement
- 20% cost reduction
- Enhanced text rendering
- Improved edit precision
- New dedicated Images UI in ChatGPT

---

## Resources

- **Official Docs**: https://platform.openai.com/docs/guides/image-generation
- **API Reference**: https://platform.openai.com/docs/api-reference/images
- **Prompt Guide**: https://platform.openai.com/docs/guides/image-generation (prompt guide section)
- **Playground**: https://platform.openai.com/playground
- **Model Gallery**: https://openai.com/index/new-chatgpt-images-is-here/

---

*Documentation compiled for TurboMerch integration - December 2025*

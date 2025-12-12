# Ideogram API Documentation

## Overview

Ideogram is an AI image generation API with best-in-class **text rendering in images**, photorealistic output, and diverse artistic styles. The API supports:

- **Text-to-Image Generation** - Create images from text prompts
- **Remix** - Transform existing images with new prompts while preserving structure
- **Edit (Inpainting)** - Modify specific regions of an image using masks
- **Reframe (Outpainting)** - Extend images to new aspect ratios/resolutions
- **Replace Background** - Swap backgrounds while preserving subjects
- **Upscale** - Enhance image resolution with AI
- **Describe** - Generate text descriptions from images

### Key Strengths
- **Superior text/typography rendering** - Best-in-class for logos, posters, signs
- **Photorealism** - High-fidelity realistic images
- **Style consistency** - Style codes and style reference images
- **Character consistency** - Maintain character identity across generations

---

## Authentication

### API Key Setup
1. Create account at https://ideogram.ai
2. Navigate to Settings → "API Beta" or https://ideogram.ai/manage-api
3. Click "Create API key"
4. Store key securely (shown only once)
5. Initial funding required (~$10 minimum)

### Using the API Key
Include in request headers:
```
Api-Key: your_api_key_here
```

**⚠️ CRITICAL**: Image URLs returned by the API **expire**. Always download and store images you want to keep.

---

## Base URL & Headers

```
Base URL: https://api.ideogram.ai
```

### Required Headers
```
Api-Key: YOUR_API_KEY
Content-Type: multipart/form-data
```

### Environment Variable
```bash
IDEOGRAM_API_KEY=your_api_key_here
```

---

## V3 Endpoints (Current)

### 1. Generate with Ideogram 3.0
**POST** `/v1/ideogram-v3/generate`

Generate images from text prompts using the latest Ideogram 3.0 model.

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | ✅ Yes | Text description of desired image |
| `num_images` | integer | No | 1-8 images (default: 1) |
| `seed` | integer | No | 0-2147483647 for reproducible generation |
| `resolution` | enum | No | Specific resolution (see Resolution Values) |
| `aspect_ratio` | enum | No | Aspect ratio (cannot use with resolution) |
| `rendering_speed` | enum | No | FLASH, TURBO, DEFAULT, QUALITY |
| `magic_prompt` | enum | No | AUTO, ON, OFF |
| `negative_prompt` | string | No | What to exclude from the image |
| `style_type` | enum | No | AUTO, GENERAL, REALISTIC, DESIGN, FICTION |
| `style_preset` | enum | No | Predefined artistic style (62 options) |
| `style_codes` | string[] | No | 8-char hex codes for custom styles |
| `style_reference_images` | files | No | Up to 3 images as style reference (max 10MB total) |
| `character_reference_images` | files | No | Character reference image (max 1, 10MB) |
| `character_reference_images_mask` | files | No | Optional mask for character reference |
| `color_palette` | object | No | Preset name or hex color array |

#### cURL Example
```bash
curl -X POST https://api.ideogram.ai/v1/ideogram-v3/generate \
  -H "Api-Key: YOUR_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F 'prompt=A vintage coffee shop sign with ornate lettering saying "BREW & BEAN" with steam rising from a coffee cup' \
  -F "rendering_speed=DEFAULT" \
  -F "aspect_ratio=ASPECT_16_9" \
  -F "style_type=DESIGN" \
  -F "num_images=1"
```

---

### 2. Generate with Transparent Background
**POST** `/v1/ideogram-v3/generate-transparent`

Same as generate but outputs PNG with transparent background. Ideal for logos, stickers, product images, **t-shirt designs**.

---

### 3. Remix with Ideogram 3.0
**POST** `/v1/ideogram-v3/remix`

Transform an existing image based on a new prompt while maintaining structural elements.

#### Additional Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | file | ✅ Yes | Source image to remix (max 10MB) |
| `image_weight` | integer | No | 1-100, controls influence of original (default: 50) |

#### cURL Example
```bash
curl -X POST https://api.ideogram.ai/v1/ideogram-v3/remix \
  -H "Api-Key: YOUR_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F "image=@/path/to/source.jpg" \
  -F 'prompt=Transform this into a watercolor painting style' \
  -F "image_weight=60" \
  -F "rendering_speed=DEFAULT"
```

**Note**: Input images are cropped to the chosen aspect ratio before remixing.

---

### 4. Edit with Ideogram 3.0 (Inpainting)
**POST** `/v1/ideogram-v3/edit`

Modify specific regions of an image using a mask. Non-masked areas remain unchanged.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | file | ✅ Yes | Image to edit (max 10MB) |
| `mask` | file | ✅ Yes | B&W mask same size as image (max 10MB) |
| `prompt` | string | ✅ Yes | Description of desired edit result |

#### Mask Specification
- **Black regions** = Areas to be edited/regenerated
- **White regions** = Areas to preserve unchanged
- Must be same dimensions as source image
- Formats: JPEG, PNG, WebP

#### cURL Example
```bash
curl -X POST https://api.ideogram.ai/v1/ideogram-v3/edit \
  -H "Api-Key: YOUR_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F "image=@/path/to/image.jpg" \
  -F "mask=@/path/to/mask.png" \
  -F 'prompt=A red sports car' \
  -F "rendering_speed=DEFAULT"
```

---

### 5. Reframe with Ideogram 3.0 (Outpainting)
**POST** `/v1/ideogram-v3/reframe`

Extend a square image to a new resolution/aspect ratio through intelligent outpainting.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | file | ✅ Yes | Square image to reframe (max 10MB) |
| `resolution` | enum | ✅ Yes | Target resolution |

**Note**: Input should be square for best results.

---

### 6. Replace Background with Ideogram 3.0
**POST** `/v1/ideogram-v3/replace-background`

Replace the background of an image while preserving the main subject.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | file | ✅ Yes | Image with subject (max 10MB) |
| `prompt` | string | ✅ Yes | Description of new background |

---

### 7. Upscale
**POST** `/upscale`

Enhance image resolution with AI-powered upscaling.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_file` | file | ✅ Yes | Image to upscale (max 10MB) |
| `image_request.resemblance` | integer | No | 1-100, how closely to match original |
| `image_request.detail` | integer | No | 1-100, amount of detail to add |
| `image_request.prompt` | string | No | Optional prompt to guide upscaling |

#### cURL Example
```bash
curl -X POST https://api.ideogram.ai/upscale \
  -H "Api-Key: YOUR_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F "image_file=@/path/to/image.jpg" \
  -F 'image_request={"resemblance": 55, "detail": 90}'
```

---

### 8. Describe
**POST** `/describe`

Generate text descriptions from images (reverse image-to-text).

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_file` | file | ✅ Yes | Image to describe (max 10MB) |
| `describe_model_version` | enum | No | V_2, V_3 (default: V_3) |

---

## Parameter Reference

### Aspect Ratios
Use with `aspect_ratio` parameter (cannot combine with `resolution`):

```
ASPECT_1_1      (Square - 1:1)
ASPECT_16_9     (Widescreen landscape)
ASPECT_9_16     (Vertical/portrait)
ASPECT_4_3      (Standard landscape)
ASPECT_3_4      (Standard portrait)
ASPECT_3_2      (Photo landscape)
ASPECT_2_3      (Photo portrait)
ASPECT_16_10    (Wide landscape)
ASPECT_10_16    (Wide portrait)
ASPECT_3_1      (Ultra-wide panoramic)
ASPECT_1_3      (Ultra-tall vertical)
ASPECT_4_5      (Social media portrait)
ASPECT_5_4      (Social media landscape)
ASPECT_21_9     (Cinematic ultra-wide)
ASPECT_9_21     (Cinematic ultra-tall)
```

### Resolutions (V3)
The API supports 69 specific resolutions. Common ones include:

```
RESOLUTION_512_512
RESOLUTION_640_640
RESOLUTION_768_768
RESOLUTION_832_832
RESOLUTION_1024_1024
RESOLUTION_1280_720    (720p landscape)
RESOLUTION_720_1280    (720p portrait)
RESOLUTION_1280_800
RESOLUTION_800_1280
RESOLUTION_1536_640    (Ultra-wide)
RESOLUTION_640_1536    (Ultra-tall)
RESOLUTION_1024_768
RESOLUTION_768_1024
RESOLUTION_1152_896
RESOLUTION_896_1152
RESOLUTION_1216_704
RESOLUTION_704_1216
```

### Rendering Speed

| Speed | Description | Cost |
|-------|-------------|------|
| `FLASH` | Fastest, lower quality | ~$0.02/image |
| `TURBO` | Fast generation | $0.03/image |
| `DEFAULT` | Balanced (recommended) | $0.06/image |
| `QUALITY` | Highest quality, slowest | $0.09/image |

### Magic Prompt
```
AUTO  - Let AI decide whether to enhance prompt
ON    - Always enhance prompt with AI suggestions
OFF   - Use prompt exactly as provided
```

### Style Types
```
AUTO      - AI selects appropriate style
GENERAL   - Flexible, works for most prompts
REALISTIC - Photorealistic output
DESIGN    - Graphic design (logos, posters, t-shirts)
FICTION   - Creative/artistic interpretation
```

### Style Presets (62 Options)
```
80S_ILLUSTRATION    90S_NOSTALGIA       ABSTRACT_ORGANIC
ANALOG_NOSTALGIA    ART_BRUT            ART_DECO
ART_POSTER          AURA                AVANT_GARDE
BAUHAUS             BLUEPRINT           BLURRY_MOTION
BRIGHT_ART          C4D_CARTOON         CHILDRENS_BOOK
COLLAGE             COLORING_BOOK_I     COLORING_BOOK_II
CUBISM              DARK_AURA           DOODLE
DOUBLE_EXPOSURE     DRAMATIC_CINEMA     EDITORIAL
EMOTIONAL_MINIMAL   ETHEREAL_PARTY      EXPIRED_FILM
FLAT_ART            FLAT_VECTOR         FOREST_REVERIE
GEO_MINIMALIST      GLASS_PRISM         GOLDEN_HOUR
GRAFFITI_I          GRAFFITI_II         HALFTONE_PRINT
HIGH_CONTRAST       HIPPIE_ERA          ICONIC
JAPANDI_FUSION      JAZZY               LONG_EXPOSURE
MAGAZINE_EDITORIAL  MINIMAL_ILLUSTRATION MIXED_MEDIA
MONOCHROME          NIGHTLIFE           OIL_PAINTING
OLD_CARTOONS        PAINT_GESTURE       POP_ART
RETRO_ETCHING       RIVIERA_POP         SPOTLIGHT_80S
STYLIZED_RED        SURREAL_COLLAGE     TRAVEL_POSTER
VINTAGE_GEO         VINTAGE_POSTER      WATERCOLOR
WEIRD               WOODBLOCK_PRINT
```

### Color Palette Presets
```
EMBER        FRESH        JUNGLE       MAGIC
MELON        MOSSY        PASTEL       ULTRAMARINE
```

Or specify custom colors:
```json
{
  "color_palette": {
    "members": [
      {"color_hex": "#FF5733", "color_weight": 0.4},
      {"color_hex": "#33FF57", "color_weight": 0.3},
      {"color_hex": "#3357FF", "color_weight": 0.3}
    ]
  }
}
```

---

## TypeScript Implementation

```typescript
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

const IDEOGRAM_API_KEY = process.env.IDEOGRAM_API_KEY;

interface IdeogramResponse {
  created: string;
  data: Array<{
    prompt: string;
    resolution: string;
    is_image_safe: boolean;
    seed: number;
    url: string;
    style_type: string;
  }>;
}

async function generateImage(prompt: string, options?: {
  aspectRatio?: string;
  renderingSpeed?: 'FLASH' | 'TURBO' | 'DEFAULT' | 'QUALITY';
  styleType?: 'AUTO' | 'GENERAL' | 'REALISTIC' | 'DESIGN' | 'FICTION';
  stylePreset?: string;
  negativePrompt?: string;
  numImages?: number;
  seed?: number;
  magicPrompt?: 'AUTO' | 'ON' | 'OFF';
}): Promise<IdeogramResponse> {
  const form = new FormData();

  form.append('prompt', prompt);

  if (options?.aspectRatio) form.append('aspect_ratio', options.aspectRatio);
  if (options?.renderingSpeed) form.append('rendering_speed', options.renderingSpeed);
  if (options?.styleType) form.append('style_type', options.styleType);
  if (options?.stylePreset) form.append('style_preset', options.stylePreset);
  if (options?.negativePrompt) form.append('negative_prompt', options.negativePrompt);
  if (options?.numImages) form.append('num_images', options.numImages.toString());
  if (options?.seed) form.append('seed', options.seed.toString());
  if (options?.magicPrompt) form.append('magic_prompt', options.magicPrompt);

  const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
    method: 'POST',
    headers: {
      'Api-Key': IDEOGRAM_API_KEY!,
    },
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ideogram API error: ${response.status} - ${error}`);
  }

  return response.json() as Promise<IdeogramResponse>;
}

// Generate with transparent background (ideal for t-shirts)
async function generateTransparent(prompt: string, options?: {
  aspectRatio?: string;
  renderingSpeed?: 'FLASH' | 'TURBO' | 'DEFAULT' | 'QUALITY';
  styleType?: 'AUTO' | 'GENERAL' | 'REALISTIC' | 'DESIGN' | 'FICTION';
  negativePrompt?: string;
}): Promise<IdeogramResponse> {
  const form = new FormData();

  form.append('prompt', prompt);
  form.append('magic_prompt', 'OFF'); // Use exact prompt for t-shirt text

  if (options?.aspectRatio) form.append('aspect_ratio', options.aspectRatio);
  if (options?.renderingSpeed) form.append('rendering_speed', options.renderingSpeed);
  if (options?.styleType) form.append('style_type', options.styleType);
  if (options?.negativePrompt) form.append('negative_prompt', options.negativePrompt);

  const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate-transparent', {
    method: 'POST',
    headers: {
      'Api-Key': IDEOGRAM_API_KEY!,
    },
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ideogram API error: ${response.status} - ${error}`);
  }

  return response.json() as Promise<IdeogramResponse>;
}

// Download and save image (IMPORTANT: URLs expire!)
async function downloadImage(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  const buffer = await response.buffer();
  fs.writeFileSync(outputPath, buffer);
}

// Remix an existing image
async function remixImage(
  imagePath: string,
  prompt: string,
  imageWeight: number = 50
): Promise<IdeogramResponse> {
  const form = new FormData();

  form.append('image', fs.createReadStream(imagePath));
  form.append('prompt', prompt);
  form.append('image_weight', imageWeight.toString());
  form.append('rendering_speed', 'DEFAULT');

  const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/remix', {
    method: 'POST',
    headers: {
      'Api-Key': IDEOGRAM_API_KEY!,
    },
    body: form,
  });

  return response.json() as Promise<IdeogramResponse>;
}

// Edit with mask (inpainting)
async function editImage(
  imagePath: string,
  maskPath: string,
  prompt: string
): Promise<IdeogramResponse> {
  const form = new FormData();

  form.append('image', fs.createReadStream(imagePath));
  form.append('mask', fs.createReadStream(maskPath));
  form.append('prompt', prompt);
  form.append('rendering_speed', 'DEFAULT');

  const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/edit', {
    method: 'POST',
    headers: {
      'Api-Key': IDEOGRAM_API_KEY!,
    },
    body: form,
  });

  return response.json() as Promise<IdeogramResponse>;
}

// Upscale image
async function upscaleImage(
  imagePath: string,
  resemblance: number = 55,
  detail: number = 90
): Promise<IdeogramResponse> {
  const form = new FormData();

  form.append('image_file', fs.createReadStream(imagePath));
  form.append('image_request', JSON.stringify({ resemblance, detail }));

  const response = await fetch('https://api.ideogram.ai/upscale', {
    method: 'POST',
    headers: {
      'Api-Key': IDEOGRAM_API_KEY!,
    },
    body: form,
  });

  return response.json() as Promise<IdeogramResponse>;
}

// Usage example for t-shirt design
async function generateTShirtDesign(
  text: string,
  style: string,
  options?: {
    negativePrompt?: string;
  }
): Promise<string> {
  const result = await generateTransparent(
    `T-shirt graphic design with text "${text}". ${style}. Professional commercial quality, centered composition.`,
    {
      aspectRatio: 'ASPECT_1_1',
      renderingSpeed: 'DEFAULT',
      styleType: 'DESIGN',
      negativePrompt: options?.negativePrompt || 'blurry, low quality, amateur, clipart, watermark',
    }
  );

  // ALWAYS download immediately - URLs expire!
  const outputPath = `./design_${result.data[0].seed}.png`;
  await downloadImage(result.data[0].url, outputPath);

  return outputPath;
}
```

---

## Best Practices

### Prompting Tips

1. **Be Specific**: Include subject, environment, mood, lighting, and focal details
   ```
   Good: "A modern minimalist workspace with wooden desk, soft afternoon light, potted succulents, and MacBook Pro, shot from a 45-degree angle"
   Bad: "A desk with a computer"
   ```

2. **Text in Images**: Ideogram excels at text - use quotes for exact text
   ```
   "A vintage coffee shop sign with ornate lettering saying 'BREW & BEAN'"
   ```

3. **Use Negative Prompts**: Exclude unwanted elements
   ```
   negative_prompt: "blurry, low quality, watermark, text artifacts, amateur, clipart"
   ```

4. **Magic Prompt Strategy**:
   - `ON` - For complex scenes, let AI enhance
   - `OFF` - For precise control, logos, specific text (recommended for t-shirts)
   - `AUTO` - Let system decide

5. **Style Consistency**: Use `style_codes` or `style_reference_images` for brand consistency

### T-Shirt Design Recommendations

1. **Use DESIGN style type** - Optimized for graphic design output
2. **Use generate-transparent endpoint** - Direct transparent background support
3. **Set magic_prompt to OFF** - Preserve exact text without AI changes
4. **Use ASPECT_1_1 or ASPECT_4_5** - Good for chest print areas
5. **Include quality floor in negative prompt** - "amateur, clipart, basic, low quality"

### Performance Optimization

1. **Rendering Speed Selection**:
   - `TURBO` - Drafts, iterations, testing ($0.03/image)
   - `DEFAULT` - Production work ($0.06/image)
   - `QUALITY` - Final outputs, high detail ($0.09/image)

2. **Batch Efficiently**: Generate multiple images per request (up to 8)

3. **Use Seeds**: Set seed for reproducible results and variations

4. **Resolution Strategy**:
   - Start with lower resolution for iterations
   - Use upscale for final high-res output

### Critical Reminders

⚠️ **IMAGE URLs EXPIRE** - Always download images immediately after generation

⚠️ **File Size Limits** - Max 10MB per image file

⚠️ **Supported Formats** - JPEG, PNG, WebP only

⚠️ **Rate Limits** - Default 10 concurrent requests

---

## Pricing

### Ideogram 3.0 API Pricing (per image)

| Speed | Cost |
|-------|------|
| FLASH | ~$0.02 |
| TURBO | $0.03 |
| DEFAULT | $0.06 |
| QUALITY | $0.09 |

### Additional Costs
- **Upscale**: Additional cost per upscale
- **Character Reference**: Additional pricing applies
- **Volume Discounts**: Available for annual commitments

### Billing
- Prepaid credit balance
- Auto top-up when balance drops below threshold
- Default: top-up at $10, refill to $40

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid API key |
| 403 | Forbidden - Access denied |
| 422 | Unprocessable Entity - Valid format but cannot process |
| 429 | Too Many Requests - Rate limited |

### Error Response Structure
```json
{
  "error": "Invalid prompt parameter",
  "details": "Prompt cannot be empty"
}
```

### Retry Logic Example
```typescript
async function safeGenerate(prompt: string, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await generateImage(prompt);

      // Immediately download - URLs expire!
      for (const image of result.data) {
        if (image.is_image_safe) {
          await downloadImage(image.url, `./output_${image.seed}.png`);
        }
      }

      return result;
    } catch (error) {
      if (error.message.includes('429')) {
        // Rate limited - exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Response Structure

### Successful Generation Response
```json
{
  "created": "2024-01-15T10:30:00+00:00",
  "data": [
    {
      "prompt": "A vintage neon sign...",
      "resolution": "1280x720",
      "is_image_safe": true,
      "seed": 12345,
      "url": "https://ideogram.ai/api/images/ephemeral/xxx.png?exp=...",
      "style_type": "REALISTIC"
    }
  ]
}
```

### Credit Tracking
Monitor `x-remaining-credits` header in responses to track balance.

---

## Quick Reference

```
GENERATE:           POST /v1/ideogram-v3/generate
GENERATE TRANSPARENT: POST /v1/ideogram-v3/generate-transparent
REMIX:              POST /v1/ideogram-v3/remix
EDIT:               POST /v1/ideogram-v3/edit
REFRAME:            POST /v1/ideogram-v3/reframe
REPLACE BG:         POST /v1/ideogram-v3/replace-background
UPSCALE:            POST /upscale
DESCRIBE:           POST /describe

Header: Api-Key: YOUR_KEY
Format: multipart/form-data
Max file: 10MB
Formats: JPEG, PNG, WebP

Speeds: FLASH < TURBO < DEFAULT < QUALITY
Styles: AUTO | GENERAL | REALISTIC | DESIGN | FICTION

⚠️ DOWNLOAD IMAGES IMMEDIATELY - URLs EXPIRE!
```

---

## Resources

- **API Docs**: https://developer.ideogram.ai
- **API Status**: https://status.ideogram.ai
- **Manage API Keys**: https://ideogram.ai/manage-api
- **Pricing**: https://ideogram.ai/features/api-pricing

---

*Last Updated: December 2025*

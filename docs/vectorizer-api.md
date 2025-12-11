# Vectorizer.AI API Documentation

## Overview

Vectorizer.AI provides a powerful bitmap-to-vector image conversion API that uses AI and deep learning to trace pixels to vectors with best-in-class fidelity. The service converts raster images (PNG, JPG, GIF, BMP, TIFF) to scalable vector formats (SVG, PDF, EPS, DXF) fully automatically.

**Key Features:**
- AI-powered deep learning vector engine (15+ years of development)
- Full-color vectorization with shape detection
- Multiple output formats (SVG, PDF, EPS, DXF, PNG)
- Customizable output options (curves, colors, grouping, size)
- Preview mode for customer approval workflows
- Image token system for multi-format downloads
- No subscription required for testing/integration

**Use Cases for Amazon Merch:**
- Convert AI-generated designs to print-ready vectors
- Upscale and vectorize low-resolution design concepts
- Convert bitmap logos to scalable SVG for various product sizes
- Prepare designs for vinyl cutting, embroidery, or screen printing

---

## Authentication

### HTTP Basic Authentication

All API requests require HTTP Basic Auth over HTTPS.

```
Username: Your API ID
Password: Your API Secret
```

**Headers:**
```
Authorization: Basic {base64(api_id:api_secret)}
```

**Get API Credentials:**
1. Create an account at https://vectorizer.ai
2. Navigate to your account page
3. Generate an API key

**Environment Variable:**
```bash
export VECTORIZER_API_ID="your-api-id"
export VECTORIZER_API_SECRET="your-api-secret"
```

---

## Base URL

```
https://api.vectorizer.ai/api/v1
```

---

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/vectorize` | POST | Convert bitmap image to vector |
| `/download` | POST | Download additional formats or upgrade preview |
| `/delete` | POST | Delete stored image before retention expires |
| `/account` | GET | Get account status and credits |

---

## Pricing

### Credit System

| Action | Credits | Description |
|--------|---------|-------------|
| Testing | 0.000 | Free with `mode=test` or `mode=test_preview` |
| Preview | 0.200 | Watermarked 4x PNG preview for customer approval |
| Vectorize | 1.000 | Full production vectorization |
| Upgrade Preview | 0.900 | Download production result after preview |
| Download Format | 0.100 | Additional format of same vectorization |
| Storage Day | 0.010 | Per-day storage beyond first free day |

### Subscription Plans (Monthly)

| Credits/Month | Price/Month | Price/Credit |
|---------------|-------------|--------------|
| 50 | $9.99 | $0.200 |
| 100 | $18.99 | $0.190 |
| 200 | $34.99 | $0.175 |
| 500 | $74.99 | $0.150 |
| 1,000 | $139.99 | $0.140 |
| 2,000 | $249.99 | $0.125 |
| 5,000 | $549.99 | $0.110 |
| 10,000 | $949.99 | $0.095 |
| 15,000 | $1,299.99 | $0.087 |
| 20,000 | $1,629.99 | $0.081 |
| 25,000 | $1,929.99 | $0.077 |
| 50,000 | $3,179.99 | $0.064 |
| 75,000 | $4,169.99 | $0.056 |
| 100,000 | $4,999.99 | $0.050 |

**Notes:**
- Unused credits roll over (up to 5x monthly allocation)
- Cancel anytime
- Web App only plan: $9.99/month (unlimited, no API access)
- Free testing with watermarks (no subscription required)

---

## Vectorize Endpoint

**POST** `https://api.vectorizer.ai/api/v1/vectorize`

**Content-Type:** `multipart/form-data`

### Input Parameters

#### Image Input (one required)

| Parameter | Type | Description |
|-----------|------|-------------|
| `image` | Binary | Binary file upload (.bmp, .gif, .jpeg, .png, .tiff) |
| `image.base64` | String | Base64-encoded image (max 1MB string) |
| `image.url` | String | URL to fetch and process |
| `image.token` | String | Image Token from previous call with `policy.retention_days > 0` |

**Maximum image size:** 33,554,432 pixels (width x height)

#### Processing Mode

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mode` | Enum | `production` | Processing mode |

**Mode Values:**

| Mode | Credits | Description |
|------|---------|-------------|
| `production` | 1.000 | Full production quality |
| `preview` | 0.200 | 4x PNG with watermark for customer preview |
| `test` | Free | Watermarked for development/testing |
| `test_preview` | Free | Watermarked preview for testing |

#### Input Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `input.max_pixels` | Integer | 2097252 | Max input size (100-3145828 pixels) |
| `policy.retention_days` | Integer | 0 | Days to store image (0-30), enables X-Image-Token |

#### Processing Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `processing.max_colors` | Integer | 0 | Max colors (0=unlimited, 1-256) |
| `processing.palette` | String | (empty) | Color palette with snapping/remapping |
| `processing.shapes.min_area_px` | Float | 0.125 | Min shape area in pixels (0.0-100.0) |

**Palette Format:**
```
#RRGGBB;                    // Snap to color
#RRGGBB ~ 0.1;              // Snap within tolerance
#FF0000 -> #00FF00;         // Remap red to green
#FF0000 -> #00FF00 ~ 0.02;  // Remap with tolerance
#00000000;                  // Transparent (removes matched colors)
```

#### Output Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `output.file_format` | Enum | `svg` | Output format: svg, eps, pdf, dxf, png |
| `output.draw_style` | Enum | `fill_shapes` | fill_shapes, stroke_shapes, stroke_edges |
| `output.shape_stacking` | Enum | `cutouts` | cutouts or stacked |
| `output.group_by` | Enum | `none` | none, color, parent, layer |
| `output.parameterized_shapes.flatten` | Boolean | false | Flatten circles, ellipses, etc. to curves |

#### SVG Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `output.svg.version` | Enum | `svg_1_1` | svg_1_0, svg_1_1, svg_tiny_1_2 |
| `output.svg.fixed_size` | Boolean | false | Include size attributes |
| `output.svg.adobe_compatibility_mode` | Boolean | false | Disable unsupported Adobe features |

#### DXF Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `output.dxf.compatibility_level` | Enum | `lines_and_arcs` | lines_only, lines_and_arcs, lines_arcs_and_splines |

#### Bitmap Options (PNG output)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `output.bitmap.anti_aliasing_mode` | Enum | `anti_aliased` | anti_aliased or aliased |

#### Curve Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `output.curves.allowed.quadratic_bezier` | Boolean | true | Allow quadratic Bezier |
| `output.curves.allowed.cubic_bezier` | Boolean | true | Allow cubic Bezier |
| `output.curves.allowed.circular_arc` | Boolean | true | Allow circular arcs |
| `output.curves.allowed.elliptical_arc` | Boolean | true | Allow elliptical arcs |
| `output.curves.line_fit_tolerance` | Float | 0.1 | Line approximation tolerance (0.001-1.0) |

#### Gap Filler Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `output.gap_filler.enabled` | Boolean | true | Fix white line rendering bugs |
| `output.gap_filler.clip` | Boolean | false | Clip gap filler strokes |
| `output.gap_filler.non_scaling_stroke` | Boolean | true | Use non-scaling strokes |
| `output.gap_filler.stroke_width` | Float | 2.0 | Stroke width (0.0-5.0) |

#### Stroke Options (for stroke_shapes/stroke_edges)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `output.strokes.non_scaling_stroke` | Boolean | true | Non-scaling stroke |
| `output.strokes.use_override_color` | Boolean | false | Use override instead of shape color |
| `output.strokes.override_color` | String | #000000 | Override color (#RRGGBB) |
| `output.strokes.stroke_width` | Float | 1.0 | Stroke width (0.0-5.0) |

#### Output Size Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `output.size.scale` | Float | - | Uniform scale factor (0.0-1000.0) |
| `output.size.width` | Float | - | Width in specified units |
| `output.size.height` | Float | - | Height in specified units |
| `output.size.unit` | Enum | `none` | none, px, pt, in, cm, mm |
| `output.size.aspect_ratio` | Enum | `preserve_inset` | preserve_inset, preserve_overflow, stretch |
| `output.size.align_x` | Float | 0.5 | Horizontal alignment (0.0-1.0) |
| `output.size.align_y` | Float | 0.5 | Vertical alignment (0.0-1.0) |
| `output.size.input_dpi` | Float | - | Override input DPI (1.0-1000000.0) |
| `output.size.output_dpi` | Float | - | Output DPI for bitmap (1.0-1000000.0) |

### Response

**Success (200):** Binary file in requested format

**Response Headers:**

| Header | Description |
|--------|-------------|
| `X-Image-Token` | Token for download/re-vectorize (when `policy.retention_days > 0`) |
| `X-Credits-Charged` | Credits charged for this request |
| `X-Credits-Calculated` | Would-be credits (test mode only) |

---

## Download Endpoint

**POST** `https://api.vectorizer.ai/api/v1/download`

Download additional formats or upgrade preview to production.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `image.token` | String | Image Token from previous vectorization |
| `receipt` | String | Receipt from preview upgrade (for reduced rate) |
| `output.*` | Various | Same output options as Vectorize endpoint |

### Response Headers

| Header | Description |
|--------|-------------|
| `X-Receipt` | Receipt for downloading additional formats at reduced rate |
| `X-Credits-Charged` | Credits charged |

---

## Delete Endpoint

**POST** `https://api.vectorizer.ai/api/v1/delete`

Delete stored image before retention period expires.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `image.token` | String | Image Token to delete |

### Response

```json
{
  "success": true
}
```

---

## Account Status Endpoint

**GET** `https://api.vectorizer.ai/api/v1/account`

### Response

```json
{
  "subscriptionPlan": "api_500",
  "subscriptionState": "active",
  "credits": 423.5
}
```

| Field | Description |
|-------|-------------|
| `subscriptionPlan` | Current plan or "none" |
| `subscriptionState` | "active", "pastDue", or "ended" |
| `credits` | Remaining API credits (decimal) |

---

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad request (check parameters) |
| 401 | Unauthorized (check credentials) |
| 402 | Payment required (out of credits) |
| 429 | Rate limited (apply backoff) |
| 500-599 | Server error (retry) |

---

## Error Response Format

```json
{
  "error": {
    "status": 400,
    "code": 1006,
    "message": "Failed to read the supplied image."
  }
}
```

---

## Rate Limiting

- Generous allowances with no hard upper limit
- For batch jobs: start with 5 threads, add 1 every 5 minutes
- Max recommended: 100 concurrent threads (contact for more)
- On 429 response: apply linear backoff (5s, 10s, 15s, etc.)
- Reset backoff counter after successful request
- Apply backoff per-thread independently

---

## Timeouts

Configure your HTTP client with at least **180 seconds** idle timeout.

---

## TypeScript/JavaScript Implementation

### Installation

```bash
npm install axios form-data
```

### Basic Vectorization

```typescript
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';

interface VectorizerConfig {
  apiId: string;
  apiSecret: string;
}

interface VectorizeOptions {
  mode?: 'production' | 'preview' | 'test' | 'test_preview';
  outputFormat?: 'svg' | 'eps' | 'pdf' | 'dxf' | 'png';
  maxColors?: number;
  retentionDays?: number;
}

interface VectorizeResult {
  data: Buffer;
  imageToken?: string;
  creditsCharged: number;
}

class VectorizerClient {
  private apiId: string;
  private apiSecret: string;
  private baseUrl = 'https://api.vectorizer.ai/api/v1';

  constructor(config: VectorizerConfig) {
    this.apiId = config.apiId;
    this.apiSecret = config.apiSecret;
  }

  private getAuth() {
    return {
      username: this.apiId,
      password: this.apiSecret,
    };
  }

  async vectorizeFile(
    imagePath: string,
    options: VectorizeOptions = {}
  ): Promise<VectorizeResult> {
    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath));

    if (options.mode) form.append('mode', options.mode);
    if (options.outputFormat) form.append('output.file_format', options.outputFormat);
    if (options.maxColors) form.append('processing.max_colors', options.maxColors.toString());
    if (options.retentionDays) form.append('policy.retention_days', options.retentionDays.toString());

    const response = await axios.post(`${this.baseUrl}/vectorize`, form, {
      auth: this.getAuth(),
      headers: form.getHeaders(),
      responseType: 'arraybuffer',
      timeout: 180000,
    });

    return {
      data: Buffer.from(response.data),
      imageToken: response.headers['x-image-token'],
      creditsCharged: parseFloat(response.headers['x-credits-charged'] || '0'),
    };
  }

  async vectorizeUrl(
    imageUrl: string,
    options: VectorizeOptions = {}
  ): Promise<VectorizeResult> {
    const form = new FormData();
    form.append('image.url', imageUrl);

    if (options.mode) form.append('mode', options.mode);
    if (options.outputFormat) form.append('output.file_format', options.outputFormat);
    if (options.maxColors) form.append('processing.max_colors', options.maxColors.toString());
    if (options.retentionDays) form.append('policy.retention_days', options.retentionDays.toString());

    const response = await axios.post(`${this.baseUrl}/vectorize`, form, {
      auth: this.getAuth(),
      headers: form.getHeaders(),
      responseType: 'arraybuffer',
      timeout: 180000,
    });

    return {
      data: Buffer.from(response.data),
      imageToken: response.headers['x-image-token'],
      creditsCharged: parseFloat(response.headers['x-credits-charged'] || '0'),
    };
  }

  async vectorizeBase64(
    base64Data: string,
    options: VectorizeOptions = {}
  ): Promise<VectorizeResult> {
    const form = new FormData();
    form.append('image.base64', base64Data);

    if (options.mode) form.append('mode', options.mode);
    if (options.outputFormat) form.append('output.file_format', options.outputFormat);
    if (options.maxColors) form.append('processing.max_colors', options.maxColors.toString());
    if (options.retentionDays) form.append('policy.retention_days', options.retentionDays.toString());

    const response = await axios.post(`${this.baseUrl}/vectorize`, form, {
      auth: this.getAuth(),
      headers: form.getHeaders(),
      responseType: 'arraybuffer',
      timeout: 180000,
    });

    return {
      data: Buffer.from(response.data),
      imageToken: response.headers['x-image-token'],
      creditsCharged: parseFloat(response.headers['x-credits-charged'] || '0'),
    };
  }

  async downloadFormat(
    imageToken: string,
    outputFormat: string,
    receipt?: string
  ): Promise<VectorizeResult> {
    const form = new FormData();
    form.append('image.token', imageToken);
    form.append('output.file_format', outputFormat);
    if (receipt) form.append('receipt', receipt);

    const response = await axios.post(`${this.baseUrl}/download`, form, {
      auth: this.getAuth(),
      headers: form.getHeaders(),
      responseType: 'arraybuffer',
      timeout: 180000,
    });

    return {
      data: Buffer.from(response.data),
      imageToken: response.headers['x-image-token'],
      creditsCharged: parseFloat(response.headers['x-credits-charged'] || '0'),
    };
  }

  async getAccountStatus(): Promise<{
    subscriptionPlan: string;
    subscriptionState: string;
    credits: number;
  }> {
    const response = await axios.get(`${this.baseUrl}/account`, {
      auth: this.getAuth(),
    });
    return response.data;
  }

  async deleteImage(imageToken: string): Promise<boolean> {
    const form = new FormData();
    form.append('image.token', imageToken);

    const response = await axios.post(`${this.baseUrl}/delete`, form, {
      auth: this.getAuth(),
      headers: form.getHeaders(),
    });

    return response.data.success;
  }
}

// Usage
const vectorizer = new VectorizerClient({
  apiId: process.env.VECTORIZER_API_ID!,
  apiSecret: process.env.VECTORIZER_API_SECRET!,
});

// Basic vectorization
const result = await vectorizer.vectorizeFile('./design.png', {
  outputFormat: 'svg',
  mode: 'production',
});
fs.writeFileSync('output.svg', result.data);
console.log(`Credits charged: ${result.creditsCharged}`);
```

### Preview-First Workflow (for Customer Approval)

```typescript
async function previewFirstWorkflow(imagePath: string) {
  const vectorizer = new VectorizerClient({
    apiId: process.env.VECTORIZER_API_ID!,
    apiSecret: process.env.VECTORIZER_API_SECRET!,
  });

  // Step 1: Get preview (0.2 credits)
  const preview = await vectorizer.vectorizeFile(imagePath, {
    mode: 'preview',
    retentionDays: 7,
  });

  // Save preview for customer
  fs.writeFileSync('preview.png', preview.data);
  console.log('Preview ready for customer approval');
  console.log(`Image Token: ${preview.imageToken}`);

  // Step 2: After customer approves, download production (0.9 credits)
  if (preview.imageToken) {
    const production = await vectorizer.downloadFormat(
      preview.imageToken,
      'svg'
    );
    fs.writeFileSync('final.svg', production.data);

    // Step 3: Download additional formats (0.1 credits each)
    const pdf = await vectorizer.downloadFormat(preview.imageToken, 'pdf');
    fs.writeFileSync('final.pdf', pdf.data);
  }
}
```

### Multi-Format Download

```typescript
async function downloadMultipleFormats(imagePath: string) {
  const vectorizer = new VectorizerClient({
    apiId: process.env.VECTORIZER_API_ID!,
    apiSecret: process.env.VECTORIZER_API_SECRET!,
  });

  // Vectorize with retention (1.0 credits)
  const result = await vectorizer.vectorizeFile(imagePath, {
    outputFormat: 'svg',
    retentionDays: 1,
  });
  fs.writeFileSync('output.svg', result.data);

  // Download additional formats (0.1 credits each)
  if (result.imageToken) {
    const formats = ['pdf', 'eps', 'dxf'];
    for (const format of formats) {
      const download = await vectorizer.downloadFormat(result.imageToken, format);
      fs.writeFileSync(`output.${format}`, download.data);
    }
  }
}
```

### Complete Amazon Merch Design Service

```typescript
interface DesignVectorizationResult {
  svg: Buffer;
  pdf?: Buffer;
  eps?: Buffer;
  previewPng?: Buffer;
  totalCredits: number;
  imageToken?: string;
}

class MerchDesignVectorizer {
  private client: VectorizerClient;

  constructor(apiId: string, apiSecret: string) {
    this.client = new VectorizerClient({ apiId, apiSecret });
  }

  async vectorizeDesign(
    imagePath: string,
    options: {
      maxColors?: number;
      includeFormats?: ('svg' | 'pdf' | 'eps' | 'dxf')[];
      testMode?: boolean;
    } = {}
  ): Promise<DesignVectorizationResult> {
    const mode = options.testMode ? 'test' : 'production';
    const formats = options.includeFormats || ['svg'];
    let totalCredits = 0;

    // Initial vectorization
    const result = await this.client.vectorizeFile(imagePath, {
      mode,
      outputFormat: 'svg',
      maxColors: options.maxColors,
      retentionDays: formats.length > 1 ? 1 : 0,
    });
    totalCredits += result.creditsCharged;

    const output: DesignVectorizationResult = {
      svg: result.data,
      totalCredits,
      imageToken: result.imageToken,
    };

    // Download additional formats if requested
    if (result.imageToken && formats.length > 1) {
      for (const format of formats) {
        if (format !== 'svg') {
          const download = await this.client.downloadFormat(
            result.imageToken,
            format
          );
          totalCredits += download.creditsCharged;

          switch (format) {
            case 'pdf':
              output.pdf = download.data;
              break;
            case 'eps':
              output.eps = download.data;
              break;
          }
        }
      }
    }

    output.totalCredits = totalCredits;
    return output;
  }

  async createCustomerPreview(imagePath: string): Promise<{
    previewPng: Buffer;
    imageToken: string;
  }> {
    const result = await this.client.vectorizeFile(imagePath, {
      mode: 'preview',
      retentionDays: 7,
    });

    return {
      previewPng: result.data,
      imageToken: result.imageToken!,
    };
  }

  async upgradePreviewToProduction(
    imageToken: string,
    formats: ('svg' | 'pdf' | 'eps' | 'dxf')[] = ['svg']
  ): Promise<DesignVectorizationResult> {
    let totalCredits = 0;
    const output: DesignVectorizationResult = {
      svg: Buffer.alloc(0),
      totalCredits: 0,
    };

    // Download first format (upgrade preview - 0.9 credits)
    const firstFormat = formats[0];
    const first = await this.client.downloadFormat(imageToken, firstFormat);
    totalCredits += first.creditsCharged;

    if (firstFormat === 'svg') {
      output.svg = first.data;
    }

    // Download remaining formats (0.1 credits each)
    for (let i = 1; i < formats.length; i++) {
      const format = formats[i];
      const download = await this.client.downloadFormat(imageToken, format);
      totalCredits += download.creditsCharged;

      switch (format) {
        case 'svg':
          output.svg = download.data;
          break;
        case 'pdf':
          output.pdf = download.data;
          break;
        case 'eps':
          output.eps = download.data;
          break;
      }
    }

    output.totalCredits = totalCredits;
    return output;
  }

  async checkCredits(): Promise<number> {
    const status = await this.client.getAccountStatus();
    return status.credits;
  }
}

// Usage
const designer = new MerchDesignVectorizer(
  process.env.VECTORIZER_API_ID!,
  process.env.VECTORIZER_API_SECRET!
);

// Test mode first
const testResult = await designer.vectorizeDesign('./design.png', {
  testMode: true,
  maxColors: 6,
});
console.log('Test completed, would cost:', testResult.totalCredits, 'credits');

// Production with multiple formats
const prodResult = await designer.vectorizeDesign('./design.png', {
  maxColors: 6,
  includeFormats: ['svg', 'pdf', 'eps'],
});
console.log('Production completed, cost:', prodResult.totalCredits, 'credits');

fs.writeFileSync('design.svg', prodResult.svg);
if (prodResult.pdf) fs.writeFileSync('design.pdf', prodResult.pdf);
if (prodResult.eps) fs.writeFileSync('design.eps', prodResult.eps);
```

---

## Python Implementation

### Installation

```bash
pip install requests
# Or use the official SDK:
pip install vectorizer-ai
```

### Basic Usage

```python
import requests
import os

response = requests.post(
    'https://api.vectorizer.ai/api/v1/vectorize',
    files={'image': open('example.jpeg', 'rb')},
    data={
        'output.file_format': 'svg',
        'processing.max_colors': '6',
    },
    auth=(os.environ['VECTORIZER_API_ID'], os.environ['VECTORIZER_API_SECRET'])
)

if response.status_code == 200:
    with open('result.svg', 'wb') as out:
        out.write(response.content)
    print(f"Credits charged: {response.headers.get('X-Credits-Charged')}")
else:
    print(f"Error: {response.status_code} - {response.text}")
```

### With URL Input

```python
response = requests.post(
    'https://api.vectorizer.ai/api/v1/vectorize',
    data={
        'image.url': 'https://example.com/design.png',
        'output.file_format': 'svg',
    },
    auth=(os.environ['VECTORIZER_API_ID'], os.environ['VECTORIZER_API_SECRET'])
)
```

---

## cURL Examples

### Basic Vectorization

```bash
curl https://api.vectorizer.ai/api/v1/vectorize \
  -u "$VECTORIZER_API_ID:$VECTORIZER_API_SECRET" \
  -F image=@design.png \
  -F output.file_format=svg \
  -o result.svg
```

### From URL

```bash
curl https://api.vectorizer.ai/api/v1/vectorize \
  -u "$VECTORIZER_API_ID:$VECTORIZER_API_SECRET" \
  -F 'image.url=https://example.com/design.png' \
  -o result.svg
```

### Test Mode (Free)

```bash
curl https://api.vectorizer.ai/api/v1/vectorize \
  -u "$VECTORIZER_API_ID:$VECTORIZER_API_SECRET" \
  -F image=@design.png \
  -F mode=test \
  -o result_test.svg
```

### With Color Limits

```bash
curl https://api.vectorizer.ai/api/v1/vectorize \
  -u "$VECTORIZER_API_ID:$VECTORIZER_API_SECRET" \
  -F image=@design.png \
  -F processing.max_colors=6 \
  -o result.svg
```

### Check Account Status

```bash
curl https://api.vectorizer.ai/api/v1/account \
  -u "$VECTORIZER_API_ID:$VECTORIZER_API_SECRET"
```

---

## Next.js API Route

```typescript
// app/api/vectorize/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const image = formData.get('image') as File;

  if (!image) {
    return NextResponse.json({ error: 'Image required' }, { status: 400 });
  }

  const apiFormData = new FormData();
  apiFormData.append('image', image);
  apiFormData.append('output.file_format', 'svg');

  const credentials = Buffer.from(
    `${process.env.VECTORIZER_API_ID}:${process.env.VECTORIZER_API_SECRET}`
  ).toString('base64');

  try {
    const response = await fetch('https://api.vectorizer.ai/api/v1/vectorize', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
      },
      body: apiFormData,
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const svgData = await response.arrayBuffer();

    return new NextResponse(svgData, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'X-Credits-Charged': response.headers.get('X-Credits-Charged') || '0',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

## Error Handling with Retry

```typescript
async function vectorizeWithRetry(
  client: VectorizerClient,
  imagePath: string,
  maxRetries = 3
): Promise<VectorizeResult> {
  let lastError: Error;
  let backoffMultiplier = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.vectorizeFile(imagePath);
    } catch (error: any) {
      lastError = error;

      const status = error.response?.status;

      // Don't retry client errors except rate limits
      if (status >= 400 && status < 500 && status !== 429) {
        throw error;
      }

      // Rate limited - apply linear backoff
      if (status === 429) {
        backoffMultiplier++;
        const delay = backoffMultiplier * 5000;
        console.log(`Rate limited, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (attempt < maxRetries) {
        // Server error - exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Server error, retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

---

## Best Practices

### Cost Optimization

1. **Use test mode during development** - Free with watermarks
2. **Use preview mode for customer approval** - Only 0.2 credits vs 1.0
3. **Enable retention for multi-format** - Download additional formats at 0.1 credits
4. **Batch similar images** - Process during off-peak hours
5. **Monitor credits** - Check account status before batch jobs
6. **Limit colors when possible** - Simpler vectors process faster

### Quality Optimization

1. **Use high-quality source images** - Better input = better output
2. **Set appropriate max_colors** - Match design complexity
3. **Use palette for brand colors** - Ensure exact color matching
4. **Choose correct output format:**
   - SVG: Web, print-on-demand
   - PDF: Print production
   - EPS: Adobe workflows
   - DXF: CAD/cutting machines

### Integration Best Practices

1. **Configure 180s timeout** - API can be slow for complex images
2. **Implement rate limit backoff** - Linear backoff on 429
3. **Store image tokens** - Enable multi-format downloads
4. **Handle errors gracefully** - Parse error JSON for details
5. **Validate credits before batch** - Avoid 402 errors mid-process

---

## Comparison with Alternatives

| Feature | Vectorizer.AI | Adobe Illustrator | Inkscape |
|---------|--------------|-------------------|----------|
| **Type** | Cloud API | Desktop | Desktop |
| **AI-Powered** | Yes | Limited | No |
| **Full Color** | Yes | Yes | Yes |
| **Automation** | API | Scripts | CLI |
| **Pricing** | Per-image | Subscription | Free |
| **Quality** | Best-in-class | Good | Basic |
| **Batch Processing** | Yes | Limited | Limited |

### For Amazon Merch System

| Task | Vectorizer.AI Use |
|------|-------------------|
| AI-generated design cleanup | Vectorize to SVG for scaling |
| Logo vectorization | High-fidelity conversion |
| Design format conversion | Multi-format export |
| Customer preview | Preview mode (0.2 credits) |
| Production files | Full vectorization (1.0 credits) |

---

## Environment Variables

```bash
# Required
VECTORIZER_API_ID=your-api-id
VECTORIZER_API_SECRET=your-api-secret

# Optional
VECTORIZER_TIMEOUT=180000  # ms
```

---

## Additional Resources

- **API Documentation:** https://vectorizer.ai/api
- **Output Options:** https://vectorizer.ai/api/outputOptions
- **Error Responses:** https://vectorizer.ai/api/errors
- **Pricing:** https://vectorizer.ai/pricing
- **Support:** https://vectorizer.ai/support
- **Python SDK:** https://pypi.org/project/vectorizer-ai/
- **API Chatbot:** https://chatgpt.com/g/g-S5qYWp9Ul-vectorizer-ai-api-integration-helper

---

*Documentation compiled from official Vectorizer.AI API reference. Last updated: December 2025.*

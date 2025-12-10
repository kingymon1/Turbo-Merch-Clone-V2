# Merch Generator API Reference

> **Last Updated:** December 2024
> **Version:** Phase 6 Complete

---

## Table of Contents

1. [Generation Endpoints](#1-generation-endpoints)
2. [Cron Job Endpoints](#2-cron-job-endpoints)
3. [Admin Endpoints](#3-admin-endpoints)
4. [Authentication](#4-authentication)
5. [Error Handling](#5-error-handling)
6. [TypeScript Types](#6-typescript-types)

---

## 1. Generation Endpoints

### POST /api/merch/generate

Generate a new merch design using autopilot or manual mode.

**Request Headers:**
```
Authorization: Bearer <clerk-session-token>
Content-Type: application/json
```

**Request Body:**

```typescript
// Autopilot Mode
{
  "mode": "autopilot",
  "riskLevel": 50  // 0-100
}

// Manual Mode
{
  "mode": "manual",
  "specs": {
    "exactText": "World's Okayest Developer",
    "niche": "tech",
    "style": "Bold Modern",  // or "Let AI decide"
    "tone": "Funny",         // or "Let AI decide"
    "imageFeature": "laptop" // optional icon/feature
  }
}
```

**Response:**

```typescript
{
  "success": true,
  "design": {
    "id": "clx1234567890",
    "createdAt": "2024-12-01T12:00:00.000Z",
    "updatedAt": "2024-12-01T12:00:00.000Z",
    "userId": "user_abc123",
    "mode": "autopilot",
    "riskLevel": 50,
    "phrase": "Coffee Then Code",
    "niche": "tech",
    "style": "Bold Modern",
    "tone": "Funny",
    "imageUrl": "https://r2.example.com/designs/abc123.png",
    "imagePrompt": "A bold text-based t-shirt design...",
    "listingTitle": "Coffee Then Code Funny Developer Gift",
    "listingBullets": [
      "Perfect gift for software developers",
      "Premium quality fabric",
      "..."
    ],
    "listingDesc": "Looking for the perfect gift...",
    "approved": false,
    "views": 0,
    "sales": 0
  }
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Invalid mode | Mode must be "autopilot" or "manual" |
| 400 | Manual mode requires specs.exactText | Missing required field |
| 400 | riskLevel between 0-100 | Invalid risk level |
| 401 | Unauthorized | Not authenticated |
| 500 | Failed to generate design | Server error |

---

### GET /api/merch/generate

Fetch user's existing designs with pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 10 | Max designs to return |
| `offset` | number | 0 | Pagination offset |
| `excludeTest` | boolean | false | Exclude test/mock designs |

**Example:**
```
GET /api/merch/generate?limit=20&offset=0&excludeTest=true
```

**Response:**

```typescript
{
  "success": true,
  "designs": [/* array of MerchDesign objects */],
  "total": 45,
  "hasMore": true
}
```

---

### POST /api/merch/dominate

Generate multiple variations of an existing design to "dominate" a niche.

**Request Body:**

```typescript
{
  "designId": "clx1234567890",  // Parent design ID
  "count": 10                    // 1-50 variations
}
```

**Response:**

```typescript
{
  "success": true,
  "count": 10,
  "failed": 0,
  "variations": [/* array of MerchDesign objects */],
  "strategies": [
    {
      "variationType": "phrase",
      "description": "Alternative phrase variation",
      "phrase": "Powered by Coffee and Sarcasm"
    },
    // ...more strategies
  ],
  "message": "Successfully generated 10 variations"
}
```

**Notes:**
- Maximum 50 variations per request
- Timeout: 300 seconds (Vercel Pro limit)
- Each variation uses a unique AI-generated strategy

---

### GET /api/merch/dominate

Get existing variations for a design.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `designId` | string | Yes | Parent design ID |

**Response:**

```typescript
{
  "success": true,
  "count": 10,
  "variations": [/* array of MerchDesign objects */],
  "original": {
    "id": "clx1234567890",
    "phrase": "Coffee Then Code",
    "niche": "tech",
    "imageUrl": "https://..."
  }
}
```

---

## 2. Cron Job Endpoints

All cron endpoints require the `CRON_SECRET` header for authentication.

### POST /api/cron/collect-trends

Collect proven and emerging trend data from multi-agent search.

**Schedule:** Every 6 hours (`0 */6 * * *`)

**Request Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response:**

```typescript
{
  "success": true,
  "message": "Trend collection complete",
  "stats": {
    "cleaned": 15,       // Old records deleted
    "proven": 10,        // Proven trend datasets saved
    "emerging": 10,      // Emerging trend datasets saved
    "duration": "45230ms"
  }
}
```

---

### POST /api/cron/analyze-niches

Analyze collected market data into NicheTrend records.

**Schedule:** Daily at 2am UTC (`0 2 * * *`)

**Response:**

```typescript
{
  "success": true,
  "message": "Niche analysis complete",
  "stats": {
    "nichesAnalyzed": 25,
    "duration": "12340ms"
  }
}
```

---

### POST /api/cron/moonshot-trends

Collect high-virality moonshot trend data.

**Schedule:** Every 4 hours (`0 */4 * * *`)

**Response:**

```typescript
{
  "success": true,
  "message": "Moonshot collection complete",
  "stats": {
    "moonshot": 8,
    "duration": "78450ms"
  }
}
```

---

### POST /api/cron/learn-and-extract

Weekly learning cycle: extract insights, validate existing, update confidence.

**Schedule:** Sunday 4am UTC (`0 4 * * 0`)

**Response:**

```typescript
{
  "success": true,
  "message": "Learning cycle complete",
  "extraction": {
    "insightsCreated": 3,
    "insightsUpdated": 12,
    "candidatesAnalyzed": 5,
    "errors": []
  },
  "validation": {
    "validated": 18,
    "degraded": 2,
    "invalidated": 1,
    "errors": []
  },
  "summary": {
    "total": 23,
    "byType": {
      "phrase-pattern": 8,
      "style-effectiveness": 5,
      "niche-timing": 4,
      "listing-structure": 4,
      "cross-niche": 2
    },
    "byCategory": {
      "evergreen": 12,
      "design": 5,
      "seasonal": 4,
      "listing": 2
    },
    "highConfidence": 15,
    "recentlyValidated": 20
  },
  "duration": "23450ms"
}
```

---

## 3. Admin Endpoints

### POST /api/admin/trigger-collection

Manually trigger data collection or learning operations.

**Request Body:**

```typescript
{
  "action": "collect" | "collect-proven" | "collect-emerging" |
            "moonshot" | "analyze" | "clean" | "full" |
            "learn" | "validate" | "insights"
}
```

**Actions:**

| Action | Description |
|--------|-------------|
| `collect` | Collect proven + emerging trends |
| `collect-proven` | Collect proven trends only |
| `collect-emerging` | Collect emerging trends only |
| `moonshot` | Collect moonshot/viral trends |
| `analyze` | Analyze niches from collected data |
| `clean` | Clean old market data |
| `full` | Run complete collection cycle |
| `learn` | Extract new insights |
| `validate` | Validate existing insights |
| `insights` | Get insights summary |

**Response:**

```typescript
{
  "success": true,
  "action": "learn",
  "result": {
    "insightsCreated": 2,
    "insightsUpdated": 5,
    "errors": []
  },
  "duration": "8340ms"
}
```

---

### GET /api/admin/insights

List all ProvenInsights with optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by insightType |
| `category` | string | Filter by category |
| `niche` | string | Filter by niche |
| `relevant` | boolean | Filter by stillRelevant |
| `minConfidence` | number | Minimum confidence (0-1) |

**Example:**
```
GET /api/admin/insights?type=phrase-pattern&minConfidence=0.85
```

**Response:**

```typescript
{
  "success": true,
  "insights": [/* array of ProvenInsight objects */],
  "stats": {
    "total": 23,
    "byType": { "phrase-pattern": 8, ... },
    "byCategory": { "evergreen": 12, ... },
    "avgConfidence": 0.87,
    "relevant": 22
  }
}
```

---

### POST /api/admin/insights

Manually create a new ProvenInsight.

**Request Body:**

```typescript
{
  "insightType": "phrase-pattern",
  "category": "evergreen",
  "title": "\"World's Okayest\" pattern performs well",
  "description": "Phrases following the \"World's Okayest {X}\" template...",
  "pattern": {
    "template": "World's Okayest {noun}",
    "examples": ["World's Okayest Nurse", "World's Okayest Dad"]
  },
  "sampleSize": 25,
  "confidence": 0.85,
  "successRate": 0.72,
  "niche": null,
  "niches": ["nurse", "dad", "teacher"],
  "timeframe": "year-round",
  "riskLevel": "proven"
}
```

---

### GET /api/admin/insights/[id]

Get a specific insight by ID.

---

### PATCH /api/admin/insights/[id]

Update an existing insight.

**Request Body:** Any fields from ProvenInsight model.

---

### DELETE /api/admin/insights/[id]

Delete an insight.

---

### POST /api/marketplace/keywords

**Phase 7A** - Get optimized keywords for a niche from learned marketplace data.

**Request Body:**
```json
{
  "niche": "nurse gifts",      // Required: Target niche
  "quick": false               // Optional: Return only keyword list (faster)
}
```

**Response (Full Mode):**
```json
{
  "success": true,
  "data": {
    "niche": "nurse gifts",
    "primaryKeywords": ["nurse", "nursing", "rn gift", "nurse appreciation"],
    "longTailPhrases": ["funny nurse shirt", "registered nurse gift"],
    "titlePatterns": ["Nurse Life Funny Gift...", "RN Nursing Shirt..."],
    "effectiveBrands": ["NurseVibes", "MedicalHumor"],
    "priceGuidance": { "optimal": 19.99, "range": { "min": 14.99, "max": 24.99 } },
    "mbaInsights": { "productCount": 45, "avgTitleLength": 120, "commonTones": ["funny", "gift-focused"] },
    "saturation": "medium",
    "entryRecommendation": "enter",
    "confidence": 75,
    "lastUpdated": "2024-12-10T..."
  },
  "source": "learned",
  "message": "Found optimized keywords for \"nurse gifts\" with 75% confidence",
  "stats": { "primaryKeywords": 15, "longTailPhrases": 8, "titlePatterns": 5, "mbaProducts": 45 }
}
```

**Response (Quick Mode):**
```json
{
  "success": true,
  "data": ["nurse", "nursing", "rn gift", "nurse appreciation", "funny nurse"],
  "source": "learned",
  "message": "Found 5 keywords for \"nurse gifts\""
}
```

**Response (No Data):**
```json
{
  "success": false,
  "data": null,
  "source": "none",
  "message": "No marketplace data found for niche...",
  "suggestions": ["Run POST /api/marketplace/scrape...", "Run POST /api/marketplace/trending..."]
}
```

---

### GET /api/marketplace/keywords

Get endpoint information and usage examples.

---

## 4. Authentication

### User Endpoints

All `/api/merch/*` endpoints require Clerk authentication:

```typescript
const { userId } = await auth();
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Cron Endpoints

Cron endpoints verify the `CRON_SECRET`:

```typescript
const authHeader = request.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Admin Endpoints

Admin endpoints accept either Clerk auth OR CRON_SECRET:

```typescript
const { userId } = await auth();
const isAuthorized = userId ||
  (cronSecret && authHeader === `Bearer ${cronSecret}`);
```

---

## 5. Error Handling

All endpoints return consistent error responses:

```typescript
{
  "success": false,
  "error": "Human-readable error message",
  "details": "Technical details (optional)"
}
```

**Common HTTP Status Codes:**

| Status | Meaning |
|--------|---------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing/invalid auth |
| 404 | Not Found - Resource doesn't exist |
| 500 | Server Error - Internal failure |

---

## 6. TypeScript Types

### MerchDesign

```typescript
interface MerchDesign {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  mode: 'autopilot' | 'manual';
  riskLevel?: number;
  sourceData?: any;
  userSpecs?: ManualSpecs;
  phrase: string;
  niche: string;
  style?: string;
  tone?: string;
  imageUrl: string;
  imagePrompt: string;
  listingTitle: string;
  listingBullets: string[];
  listingDesc: string;
  approved: boolean;
  approvedAt?: Date;
  userRating?: number;
  views: number;
  sales: number;
  parentId?: string;
}
```

### ManualSpecs

```typescript
interface ManualSpecs {
  exactText: string;
  style?: string;
  imageFeature?: string;
  niche?: string;
  tone?: string;
  additionalInstructions?: string;
}
```

### GenerationRequest

```typescript
interface GenerationRequest {
  mode: 'autopilot' | 'manual';
  riskLevel?: number;
  specs?: ManualSpecs;
}
```

### TrendData

```typescript
interface TrendData {
  topic: string;
  platform: string;
  volume: string;
  sentiment: string;
  keywords: string[];
  customerPhrases: string[];
  visualStyle: string;
  designText?: string;
  description?: string;
  sources?: string[];
  audienceProfile?: string;
}
```

### ProvenInsight

```typescript
interface ProvenInsight {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  insightType: 'phrase-pattern' | 'niche-timing' |
               'style-effectiveness' | 'listing-structure' | 'cross-niche';
  category: 'evergreen' | 'seasonal' | 'design' | 'listing' | 'approval';
  title: string;
  description: string;
  pattern: Record<string, any>;
  sampleSize: number;
  confidence: number;  // 0-1
  successRate?: number;
  avgPerformance?: Record<string, any>;
  niche?: string;
  niches: string[];
  timeframe?: string;
  riskLevel?: string;
  lastValidated: Date;
  timesValidated: number;
  stillRelevant: boolean;
  supersededBy?: string;
  sourceDataIds: string[];
}
```

---

## Quick Examples

### Generate a Design (cURL)

```bash
# Autopilot mode
curl -X POST https://your-domain.com/api/merch/generate \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "autopilot", "riskLevel": 50}'

# Manual mode
curl -X POST https://your-domain.com/api/merch/generate \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "manual",
    "specs": {
      "exactText": "Coffee Then Code",
      "niche": "tech",
      "style": "Bold Modern"
    }
  }'
```

### Trigger Learning Manually

```bash
curl -X POST https://your-domain.com/api/admin/trigger-collection \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "learn"}'
```

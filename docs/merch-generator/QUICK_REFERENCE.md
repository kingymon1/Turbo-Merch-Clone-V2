# Merch Generator Quick Reference

> One-page cheat sheet for the Merch Generator feature

---

## Generation Modes

| Mode | User Provides | System Provides |
|------|---------------|-----------------|
| **Autopilot** | Risk level (0-100) | Phrase, style, tone, niche |
| **Manual** | Exact text, optional style/tone | Image + listing |
| **Dominate** | Parent design, count (1-50) | N unique variations |

---

## Risk Levels

| Range | Name | Strategy |
|-------|------|----------|
| 0-30 | Safe | Proven evergreen niches |
| 30-70 | Balanced | Established + rising trends |
| 70-100 | Moonshot | Viral/breakout potential |

---

## API Endpoints

### Generation
```
POST /api/merch/generate     # Generate design
GET  /api/merch/generate     # List designs
POST /api/merch/dominate     # Generate variations
GET  /api/merch/dominate     # Get variations
```

### Cron Jobs
```
POST /api/cron/collect-trends      # Every 6h
POST /api/cron/analyze-niches      # Daily 2am
POST /api/cron/moonshot-trends     # Every 4h
POST /api/cron/learn-and-extract   # Sunday 4am
```

### Admin
```
POST /api/admin/trigger-collection  # Manual triggers
GET  /api/admin/insights            # List insights
POST /api/admin/insights            # Create insight
```

---

## File Structure

```
lib/merch/
├── autopilot-generator.ts    # Autopilot flow
├── image-generator.ts        # Gemini Imagen
├── listing-generator.ts      # SEO listings
├── variation-generator.ts    # Dominate feature
├── data-collectors/          # Market intelligence
│   ├── trend-collector.ts
│   └── niche-analyzer.ts
└── learning/                 # Learning system
    ├── insight-extractor.ts
    ├── insight-validator.ts
    └── insight-applier.ts
```

---

## Database Models

| Model | Purpose |
|-------|---------|
| `MerchDesign` | Generated designs |
| `MarketData` | Raw cached trends |
| `NicheTrend` | Aggregated niche metrics |
| `ProvenInsight` | Permanent learned patterns |

---

## Insight Types

| Type | Captures |
|------|----------|
| `phrase-pattern` | High-performing phrase templates |
| `style-effectiveness` | Visual style success rates |
| `niche-timing` | Seasonal patterns |
| `listing-structure` | Effective title patterns |
| `cross-niche` | Niche combination opportunities |

---

## Data Retention

| Data | Retention |
|------|-----------|
| ProvenInsight | **Permanent** |
| Successful design source | **Never deleted** |
| MarketData (proven/emerging) | 180 days |
| MarketData (moonshot) | 30 days |

---

## Cron Schedule (vercel.json)

```json
{
  "crons": [
    { "path": "/api/cron/collect-trends", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/analyze-niches", "schedule": "0 2 * * *" },
    { "path": "/api/cron/moonshot-trends", "schedule": "0 */4 * * *" },
    { "path": "/api/cron/learn-and-extract", "schedule": "0 4 * * 0" }
  ]
}
```

---

## Learning Thresholds

```typescript
MIN_SAMPLE_SIZE = 10      // Designs per pattern
MIN_CONFIDENCE = 0.8      // Wilson Score threshold
MIN_TIME_PERIODS = 2      // Must appear in 2+ weeks
```

---

## Quick Commands

```bash
# Development
npm run dev
MERCH_USE_MOCK=true npm run dev  # Mock mode

# Database
npx prisma studio
npx prisma migrate dev

# Manual Triggers
curl -X POST .../api/admin/trigger-collection \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"action": "learn"}'
```

---

## Trigger Actions

| Action | Description |
|--------|-------------|
| `collect` | Proven + emerging trends |
| `moonshot` | Viral trends |
| `analyze` | Niche aggregation |
| `clean` | Data cleanup |
| `full` | All collection + analysis |
| `learn` | Extract insights |
| `validate` | Validate insights |
| `insights` | Get summary |

---

## Key Interfaces

```typescript
interface MerchDesign {
  id: string;
  mode: 'autopilot' | 'manual';
  riskLevel?: number;
  phrase: string;
  niche: string;
  style?: string;
  imageUrl: string;
  listingTitle: string;
  listingBullets: string[];
  approved: boolean;
  sales: number;
}

interface ProvenInsight {
  insightType: string;
  title: string;
  pattern: Record<string, any>;
  confidence: number;  // 0-1
  successRate?: number;
  stillRelevant: boolean;
}
```

---

## Environment Variables

```bash
DATABASE_URL="postgresql://..."
GEMINI_API_KEY="..."
GROK_API_KEY="..."
BRAVE_API_KEY="..."
CRON_SECRET="..."
MERCH_USE_MOCK="false"
```

---

## Logs to Watch

```
[Merch Generate] Starting autopilot mode
[Autopilot] Using cached market data (saves API costs!)
[Autopilot] Applied 3 insights
[Cron] 🎉 New insights discovered: 2
```

---

## Common Issues

| Issue | Check |
|-------|-------|
| No insights created | Need 10+ designs, 2+ weeks |
| Cache not used | Verify cron jobs running |
| Generation fails | Check API keys, R2 config |
| Unauthorized | Check Clerk / CRON_SECRET |

---

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview
- [API_REFERENCE.md](./API_REFERENCE.md) - API docs
- [LEARNING_SYSTEM.md](./LEARNING_SYSTEM.md) - Insights deep dive
- [BACKGROUND_JOBS.md](./BACKGROUND_JOBS.md) - Cron details
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) - Setup & workflow

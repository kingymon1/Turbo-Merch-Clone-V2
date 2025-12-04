# Vectorizer.AI Integration

## Quick Reference

**Official Docs**: https://vectorizer.ai/api

**What it does**: Converts images to vectorized PNGs with 4x resolution and crisper edges. Offered as "HD Vector PNG" download option for paid users.

---

## Environment Variables (Vercel)

```
VECTORIZER_API_ID=your_api_id
VECTORIZER_API_SECRET=your_api_secret
NEXT_PUBLIC_VECTORIZER_ENABLED=true
```

Get credentials at https://vectorizer.ai/api (requires subscription)

---

## How It Works

1. User clicks Download → modal shows Standard/HD options
2. HD selected → calls Vectorizer.AI API → caches result in R2
3. Same image downloaded again → serves cached version (no API cost)

**Caching**: Stored in `DesignHistory.vectorizedUrl` field

---

## Key Files

| File | What it does |
|------|--------------|
| `services/vectorizerService.ts` | API calls, auth, image processing |
| `app/api/vectorize/download/route.ts` | Endpoint that handles caching |
| `config.ts` | Settings in `VECTORIZER_CONFIG` |
| `components/ListingGenerator.tsx` | Download modal in Studio |
| `components/Library.tsx` | Download modal in Library |

---

## Who Has Access

| Tier | HD Vector |
|------|-----------|
| free | Locked (shows upgrade prompt) |
| starter | Yes |
| pro | Yes |
| business | Yes |
| enterprise | Yes |

---

## Turn Feature On/Off

```
NEXT_PUBLIC_VECTORIZER_ENABLED=false  → No modal, direct standard download
NEXT_PUBLIC_VECTORIZER_ENABLED=true   → Shows Standard/HD choice
```

Redeploy after changing.

---

## Database Fields

In `prisma/schema.prisma`, `DesignHistory` model:
```
vectorizedUrl  String?   // Cached HD image URL
vectorizedAt   DateTime? // When vectorized
```

---

## API Pricing

~$0.05-0.20 per image depending on volume. Caching prevents duplicate charges.

---

## Troubleshooting

**HD option not showing**: Check `NEXT_PUBLIC_VECTORIZER_ENABLED=true` and redeploy

**"Vectorization failed"**: Check API credentials, verify Vectorizer.AI subscription is active

**Charged twice for same image**: Check if `vectorizedUrl` is being saved - if null, caching failed

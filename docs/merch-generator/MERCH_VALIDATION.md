# Merch Validation System

> Phase 7B: Amazon Merch on Demand Compliance Validation

## Overview

The Merch Validation System is a dedicated compliance layer for Amazon Merch on Demand listings. It ensures all generated listings meet Amazon's strict content policies before submission.

**Important**: This is a SEPARATE system from `services/compliance.ts`. The existing compliance system continues to work for other features (Trend Lab, etc.). This new system is specifically designed for the merch generator (Phases 1-6).

## Why a Separate System?

| Reason | Explanation |
|--------|-------------|
| Merch-specific limits | Merch has different limits (500 char description vs 2000) |
| More banned words | 200+ Merch-specific banned words |
| Exacty 2 bullets | Merch requires exactly 2 bullet points |
| No migration risk | Doesn't affect existing compliance.ts integrations |
| Better testing | Can be tested in isolation |

## Architecture

```
lib/merch/validation/
├── index.ts              # Barrel export
├── banned-words.ts       # 200+ banned words by category
├── ascii-cleaner.ts      # Unicode → ASCII conversion
└── listing-validator.ts  # Main validation logic
```

## Character Limits

Amazon Merch on Demand has strict character limits:

| Field | Min | Max | Notes |
|-------|-----|-----|-------|
| Title | 40 | 60 | Must be descriptive, no product type words |
| Brand | 1 | 50 | Unique micro-brand name |
| Bullet 1 | 180 | 256 | Feature-focused |
| Bullet 2 | 180 | 256 | Benefit-focused |
| Description | 100 | 500 | Merch limit (not standard 2000) |

## Banned Words Categories

The system includes 200+ banned words organized into categories:

### 1. Apparel Words (28 words)
Words that describe the product itself:
- design, graphic, print, shirt, tee, hoodie
- gift, merchandise, merch, apparel, clothing

### 2. Health/Medical Claims (56 words)
Prohibited medical and health claims:
- cure, treat, medical, cancer, diabetes
- anxiety, depression, therapeutic, healing

### 3. Promotional Language (43 words)
Sales and promotional terms:
- best seller, guaranteed, sale, discount
- limited time, free shipping, amazon choice

### 4. Quality Claims (41 words)
Unverifiable quality assertions:
- 100%, certified, proven, award winning
- top quality, premium quality, official

### 5. Sales Pressure (38 words)
Urgency and pressure tactics:
- buy now, act now, limited quantity
- selling fast, last chance, don't miss

### 6. Trademarks (80+ words)
Protected brand names:
- Nike, Disney, Pokemon, Marvel
- Nintendo, Apple, Google, Amazon

### 7. Service Promises (27 words)
Shipping and service claims:
- free shipping, fast delivery, satisfaction guaranteed
- money back, easy returns, 24/7 support

### 8. Material Claims (19 words)
Unverifiable material assertions:
- organic, eco friendly, sustainable
- handmade, made in usa, fair trade

### 9. Inappropriate Content (44 words)
Content that violates policies:
- explicit, adult, violence, hate
- drug references, alcohol references

## ASCII Compliance

Amazon Merch requires ASCII-only text. The system:

1. **Converts Unicode to ASCII**:
   - Smart quotes → regular quotes
   - Em/en dashes → hyphens
   - Ellipsis → three periods
   - Accented characters → base characters

2. **Removes emojis**: All emoji ranges are stripped

3. **Removes non-printable characters**: Only `0x20-0x7E` allowed

## Usage

### Basic Validation

```typescript
import { validateMerchListing } from '@/lib/merch/validation';

const result = validateMerchListing({
  title: 'Coffee Lover Espresso Beans Morning Brew Caffeine',
  brand: 'Urban Brew Collective',
  bullets: [
    'For true coffee enthusiasts who live for that first morning cup...',
    'The perfect way to show off your caffeine obsession...'
  ],
  description: 'Show your love for coffee with this bold design...',
  keywords: ['coffee', 'espresso', 'morning']
});

if (result.valid) {
  // Use result.cleanedListing
} else {
  console.error('Validation errors:', result.errors);
}
```

### Pre-Validation (Before Generation)

```typescript
import { preValidateInput } from '@/lib/merch/validation';

const check = preValidateInput(phrase, niche);
if (!check.valid) {
  // Show errors to user before generation
}
```

### Individual Field Validation

```typescript
import { validateTitle, validateBrand } from '@/lib/merch/validation';

const titleResult = validateTitle('My Awesome Title Here');
const brandResult = validateBrand('Cool Brand Name');
```

### Check for Banned Words

```typescript
import { findBannedWords, containsBannedWords } from '@/lib/merch/validation';

if (containsBannedWords(text)) {
  const found = findBannedWords(text);
  console.log('Found banned words:', found);
}
```

### ASCII Cleanup

```typescript
import { cleanToAscii, hasEmojis, hasNonAscii } from '@/lib/merch/validation';

const cleaned = cleanToAscii('Hello "World" — with emojis 🎉');
// Result: 'Hello "World" - with emojis'
```

## API Endpoint

### POST /api/merch/validate

Test a listing against the validation system.

**Request:**
```json
{
  "title": "Coffee Lover Morning Brew Caffeine Addict Espresso",
  "brand": "Urban Brew Collective",
  "bullets": [
    "For true coffee enthusiasts who appreciate the art of brewing...",
    "The perfect way to express your morning ritual devotion..."
  ],
  "description": "Show your love for coffee with this bold typographic design...",
  "keywords": ["coffee", "espresso", "morning"]
}
```

**Response:**
```json
{
  "success": true,
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": ["Title is short: 45 chars (recommended: 50+)"],
    "cleanedListing": {
      "title": "Coffee Lover Morning Brew Caffeine Addict Espresso",
      "brand": "Urban Brew Collective",
      "bullets": ["...", "..."],
      "description": "...",
      "keywords": ["coffee", "espresso", "morning"]
    },
    "stats": {
      "bannedWordsRemoved": 0,
      "charactersChanged": 0,
      "fieldsTruncated": []
    }
  }
}
```

### GET /api/merch/validate

Get validation system info.

**Response:**
```json
{
  "success": true,
  "info": {
    "limits": {
      "title": { "min": 40, "max": 60 },
      "brand": { "min": 1, "max": 50 },
      "bullet": { "min": 180, "max": 256 },
      "description": { "min": 100, "max": 500 },
      "bulletCount": 2
    },
    "bannedWordCount": 256,
    "description": "Amazon Merch on Demand listing validation system",
    "version": "1.0.0"
  }
}
```

## Integration Points

### 1. Listing Generator (`lib/merch/listing-generator.ts`)

Validation runs automatically after AI generation:

```typescript
// After generating listing...
const validationResult = validateMerchListing({
  title: listing.title,
  brand: listing.brand || '',
  bullets: bullets.slice(0, 2),
  description: listing.description,
  keywords: listing.keywords
});

// Return cleaned listing with validation status
return {
  ...validationResult.cleanedListing,
  validation: {
    valid: validationResult.valid,
    errors: validationResult.errors,
    warnings: validationResult.warnings
  }
};
```

### 2. Autopilot Generator (`lib/merch/autopilot-generator.ts`)

Pre-validation runs on concept extraction:

```typescript
// Clean phrase before use
let phrase = cleanToAscii(rawPhrase);
const bannedInPhrase = findBannedWords(phrase);

if (bannedInPhrase.length > 0) {
  // Remove banned words
  for (const banned of bannedInPhrase) {
    phrase = phrase.replace(new RegExp(`\\b${banned}\\b`, 'gi'), '');
  }
}
```

## Validation Result Structure

```typescript
interface MerchValidationResult {
  // Overall pass/fail
  valid: boolean;

  // Blocking issues that need fixing
  errors: string[];

  // Non-blocking suggestions
  warnings: string[];

  // Sanitized listing ready for submission
  cleanedListing: MerchListing;

  // Statistics about what was changed
  stats: {
    bannedWordsRemoved: number;
    charactersChanged: number;
    fieldsTruncated: string[];
  };
}
```

## Common Validation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Title too long: 75 chars (max: 60)" | Title exceeds limit | Auto-truncated |
| "Title contains banned words: gift, shirt" | Banned words in title | Auto-removed |
| "Must have exactly 2 bullets" | Wrong bullet count | Generate correct count |
| "Bullet 1 too long: 300 chars" | Bullet exceeds limit | Auto-truncated |
| "Brand contains banned words: amazon" | Trademark in brand | Auto-removed |

## Common Validation Warnings

| Warning | Cause | Recommendation |
|---------|-------|----------------|
| "Title is short: 35 chars" | Under minimum | Expand title |
| "Bullet 1 short: 150 chars" | Under recommended | Add more content |
| "Title: Unicode/emojis removed" | Non-ASCII found | Use ASCII only |
| "Keyword contains banned words" | Banned in keyword | Will be filtered |

## Testing

### Manual Testing

```bash
# Test validation endpoint
curl -X POST http://localhost:3000/api/merch/validate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Title For Coffee Lovers Morning Caffeine",
    "brand": "Test Brand Co",
    "bullets": ["First bullet point...", "Second bullet point..."],
    "description": "Test description for validation..."
  }'
```

### Unit Testing

```typescript
import { validateMerchListing, findBannedWords, cleanToAscii } from '@/lib/merch/validation';

// Test banned word detection
expect(findBannedWords('Best seller shirt')).toContain('best seller');
expect(findBannedWords('Best seller shirt')).toContain('shirt');

// Test ASCII cleaning
expect(cleanToAscii('Hello "World"')).toBe('Hello "World"');

// Test full validation
const result = validateMerchListing({...});
expect(result.valid).toBe(true);
```

## Relationship to Existing Systems

```
┌─────────────────────────────────────────────────────────────┐
│                    services/compliance.ts                    │
│                  (General Compliance System)                 │
│                                                             │
│  Used by:                                                   │
│  - services/geminiService.ts (sanitizeListing)              │
│  - app/api/trend-lab/route.ts (sanitizeDesignText)          │
│                                                             │
│  Features:                                                  │
│  - BANNED_WORDS_LIST (70+ words)                           │
│  - TITLE_RESTRICTED_WORDS                                   │
│  - 2000 char description limit                              │
│  - General compliance rules                                 │
└─────────────────────────────────────────────────────────────┘
                              ▼
                        (UNCHANGED)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               lib/merch/validation/                          │
│             (Merch-Specific Validation)                      │
│                                                             │
│  Used by:                                                   │
│  - lib/merch/listing-generator.ts                           │
│  - lib/merch/autopilot-generator.ts                         │
│  - app/api/merch/validate/route.ts                          │
│                                                             │
│  Features:                                                  │
│  - 200+ banned words (by category)                          │
│  - 500 char description limit (Merch-specific)              │
│  - Exactly 2 bullets                                        │
│  - Full Unicode → ASCII conversion                          │
│  - Detailed error/warning reporting                         │
└─────────────────────────────────────────────────────────────┘
```

Both systems run independently. The merch validation system is designed specifically for Amazon Merch on Demand requirements and provides more comprehensive validation for that use case.

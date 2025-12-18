# Simple Autopilot Content Generation Fix (Revised)

## Problem Summary

The LLM content generation in Simple Autopilot is producing poor results:
- `textBottom`: Always "Life Style" (fallback)
- `imageDescription`: Always generic (fallback)
- `textTop`: Trend descriptions instead of wearable phrases

## Root Cause

**We're throwing away good research data.**

Perplexity is asked to return:
```json
{
  "topic": "The specific trend or concept name",
  "phrase": "The exact 2-5 word phrase that would work on a t-shirt",
  "audience": "Who would buy this shirt",
  "mood": "The emotional tone (funny, inspirational, sarcastic, etc.)",
  "summary": "..."
}
```

But `findTrendingTopic()` only returns `topic`, `summary`, `source` - discarding `phrase`, `audience`, and `mood`.

Then Gemini is asked to re-derive the shirt text from scratch without this context.

## Revised Fix

### Step 1: Update `findTrendingTopic()` return value

**File**: `app/api/simple-autopilot/route.ts`

Update the return type and value to include all research fields:

```typescript
interface TrendResearch {
  topic: string;
  phrase: string;      // ADD - the t-shirt phrase
  audience: string;    // ADD - who would buy this
  mood: string;        // ADD - emotional tone
  summary: string;
  source: string;
}
```

Return all fields from Perplexity response instead of discarding them.

### Step 2: Update `extractSlotValues()` to use research data

**File**: `app/api/simple-autopilot/route.ts`

- Use `phrase` from Perplexity as `textTop` (this is what research found)
- Pass `mood` and `audience` to Gemini as context
- Gemini's simplified job: derive `textBottom` and `imageDescription` that **complement** the phrase

### Step 3: Simplify Gemini's prompt

**Current role**: "Create all the shirt text from the trend topic"
**Revised role**: "Given this phrase (from research) and mood, create a complementary bottom line and visual"

New prompt structure:
```
RESEARCH FOUND THIS PHRASE: "${phrase}"
TARGET AUDIENCE: ${audience}
MOOD/TONE: ${mood}

Your job is to COMPLEMENT this phrase with:
1. textBottom: 2-4 words that complete or contrast the phrase
2. imageDescription: A specific visual that fits the mood

The phrase is already good - don't replace it, enhance it.
```

### Step 4: Add logging and validation

- Log what Perplexity returns (to verify phrase quality)
- Validate phrase exists and is usable
- Validate phrase is ≤6 words per autopilot requirement
- Only use fallback if Perplexity didn't return a valid phrase

### Step 5: Enforce 6-word maximum

If Perplexity's phrase is >6 words, truncate intelligently or request Gemini to shorten it while preserving meaning.

## Files to Modify

| File | Changes |
|------|---------|
| `app/api/simple-autopilot/route.ts` | Steps 1-5: Update return types, pass research data through, simplify Gemini prompt, add validation |

## Data Flow (After Fix)

```
Perplexity Research
    ↓
Returns: topic, phrase, audience, mood, summary
    ↓
phrase → textTop (directly from research)
mood + audience → context for Gemini
    ↓
Gemini (simplified role)
    ↓
Derives: textBottom, imageDescription (complementing the phrase)
    ↓
Final prompt uses research-backed phrase
```

## Success Criteria

- [x] Perplexity's `phrase` field flows through as `textTop`
- [x] `mood` and `audience` are passed to Gemini
- [x] Gemini only derives `textBottom` and `imageDescription`
- [x] `textTop` is ≤6 words
- [x] No more "Life Style" defaults when research provided good data
- [x] Designs are more varied (different phrases from research)

## Testing Plan

1. Run 10 generations with logging enabled
2. Verify Perplexity returns phrase/mood/audience
3. Verify phrase is used as textTop
4. Verify textBottom varies and relates to the phrase
5. Verify imageDescription is specific to each trend

## Implementation Complete ✓

**Date**: December 2024

**Changes Made**:
1. Added `TrendResearch` interface with `phrase`, `audience`, `mood` fields
2. Updated `findTrendingTopic()` to return all Perplexity research fields
3. Updated `extractSlotValues()` to use phrase as textTop and pass context to Gemini
4. Added `responseSchema` to Gemini API calls for reliable JSON output
5. Increased `maxOutputTokens` from 300/800 to 2048 (to accommodate Gemini 2.5 thinking tokens)
6. Added 6-word maximum enforcement on textTop
7. Added banned phrase validation for textBottom

**Key Fix**: Gemini 2.5 uses "thinking tokens" that count against `maxOutputTokens`. Previous limits (300/800) were too low, causing `finishReason: "MAX_TOKENS"` before JSON output was complete.

**Results**: After fix, prompts show diverse, trend-specific content:
- textTop examples: "Human, Not Generated", "God Forbid I Have Hobbies"
- textBottom examples: "Still loading.", "My simple joys."
- imageDescription examples: "A vibrant, glitchy vintage CRT monitor..."

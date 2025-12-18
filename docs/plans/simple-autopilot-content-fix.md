# Simple Autopilot Content Generation Fix

## Problem Summary

The LLM content generation in Simple Autopilot is failing, causing fallback defaults to be used 100% of the time:
- `textBottom`: Always "Life Style"
- `imageDescription`: Always "a bold graphic element representing the trend"
- `textTop`: Truncated trend topic (not proper t-shirt copy)

## Root Cause Analysis

1. **Gemini JSON parsing failure** - The `extractSlotValues()` function's catch block is triggering, using fallback values
2. **Prompt clarity issue** - The LLM prompt asks for "hook/attention grabber" but gets trend descriptions
3. **No validation** - Malformed/incomplete text passes through unchecked
4. **6-word limit not enforced** - Per docs, autopilot should enforce max 6 words

## Proposed Fix

### Step 1: Add Logging to Diagnose JSON Failure

**File**: `app/api/simple-autopilot/route.ts`

Add detailed logging in `extractSlotValues()` to capture:
- Raw Gemini response before parsing
- Parse error details if JSON fails
- Whether fallback is being used

This will confirm if the issue is malformed JSON, empty response, or something else.

### Step 2: Improve the LLM Prompt

**File**: `app/api/simple-autopilot/route.ts` (lines 221-242)

Current prompt issues:
- Asks for "hook/attention grabber that relates to the trend" - too vague
- No examples of good vs bad output
- No explicit instruction to create wearable copy, not descriptions

Improved prompt structure:
```
You are a t-shirt copywriter, NOT a trend analyst.

TREND: [topic]
CONTEXT: [summary]

Create SHORT, PUNCHY text that someone would WEAR on a shirt.

EXAMPLES OF GOOD OUTPUT:
- textTop: "Touch Grass" (not "Digital Detox Trend")
- textTop: "Chaos Coordinator" (not "Busy Parent Lifestyle")
- textBottom: "Send Coffee" (not "Life Style")

EXAMPLES OF BAD OUTPUT (DO NOT DO THIS):
- Describing the trend: "Holiday Exhaustion Energy"
- Generic filler: "Life Style", "Trending Now"
- Incomplete phrases: "Nothing beats a"

YOUR OUTPUT:
{
  "textTop": "2-4 words, catchy phrase people would wear",
  "textBottom": "2-4 words, completes the message or adds humor",
  "imageDescription": "specific visual, e.g. 'a steaming coffee cup with cartoon eyes'"
}
```

### Step 3: Add Response Validation

**File**: `app/api/simple-autopilot/route.ts`

After parsing LLM response, validate:
1. `textTop` is not empty and not > 6 words
2. `textBottom` is not empty and not a banned generic phrase
3. `imageDescription` is not empty and not the default fallback

If validation fails, retry once with a more explicit prompt or use smarter fallback.

### Step 4: Create Banned Phrase List for textBottom

**File**: `lib/simple-style-selector.ts` (or new file)

```typescript
const BANNED_BOTTOM_PHRASES = [
  'life style', 'lifestyle', 'trending now', 'hot topic',
  'viral trend', 'must have', 'limited edition'
];
```

If LLM returns a banned phrase, reject and retry.

### Step 5: Enforce 6-Word Maximum

**File**: `app/api/simple-autopilot/route.ts`

Per CLAUDE.md: "Autopilot mode: Maximum 6 words enforced for reliable rendering"

Add word count check after LLM response:
```typescript
const wordCount = textTop.split(/\s+/).length;
if (wordCount > 6) {
  // Truncate intelligently or retry
}
```

### Step 6: Improve Fallback Logic

**File**: `app/api/simple-autopilot/route.ts`

Current fallback just truncates trend topic. Better approach:
- Use Perplexity's `phrase` field if available (it asks for this)
- Extract quoted phrases from trend summary
- Use a set of proven fallback templates per niche

## Files to Modify

| File | Changes |
|------|---------|
| `app/api/simple-autopilot/route.ts` | Steps 1-3, 5-6: Logging, prompt improvement, validation, word limit, fallback |
| `lib/simple-style-selector.ts` | Step 4: Add banned phrase list and validation helper |

## Testing Plan

1. Run 10 generations and log raw Gemini responses
2. Verify JSON parsing succeeds
3. Check that textBottom is never "Life Style"
4. Check that textTop is ≤6 words and sounds like wearable copy
5. Verify imageDescription is specific to each trend

## Rollback Plan

If issues arise, revert to current behavior by:
- Removing validation checks
- Restoring original prompt
- Current fallback logic remains as safety net

## Success Criteria

- [ ] JSON parsing succeeds >95% of the time
- [ ] textBottom is unique and contextual (never "Life Style")
- [ ] textTop is ≤6 words and reads as wearable copy
- [ ] imageDescription varies per trend
- [ ] Generated prompts produce visually distinct designs

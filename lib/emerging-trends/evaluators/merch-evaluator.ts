/**
 * Emerging Trends Pipeline - Merch Opportunity Evaluator
 *
 * Uses Claude to evaluate whether a social signal represents a viable
 * merch opportunity. Extracts phrases, audience profile, and design hints.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  ScoredSignal,
  MerchEvaluationInput,
  MerchEvaluationResult,
  AudienceSize,
} from '../types';
import { log, logError } from '../config';

// =============================================================================
// CLAUDE CLIENT
// =============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// =============================================================================
// EVALUATION PROMPT
// =============================================================================

const EVALUATION_SYSTEM_PROMPT = `You are a merch opportunity analyst for Amazon Merch on Demand. Your job is to evaluate social media signals (Reddit posts, TikTok videos) and determine if they represent viable t-shirt design opportunities.

A GOOD merch opportunity has:
1. A clear, passionate audience (identity-based: "I'm a fishing dad", "I crochet")
2. Phrases or concepts that can be expressed on a t-shirt
3. Emotional resonance (humor, pride, identity, belonging)
4. No trademark/copyright issues

A BAD merch opportunity has:
- Generic topics without identity angle
- News/current events that will be stale
- Trademarked characters, brands, or IP
- Political/controversial content
- Content that's too niche with no searchable keywords

For each signal, provide:
1. Viability score (0-1) with reasoning
2. 3-5 potential t-shirt phrases (6 words max each)
3. Target audience description
4. Design style suggestions
5. Amazon safety assessment`;

function buildEvaluationPrompt(input: MerchEvaluationInput): string {
  const { signal, communityContext } = input;

  return `Evaluate this social media signal for t-shirt merch potential:

**Platform:** ${signal.platform}
**Community:** ${signal.community} ${signal.communitySize ? `(${signal.communitySize.toLocaleString()} members)` : ''}
**Title:** ${signal.title || 'N/A'}
**Content:** ${signal.content?.slice(0, 500) || 'N/A'}
**Engagement:** ${signal.upvotes} upvotes, ${signal.comments} comments
**Velocity Score:** ${signal.velocityScore.toFixed(2)} (${signal.velocityTier})
${communityContext ? `\n**Community Context:** ${communityContext}` : ''}

Respond in this exact JSON format:
{
  "isViable": true/false,
  "viabilityScore": 0.0-1.0,
  "viabilityReason": "Brief explanation",
  "topic": "Main topic/theme",
  "phrases": ["Phrase 1", "Phrase 2", "Phrase 3"],
  "keywords": ["keyword1", "keyword2"],
  "audience": "Brief audience description",
  "audienceProfile": "Detailed audience profile (demographics, interests, buying motivation)",
  "audienceSize": "micro/niche/medium/large/massive",
  "amazonSafe": true/false,
  "amazonSafeNotes": "Any concerns or notes",
  "suggestedStyles": ["style1", "style2"],
  "colorHints": ["color1", "color2"],
  "moodKeywords": ["mood1", "mood2"],
  "designNotes": "Additional design guidance"
}`;
}

// =============================================================================
// EVALUATION FUNCTION
// =============================================================================

/**
 * Evaluate a single signal for merch potential
 */
export async function evaluateSignal(
  input: MerchEvaluationInput
): Promise<MerchEvaluationResult | null> {
  if (!isClaudeConfigured()) {
    logError('Claude API not configured');
    return null;
  }

  try {
    log(`Evaluating signal: ${input.signal.title?.slice(0, 50) || input.signal.externalId}`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: EVALUATION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildEvaluationPrompt(input),
        },
      ],
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      logError('No text content in Claude response');
      return null;
    }

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logError('Could not extract JSON from Claude response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      isViable: Boolean(parsed.isViable),
      viabilityScore: Math.max(0, Math.min(1, Number(parsed.viabilityScore) || 0)),
      viabilityReason: String(parsed.viabilityReason || ''),
      topic: String(parsed.topic || ''),
      phrases: Array.isArray(parsed.phrases) ? parsed.phrases.map(String) : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
      audience: String(parsed.audience || ''),
      audienceProfile: String(parsed.audienceProfile || ''),
      audienceSize: validateAudienceSize(parsed.audienceSize),
      amazonSafe: Boolean(parsed.amazonSafe),
      amazonSafeNotes: parsed.amazonSafeNotes ? String(parsed.amazonSafeNotes) : undefined,
      suggestedStyles: Array.isArray(parsed.suggestedStyles) ? parsed.suggestedStyles.map(String) : [],
      colorHints: Array.isArray(parsed.colorHints) ? parsed.colorHints.map(String) : [],
      moodKeywords: Array.isArray(parsed.moodKeywords) ? parsed.moodKeywords.map(String) : [],
      designNotes: parsed.designNotes ? String(parsed.designNotes) : undefined,
    };

  } catch (error) {
    logError(`Failed to evaluate signal: ${input.signal.externalId}`, error);
    return null;
  }
}

/**
 * Evaluate multiple signals in batch
 */
export async function evaluateSignalsBatch(
  signals: ScoredSignal[],
  communityContext?: string,
  batchSize: number = 5
): Promise<Map<string, MerchEvaluationResult | null>> {
  const results = new Map<string, MerchEvaluationResult | null>();

  // Process in batches to avoid rate limits
  for (let i = 0; i < signals.length; i += batchSize) {
    const batch = signals.slice(i, i + batchSize);

    log(`Evaluating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(signals.length / batchSize)}`);

    // Evaluate batch concurrently
    const batchResults = await Promise.all(
      batch.map((signal) =>
        evaluateSignal({ signal, communityContext }).then((result) => ({
          id: signal.externalId,
          result,
        }))
      )
    );

    for (const { id, result } of batchResults) {
      results.set(id, result);
    }

    // Small delay between batches
    if (i + batchSize < signals.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * Filter signals that are worth evaluating
 */
export function filterForEvaluation(
  signals: ScoredSignal[],
  minViableTier: 'exploding' | 'rising' | 'steady' = 'steady'
): ScoredSignal[] {
  const tierOrder = ['exploding', 'rising', 'steady', 'normal'];
  const minIndex = tierOrder.indexOf(minViableTier);

  return signals.filter((signal) => {
    const tierIndex = tierOrder.indexOf(signal.velocityTier);
    return tierIndex <= minIndex;
  });
}

// =============================================================================
// HELPERS
// =============================================================================

function validateAudienceSize(value: unknown): AudienceSize {
  const valid: AudienceSize[] = ['micro', 'niche', 'medium', 'large', 'massive'];
  if (typeof value === 'string' && valid.includes(value as AudienceSize)) {
    return value as AudienceSize;
  }
  return 'medium'; // Default
}

/**
 * Quick pre-filter to avoid wasting API calls on obviously bad signals
 */
export function quickFilter(signals: ScoredSignal[]): ScoredSignal[] {
  return signals.filter((signal) => {
    const title = (signal.title || '').toLowerCase();
    const content = (signal.content || '').toLowerCase();
    const combined = title + ' ' + content;

    // Skip if contains trademark indicators
    if (/\b(disney|marvel|nike|apple|google|microsoft|pokemon|anime)\b/i.test(combined)) {
      return false;
    }

    // Skip if too political
    if (/\b(trump|biden|republican|democrat|election|congress)\b/i.test(combined)) {
      return false;
    }

    // Skip if news/current events
    if (/\b(breaking news|just announced|today's|this week's)\b/i.test(combined)) {
      return false;
    }

    // Skip if has no meaningful title
    if (!signal.title || signal.title.length < 10) {
      return false;
    }

    return true;
  });
}

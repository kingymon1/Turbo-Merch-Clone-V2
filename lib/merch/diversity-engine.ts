/**
 * Diversity Engine - Ensures Infinite Variety in Design Generation
 *
 * THE PROBLEM THIS SOLVES:
 * Without diversity tracking, the system generates the same 10-20 topics repeatedly.
 * "Coffee Then Adulting", "Dog Mom", "Nurse Life" over and over.
 *
 * THE SOLUTION:
 * 1. TRACK what was generated recently (don't repeat)
 * 2. DISCOVER new niches dynamically using AI (not hardcoded lists)
 * 3. SCORE novelty of ideas (prefer truly new things)
 * 4. EXPLORE periodically (force new territory)
 * 5. RESPOND to trends (what's happening NOW)
 *
 * This transforms the system from drinking from a thimble to tapping an ocean.
 */

import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// TYPES
// ============================================================================

export interface GenerationHistoryEntry {
  id: string;
  userId: string;
  phrase: string;
  niche: string;
  topic: string;
  generatedAt: Date;
  riskLevel: number;
  wasApproved?: boolean;
}

export interface DiversityScore {
  overall: number;           // 0-1, higher = more novel
  nicheNovelty: number;      // How different from recent niches
  phraseNovelty: number;     // How different from recent phrases
  topicNovelty: number;      // How different from recent topics
  timeSinceLastSimilar: number; // Hours since something similar
  recommendation: 'excellent' | 'good' | 'acceptable' | 'avoid';
}

export interface DiscoveredNiche {
  niche: string;
  description: string;
  audienceSize: 'massive' | 'large' | 'medium' | 'niche' | 'micro';
  trendDirection: 'exploding' | 'growing' | 'stable' | 'declining';
  competitionLevel: 'blue_ocean' | 'low' | 'medium' | 'high' | 'saturated';
  suggestedPhrases: string[];
  relatedNiches: string[];
  source: string;
  discoveredAt: Date;
}

export interface ExplorationResult {
  niche: string;
  topic: string;
  phrase: string;
  diversityScore: DiversityScore;
  source: 'discovered' | 'trending' | 'cross-pollinated' | 'random-walk' | 'ai-generated';
  confidence: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // How far back to look for repetition (hours)
  REPETITION_WINDOW_HOURS: 72,

  // Minimum diversity score to accept
  MIN_DIVERSITY_SCORE: 0.4,

  // How often to force exploration vs exploitation (0-1)
  EXPLORATION_RATE: 0.3,

  // Maximum times to retry for diversity
  MAX_DIVERSITY_RETRIES: 5,

  // Niche discovery settings
  NICHE_DISCOVERY_BATCH_SIZE: 20,
  MIN_NICHE_FRESHNESS_HOURS: 24,

  // Similarity thresholds
  PHRASE_SIMILARITY_THRESHOLD: 0.7,
  NICHE_COOLDOWN_HOURS: 4,
};

// ============================================================================
// GENERATION HISTORY TRACKING
// ============================================================================

/**
 * Record a generation in history for diversity tracking
 */
export async function recordGeneration(entry: {
  userId: string;
  phrase: string;
  niche: string;
  topic: string;
  riskLevel: number;
}): Promise<void> {
  try {
    await prisma.generationHistory.create({
      data: {
        userId: entry.userId,
        phrase: entry.phrase.toLowerCase(),
        niche: entry.niche.toLowerCase(),
        topic: entry.topic.toLowerCase(),
        riskLevel: entry.riskLevel,
        generatedAt: new Date(),
      }
    });
    console.log(`[Diversity] Recorded generation: "${entry.phrase}" in ${entry.niche}`);
  } catch (error) {
    // Table might not exist yet - fail silently
    console.warn('[Diversity] Could not record generation (table may not exist):', error);
  }
}

/**
 * Get recent generation history for a user (or global)
 */
export async function getRecentGenerations(
  userId?: string,
  hoursBack: number = CONFIG.REPETITION_WINDOW_HOURS
): Promise<GenerationHistoryEntry[]> {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  try {
    const where: any = {
      generatedAt: { gte: cutoff }
    };

    if (userId) {
      where.userId = userId;
    }

    const history = await prisma.generationHistory.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      take: 100
    });

    return history.map(h => ({
      id: h.id,
      userId: h.userId,
      phrase: h.phrase,
      niche: h.niche,
      topic: h.topic,
      generatedAt: h.generatedAt,
      riskLevel: h.riskLevel,
      wasApproved: h.wasApproved ?? undefined
    }));
  } catch (error) {
    console.warn('[Diversity] Could not fetch history:', error);
    return [];
  }
}

/**
 * Get recently used niches
 */
export async function getRecentNiches(
  userId?: string,
  hoursBack: number = CONFIG.NICHE_COOLDOWN_HOURS
): Promise<string[]> {
  const history = await getRecentGenerations(userId, hoursBack);
  const niches = new Set(history.map(h => h.niche.toLowerCase()));
  return Array.from(niches);
}

/**
 * Get recently used phrases
 */
export async function getRecentPhrases(
  userId?: string,
  hoursBack: number = CONFIG.REPETITION_WINDOW_HOURS
): Promise<string[]> {
  const history = await getRecentGenerations(userId, hoursBack);
  return history.map(h => h.phrase.toLowerCase());
}

// ============================================================================
// DIVERSITY SCORING
// ============================================================================

/**
 * Calculate how novel/diverse an idea is compared to recent generations
 */
export async function scoreDiversity(
  phrase: string,
  niche: string,
  topic: string,
  userId?: string
): Promise<DiversityScore> {
  const history = await getRecentGenerations(userId, CONFIG.REPETITION_WINDOW_HOURS);

  if (history.length === 0) {
    // No history = maximum novelty
    return {
      overall: 1.0,
      nicheNovelty: 1.0,
      phraseNovelty: 1.0,
      topicNovelty: 1.0,
      timeSinceLastSimilar: Infinity,
      recommendation: 'excellent'
    };
  }

  const normalizedPhrase = phrase.toLowerCase();
  const normalizedNiche = niche.toLowerCase();
  const normalizedTopic = topic.toLowerCase();

  // Calculate niche novelty
  const nicheHistory = history.filter(h => h.niche === normalizedNiche);
  const hoursSinceNiche = nicheHistory.length > 0
    ? (Date.now() - nicheHistory[0].generatedAt.getTime()) / (1000 * 60 * 60)
    : Infinity;
  const nicheNovelty = Math.min(1, hoursSinceNiche / CONFIG.NICHE_COOLDOWN_HOURS);

  // Calculate phrase novelty (using simple word overlap)
  let maxPhraseSimilarity = 0;
  for (const h of history) {
    const similarity = calculateWordOverlap(normalizedPhrase, h.phrase);
    maxPhraseSimilarity = Math.max(maxPhraseSimilarity, similarity);
  }
  const phraseNovelty = 1 - maxPhraseSimilarity;

  // Calculate topic novelty
  let maxTopicSimilarity = 0;
  for (const h of history) {
    const similarity = calculateWordOverlap(normalizedTopic, h.topic);
    maxTopicSimilarity = Math.max(maxTopicSimilarity, similarity);
  }
  const topicNovelty = 1 - maxTopicSimilarity;

  // Find time since last similar
  let timeSinceLastSimilar = Infinity;
  for (const h of history) {
    const phraseSim = calculateWordOverlap(normalizedPhrase, h.phrase);
    const nicheSim = h.niche === normalizedNiche ? 1 : 0;
    if (phraseSim > 0.5 || nicheSim > 0.5) {
      const hours = (Date.now() - h.generatedAt.getTime()) / (1000 * 60 * 60);
      timeSinceLastSimilar = Math.min(timeSinceLastSimilar, hours);
    }
  }

  // Calculate overall score (weighted average)
  const overall = (
    nicheNovelty * 0.3 +
    phraseNovelty * 0.4 +
    topicNovelty * 0.3
  );

  // Determine recommendation
  let recommendation: DiversityScore['recommendation'];
  if (overall >= 0.8) recommendation = 'excellent';
  else if (overall >= 0.6) recommendation = 'good';
  else if (overall >= CONFIG.MIN_DIVERSITY_SCORE) recommendation = 'acceptable';
  else recommendation = 'avoid';

  return {
    overall,
    nicheNovelty,
    phraseNovelty,
    topicNovelty,
    timeSinceLastSimilar,
    recommendation
  };
}

/**
 * Calculate word overlap between two strings (Jaccard similarity)
 */
function calculateWordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

// ============================================================================
// DYNAMIC NICHE DISCOVERY
// ============================================================================

/**
 * Discover new niches using AI
 * This replaces the hardcoded NICHE_POOLS with dynamic discovery
 */
export async function discoverNiches(options: {
  count?: number;
  excludeNiches?: string[];
  focusArea?: 'evergreen' | 'trending' | 'emerging' | 'seasonal' | 'random';
  riskLevel?: number;
}): Promise<DiscoveredNiche[]> {
  const {
    count = 10,
    excludeNiches = [],
    focusArea = 'random',
    riskLevel = 50
  } = options;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[Diversity] No Anthropic API key, falling back to expanded static niches');
    return getExpandedStaticNiches(count, excludeNiches, riskLevel);
  }

  const client = new Anthropic({ apiKey });

  // Get recent niches to exclude
  const recentNiches = await getRecentNiches(undefined, 24);
  const allExcluded = [...new Set([...excludeNiches, ...recentNiches])];

  const focusPrompt = getFocusPrompt(focusArea, riskLevel);

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are a t-shirt market research expert. Discover ${count} NEW niche markets for print-on-demand t-shirts.

${focusPrompt}

EXCLUDED NICHES (do NOT suggest these, they were used recently):
${allExcluded.slice(0, 30).join(', ') || 'None'}

Return ONLY valid JSON array with this structure:
[
  {
    "niche": "specific niche name (2-4 words)",
    "description": "who buys this and why",
    "audienceSize": "massive|large|medium|niche|micro",
    "trendDirection": "exploding|growing|stable|declining",
    "competitionLevel": "blue_ocean|low|medium|high|saturated",
    "suggestedPhrases": ["3-5 specific t-shirt phrases that would sell"],
    "relatedNiches": ["2-3 related niches for cross-pollination"]
  }
]

IMPORTANT RULES:
1. Be SPECIFIC - not "pets" but "reptile owners" or "hamster parents"
2. Think IDENTITY - who would PROUDLY wear this shirt?
3. Consider PASSION - what do people care deeply about?
4. Avoid generic niches - find the underserved micro-communities
5. Each niche must have real people who would buy

Examples of GOOD specific niches: "aquarium hobbyists", "night shift nurses", "plant propagation addicts", "amateur astronomers", "sourdough bakers", "pickleball players"

Examples of BAD generic niches: "sports fans", "food lovers", "music fans", "nature lovers"`
      }]
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response');
    }

    const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array in response');
    }

    const niches = JSON.parse(jsonMatch[0]) as any[];

    return niches.map(n => ({
      niche: n.niche,
      description: n.description,
      audienceSize: n.audienceSize,
      trendDirection: n.trendDirection,
      competitionLevel: n.competitionLevel,
      suggestedPhrases: n.suggestedPhrases || [],
      relatedNiches: n.relatedNiches || [],
      source: `ai-discovery-${focusArea}`,
      discoveredAt: new Date()
    }));

  } catch (error) {
    console.error('[Diversity] Niche discovery failed:', error);
    return getExpandedStaticNiches(count, allExcluded, riskLevel);
  }
}

/**
 * Get focus-specific prompt for niche discovery
 */
function getFocusPrompt(focusArea: string, riskLevel: number): string {
  const prompts: Record<string, string> = {
    evergreen: `Focus on EVERGREEN niches - timeless interests that people will care about for years.
Think: hobbies, professions, family roles, lifestyle choices, personality types.
Risk level: LOW - these should be safe, proven markets.`,

    trending: `Focus on TRENDING niches - what's hot RIGHT NOW in ${new Date().getFullYear()}.
Think: recent viral moments, new hobbies, emerging subcultures, zeitgeist topics.
Risk level: MEDIUM - ride the wave but don't chase fads.`,

    emerging: `Focus on EMERGING niches - things that are JUST starting to gain traction.
Think: new technologies, evolving identities, nascent communities, early adopter interests.
Risk level: HIGH - be ahead of the curve, accept some may not hit.`,

    seasonal: `Focus on SEASONAL opportunities for the current time of year (${getCurrentSeason()}).
Think: upcoming holidays, seasonal activities, weather-related interests.
Include the specific season/holiday in the niche context.`,

    random: `Explore DIVERSE, UNEXPECTED niches across all categories.
Mix of: professions, hobbies, identities, humor styles, regional interests, age groups.
Risk level: ${riskLevel < 30 ? 'LOW' : riskLevel < 70 ? 'MEDIUM' : 'HIGH'}`
  };

  return prompts[focusArea] || prompts.random;
}

/**
 * Get current season for seasonal niche discovery
 */
function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall/Autumn';
  return 'Winter/Holiday Season';
}

/**
 * Expanded static niches fallback (much larger than original 30)
 */
function getExpandedStaticNiches(
  count: number,
  exclude: string[],
  riskLevel: number
): DiscoveredNiche[] {
  // MASSIVE expansion from 30 to 300+ niches
  const allNiches = [
    // PROFESSIONS (50+)
    'nurse life', 'teacher appreciation', 'doctor humor', 'lawyer jokes', 'accountant life',
    'engineer mindset', 'software developer', 'data scientist', 'project manager', 'hr professional',
    'social worker', 'therapist life', 'firefighter pride', 'police officer', 'paramedic ems',
    'veterinarian', 'pharmacist', 'dental hygienist', 'physical therapist', 'occupational therapist',
    'speech pathologist', 'school counselor', 'librarian', 'chef life', 'bartender humor',
    'server life', 'retail worker', 'warehouse worker', 'truck driver', 'pilot aviation',
    'flight attendant', 'real estate agent', 'insurance agent', 'financial advisor', 'electrician',
    'plumber pride', 'hvac technician', 'mechanic life', 'welder', 'carpenter',
    'construction worker', 'landscaper', 'farmer life', 'rancher', 'fisherman commercial',

    // HOBBIES & INTERESTS (80+)
    'fishing enthusiast', 'hunting life', 'camping lover', 'hiking addict', 'rock climbing',
    'kayaking', 'paddleboarding', 'surfing life', 'skiing snowboarding', 'snowmobiling',
    'atv riding', 'motorcycle rider', 'car enthusiast', 'jeep life', 'truck lover',
    'woodworking', 'metalworking', 'blacksmithing', 'pottery ceramics', 'knitting crochet',
    'quilting', 'sewing crafts', 'scrapbooking', 'painting art', 'photography',
    'gardening', 'plant parent', 'succulent lover', 'houseplant addict', 'vegetable gardening',
    'birdwatching', 'amateur astronomy', 'coin collecting', 'stamp collecting', 'vinyl records',
    'board games', 'dungeons dragons', 'video gaming', 'pc gaming', 'console gaming',
    'retro gaming', 'chess player', 'poker player', 'bowling', 'golf life',
    'tennis player', 'pickleball', 'basketball fan', 'football fan', 'baseball fan',
    'soccer fan', 'hockey fan', 'wrestling fan', 'mma fan', 'boxing fan',
    'running', 'marathon runner', 'triathlon', 'crossfit', 'weightlifting',
    'yoga practice', 'pilates', 'meditation', 'journaling', 'bullet journal',
    'book lover', 'audiobook addict', 'true crime fan', 'horror fan', 'sci-fi fan',
    'fantasy reader', 'romance reader', 'anime fan', 'manga reader', 'kpop fan',
    'disney adult', 'harry potter fan', 'star wars fan', 'marvel fan', 'dc comics',
    'cosplay', 'renaissance faire', 'larp', 'escape rooms', 'axe throwing',

    // FOOD & DRINK (30+)
    'coffee addict', 'tea lover', 'wine enthusiast', 'craft beer', 'whiskey bourbon',
    'cocktail lover', 'home bartender', 'bbq pitmaster', 'smoking meats', 'grilling',
    'sourdough baker', 'bread baking', 'cake decorating', 'home cook', 'meal prep',
    'keto diet', 'vegan lifestyle', 'vegetarian', 'foodie', 'hot sauce lover',
    'cheese lover', 'chocolate addict', 'pizza enthusiast', 'taco lover', 'sushi fan',
    'ramen lover', 'instant pot', 'air fryer', 'cast iron cooking', 'sous vide',

    // FAMILY & RELATIONSHIPS (40+)
    'mom life', 'dad life', 'parent humor', 'grandma life', 'grandpa pride',
    'twin parent', 'boy mom', 'girl dad', 'bonus mom', 'stepdad',
    'single mom', 'single dad', 'foster parent', 'adoptive parent', 'new parent',
    'toddler parent', 'teen parent', 'empty nester', 'dog mom', 'dog dad',
    'cat mom', 'cat dad', 'crazy cat lady', 'multi-pet household', 'reptile owner',
    'bird owner', 'fish keeper', 'horse girl', 'chicken keeper', 'goat parent',
    'wife life', 'husband humor', 'married life', 'newlywed', 'anniversary',
    'sister bond', 'brother bond', 'best friend', 'military spouse', 'first responder family',

    // PERSONALITY & LIFESTYLE (40+)
    'introvert life', 'extrovert energy', 'ambivert', 'night owl', 'early bird',
    'overthinker', 'anxious but cute', 'adhd brain', 'autism awareness', 'dyslexia',
    'chronic illness', 'spoonie life', 'mental health', 'therapy humor', 'self care',
    'sarcasm lover', 'dry humor', 'dark humor', 'pun lover', 'dad jokes',
    'work from home', 'remote worker', 'digital nomad', 'freelancer', 'side hustle',
    'entrepreneur', 'small business', 'boss babe', 'girl boss', 'hustle culture',
    'minimalist', 'maximalist', 'cottagecore', 'dark academia', 'goblincore',
    'plant witch', 'cottage witch', 'book witch', 'astrology lover', 'tarot reader',

    // LIFE STAGES & MILESTONES (20+)
    'class of 2025', 'college student', 'grad school', 'phd life', 'first gen college',
    'retirement', 'turning 30', 'turning 40', 'turning 50', 'over the hill',
    'birthday month', 'bridesmaid', 'maid of honor', 'bachelor party', 'bachelorette',

    // REGIONAL & CULTURAL (30+)
    'texas pride', 'florida life', 'california dreaming', 'midwest nice', 'southern charm',
    'new york state', 'pacific northwest', 'mountain west', 'new england', 'alaska life',
    'hawaii aloha', 'small town', 'country life', 'farm life', 'city life',
    'beach life', 'lake life', 'river life', 'mountain life', 'desert life',
    'latino pride', 'black excellence', 'asian american', 'indigenous pride', 'irish heritage',
    'italian american', 'german heritage', 'polish pride', 'greek heritage', 'jewish humor',

    // HUMOR STYLES (20+)
    'millennial humor', 'gen z energy', 'boomer humor', 'gen x vibes', 'elder millennial',
    'internet culture', 'meme lord', 'chronically online', 'touch grass', 'unhinged energy',
    'chaotic good', 'lawful evil', 'petty energy', 'unbothered', 'main character',
    'villain era', 'soft life', 'feral energy', 'frog and toad', 'goblin mode',
  ];

  // Filter out excluded and recently used
  const excludeSet = new Set(exclude.map(e => e.toLowerCase()));
  const available = allNiches.filter(n => !excludeSet.has(n.toLowerCase()));

  // Shuffle and take requested count
  const shuffled = available.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  return selected.map(niche => ({
    niche,
    description: `People who identify with ${niche}`,
    audienceSize: 'medium' as const,
    trendDirection: 'stable' as const,
    competitionLevel: 'medium' as const,
    suggestedPhrases: [],
    relatedNiches: [],
    source: 'expanded-static',
    discoveredAt: new Date()
  }));
}

// ============================================================================
// EXPLORATION ENGINE
// ============================================================================

/**
 * Generate a diverse exploration result
 * This is the main entry point for getting novel design ideas
 */
export async function exploreForDiversity(options: {
  userId?: string;
  riskLevel: number;
  forceExploration?: boolean;
  excludeNiches?: string[];
}): Promise<ExplorationResult | null> {
  const {
    userId,
    riskLevel,
    forceExploration = false,
    excludeNiches = []
  } = options;

  // Decide whether to explore or exploit
  const shouldExplore = forceExploration || Math.random() < CONFIG.EXPLORATION_RATE;

  console.log(`[Diversity] ${shouldExplore ? 'EXPLORING' : 'EXPLOITING'} at risk level ${riskLevel}`);

  // Get recent data
  const recentNiches = await getRecentNiches(userId, CONFIG.NICHE_COOLDOWN_HOURS);
  const allExcluded = [...new Set([...excludeNiches, ...recentNiches])];

  // Discover fresh niches
  const focusArea = determineFocusArea(riskLevel, shouldExplore);
  const discoveredNiches = await discoverNiches({
    count: 15,
    excludeNiches: allExcluded,
    focusArea,
    riskLevel
  });

  if (discoveredNiches.length === 0) {
    console.warn('[Diversity] No niches discovered');
    return null;
  }

  // Try each niche until we find one with good diversity
  for (let attempt = 0; attempt < CONFIG.MAX_DIVERSITY_RETRIES; attempt++) {
    // Select a niche (weighted by freshness and competition)
    const selectedNiche = selectNicheWeighted(discoveredNiches, riskLevel);

    // Select or generate a phrase
    const phrase = selectedNiche.suggestedPhrases.length > 0
      ? selectedNiche.suggestedPhrases[Math.floor(Math.random() * selectedNiche.suggestedPhrases.length)]
      : await generatePhraseForNiche(selectedNiche.niche, riskLevel);

    // Score diversity
    const diversityScore = await scoreDiversity(
      phrase,
      selectedNiche.niche,
      selectedNiche.niche, // Use niche as topic for now
      userId
    );

    if (diversityScore.overall >= CONFIG.MIN_DIVERSITY_SCORE) {
      console.log(`[Diversity] Found diverse option: "${phrase}" in ${selectedNiche.niche} (score: ${diversityScore.overall.toFixed(2)})`);

      return {
        niche: selectedNiche.niche,
        topic: selectedNiche.niche,
        phrase,
        diversityScore,
        source: selectedNiche.source.startsWith('ai') ? 'ai-generated' : 'discovered',
        confidence: diversityScore.overall
      };
    }

    console.log(`[Diversity] Attempt ${attempt + 1}: "${phrase}" rejected (score: ${diversityScore.overall.toFixed(2)})`);

    // Remove this niche from consideration
    const index = discoveredNiches.findIndex(n => n.niche === selectedNiche.niche);
    if (index !== -1) discoveredNiches.splice(index, 1);

    if (discoveredNiches.length === 0) break;
  }

  // Fallback: just use the best we have
  console.warn('[Diversity] Could not find highly diverse option, using best available');
  const fallbackNiche = discoveredNiches[0] || { niche: 'general humor', suggestedPhrases: ['Living My Best Life'] };
  const fallbackPhrase = fallbackNiche.suggestedPhrases[0] || 'Living My Best Life';

  return {
    niche: fallbackNiche.niche,
    topic: fallbackNiche.niche,
    phrase: fallbackPhrase,
    diversityScore: await scoreDiversity(fallbackPhrase, fallbackNiche.niche, fallbackNiche.niche, userId),
    source: 'discovered',
    confidence: 0.3
  };
}

/**
 * Determine focus area based on risk level and exploration mode
 */
function determineFocusArea(riskLevel: number, exploring: boolean): 'evergreen' | 'trending' | 'emerging' | 'seasonal' | 'random' {
  if (exploring) {
    // When exploring, be more adventurous
    const roll = Math.random();
    if (roll < 0.3) return 'emerging';
    if (roll < 0.5) return 'trending';
    if (roll < 0.7) return 'seasonal';
    return 'random';
  }

  // Normal mode: base on risk level
  if (riskLevel < 30) return 'evergreen';
  if (riskLevel < 50) return 'random';
  if (riskLevel < 70) return 'trending';
  return 'emerging';
}

/**
 * Select a niche with weighting based on opportunity
 */
function selectNicheWeighted(niches: DiscoveredNiche[], riskLevel: number): DiscoveredNiche {
  // Weight by competition level and trend direction
  const weights = niches.map(n => {
    let weight = 1;

    // Prefer blue ocean / low competition
    if (n.competitionLevel === 'blue_ocean') weight *= 3;
    else if (n.competitionLevel === 'low') weight *= 2;
    else if (n.competitionLevel === 'saturated') weight *= 0.3;

    // Prefer growing/exploding trends for higher risk
    if (riskLevel > 50) {
      if (n.trendDirection === 'exploding') weight *= 2;
      else if (n.trendDirection === 'growing') weight *= 1.5;
    } else {
      // Prefer stable for lower risk
      if (n.trendDirection === 'stable') weight *= 1.5;
    }

    return weight;
  });

  // Weighted random selection
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < niches.length; i++) {
    random -= weights[i];
    if (random <= 0) return niches[i];
  }

  return niches[0];
}

/**
 * Generate a phrase for a niche using AI
 */
async function generatePhraseForNiche(niche: string, riskLevel: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return generateFallbackPhrase(niche);
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Generate ONE short, punchy t-shirt phrase for the "${niche}" niche.

Requirements:
- 2-5 words
- Would look great on a t-shirt
- Resonates with the ${niche} community
- ${riskLevel > 70 ? 'Can be edgy/viral' : riskLevel > 30 ? 'Clever but safe' : 'Family-friendly and evergreen'}

Return ONLY the phrase, no quotes, no explanation.`
      }]
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (textContent && textContent.type === 'text') {
      return textContent.text.trim().replace(/^["']|["']$/g, '');
    }
  } catch (error) {
    console.warn('[Diversity] Phrase generation failed:', error);
  }

  return generateFallbackPhrase(niche);
}

/**
 * Generate a fallback phrase without AI
 */
function generateFallbackPhrase(niche: string): string {
  const templates = [
    `${niche} Life`,
    `Proud ${niche}`,
    `${niche} Mode`,
    `Living That ${niche} Life`,
    `${niche} Vibes Only`,
  ];

  const template = templates[Math.floor(Math.random() * templates.length)];

  // Capitalize words properly
  return template
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// CROSS-POLLINATION
// ============================================================================

/**
 * Generate cross-pollinated ideas by combining niches
 */
export async function crossPollinateNiches(
  nicheA: string,
  nicheB: string
): Promise<{ phrase: string; concept: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Create a t-shirt design concept that combines these two niches:
- Niche A: ${nicheA}
- Niche B: ${nicheB}

The design should appeal to someone who identifies with BOTH communities.

Return JSON:
{
  "phrase": "2-5 word t-shirt text",
  "concept": "brief description of why this works"
}

Only return the JSON, nothing else.`
      }]
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (textContent && textContent.type === 'text') {
      const parsed = JSON.parse(textContent.text);
      return {
        phrase: parsed.phrase,
        concept: parsed.concept
      };
    }
  } catch (error) {
    console.warn('[Diversity] Cross-pollination failed:', error);
  }

  return null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // History tracking
  recordGeneration,
  getRecentGenerations,
  getRecentNiches,
  getRecentPhrases,

  // Diversity scoring
  scoreDiversity,

  // Niche discovery
  discoverNiches,

  // Exploration
  exploreForDiversity,

  // Cross-pollination
  crossPollinateNiches,
};

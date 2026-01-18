/**
 * Emerging Trends Pipeline - Community Discovery Scraper
 *
 * Discovers new communities to monitor by analyzing related subreddits,
 * cross-posts, and user activity patterns.
 */

import { getDecodoClient } from '../client/decodo-client';
import { Platform, CommunityCategory, DiscoveredCommunityData } from '../types';
import { SEED_COMMUNITIES, log, logError, logWarn } from '../config';

// =============================================================================
// TYPES
// =============================================================================

interface DiscoveryResult {
  success: boolean;
  communities: DiscoveredCommunityData[];
  error?: string;
}

// =============================================================================
// DISCOVERY METHODS
// =============================================================================

/**
 * Get seed communities to start discovery from
 */
export function getSeedCommunities(): DiscoveredCommunityData[] {
  return SEED_COMMUNITIES.map((seed) => ({
    platform: seed.platform,
    name: seed.name,
    category: seed.category,
    merchPotential: seed.merchPotential,
  }));
}

/**
 * Discover related subreddits from a source subreddit
 *
 * This scrapes the subreddit sidebar and looks for related communities.
 */
export async function discoverRelatedSubreddits(
  sourceSubreddit: string
): Promise<DiscoveryResult> {
  const client = getDecodoClient();

  if (!client.isConfigured()) {
    return {
      success: false,
      communities: [],
      error: 'Decodo API not configured',
    };
  }

  try {
    log(`Discovering related subreddits from r/${sourceSubreddit}`);

    // Scrape the subreddit about page which often lists related communities
    const aboutUrl = `https://www.reddit.com/r/${sourceSubreddit}/about.json`;
    const results = await client.scrape({
      target: 'universal',
      url: aboutUrl,
      parse: false,
      markdown: true,
    });

    if (!results.length || !results[0].content) {
      logWarn(`No about data for r/${sourceSubreddit}`);
      return {
        success: false,
        communities: [],
        error: 'No about data available',
      };
    }

    const content = results[0].content;
    const communities: DiscoveredCommunityData[] = [];

    // Extract subreddit mentions from content
    const subredditPattern = /r\/([a-zA-Z0-9_]+)/g;
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const matches = contentStr.matchAll(subredditPattern);

    const seen = new Set<string>();
    seen.add(sourceSubreddit.toLowerCase());

    for (const match of matches) {
      const name = match[1].toLowerCase();

      // Skip if already seen or is the source
      if (seen.has(name)) continue;
      seen.add(name);

      // Skip common non-community subreddits
      if (isCommonSubreddit(name)) continue;

      communities.push({
        platform: 'reddit',
        name,
        discoveredBy: 'expansion',
        discoveredFrom: sourceSubreddit,
      });
    }

    log(`Discovered ${communities.length} related subreddits from r/${sourceSubreddit}`);

    return {
      success: true,
      communities,
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Failed to discover from r/${sourceSubreddit}`, error);
    return {
      success: false,
      communities: [],
      error: message,
    };
  }
}

/**
 * Discover communities using AI suggestion
 *
 * Uses Claude to suggest related communities based on category and interests.
 */
export async function discoverCommunitiesWithAI(
  category: CommunityCategory,
  interests: string[]
): Promise<DiscoveredCommunityData[]> {
  // This would call Claude API to get suggestions
  // For now, return category-based suggestions from our knowledge

  const suggestions = getCategorySuggestions(category);

  return suggestions.map((name) => ({
    platform: 'reddit' as Platform,
    name,
    category,
    discoveredBy: 'ai-suggestion',
  }));
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if a subreddit name is a common/utility subreddit we should skip
 */
function isCommonSubreddit(name: string): boolean {
  const commonNames = [
    'announcements',
    'all',
    'popular',
    'random',
    'blog',
    'admin',
    'help',
    'reddit',
    'pics',
    'funny',
    'askreddit',
    'todayilearned',
    'worldnews',
    'news',
    'videos',
    'gaming',
    'movies',
    'music',
    'aww',
    'science',
    'iama',
    'mildlyinteresting',
    'showerthoughts',
    'jokes',
    'gifs',
    'nottheonion',
    'earthporn',
    'oldschoolcool',
    'food',
    'diy',
    'space',
    'art',
    'gadgets',
    'sports',
    'documentaries',
    'listentothis',
    'history',
    'nosleep',
    'books',
    'creepy',
    'twoxchromosomes',
    'television',
    'photoshopbattles',
    'upliftingnews',
    'explainlikeimfive',
    'fitness', // generic
    'getmotivated',
    'personalfinance',
    'dataisbeautiful',
  ];

  return commonNames.includes(name.toLowerCase());
}

/**
 * Get category-based subreddit suggestions
 */
function getCategorySuggestions(category: CommunityCategory): string[] {
  const suggestions: Record<CommunityCategory, string[]> = {
    hobby: ['hobbies', 'crafting', 'diy', 'maker'],
    profession: ['careerguidance', 'jobs', 'antiwork'],
    lifestyle: ['simpleliving', 'minimalism', 'zerowaste'],
    fandom: ['fanart', 'cosplay', 'collectibles'],
    sports: ['sportsbetting', 'fantasyFootball', 'mma', 'nfl', 'nba'],
    pets: ['pets', 'aww', 'dogtraining', 'cats', 'aquariums'],
    family: ['parenting', 'family', 'marriage', 'pregnant'],
    food: ['cooking', 'recipes', 'mealprep', 'baking', 'slowcooking'],
    fitness: ['bodyweightfitness', 'loseit', 'gainit', 'strength_training'],
    gaming: ['pcgaming', 'ps5', 'nintendo', 'indiegaming', 'patientgamers'],
    crafts: ['sewing', 'leathercraft', 'pottery', 'jewelry', 'beading'],
    outdoors: ['campingandhiking', 'survival', 'bushcraft', 'fishing', 'overlanding'],
    music: ['wearethemusicmakers', 'guitar', 'bass', 'piano', 'synthesizers'],
    art: ['digitalart', 'painting', 'drawing', 'watercolor', 'streetart'],
    tech: ['homelab', 'selfhosted', 'mechanicalkeyboards', 'buildapc'],
    other: [],
  };

  return suggestions[category] || [];
}

/**
 * Estimate merch potential for a discovered community
 */
export function estimateMerchPotential(
  name: string,
  category?: CommunityCategory,
  size?: number
): number {
  let score = 0.5; // Base score

  // Category bonus
  const highMerchCategories: CommunityCategory[] = ['profession', 'hobby', 'pets', 'family', 'crafts', 'outdoors'];
  if (category && highMerchCategories.includes(category)) {
    score += 0.2;
  }

  // Size sweet spot (10k - 500k is ideal)
  if (size) {
    if (size >= 10000 && size <= 500000) {
      score += 0.15;
    } else if (size >= 5000 && size <= 1000000) {
      score += 0.1;
    } else if (size < 1000) {
      score -= 0.2; // Too small
    } else if (size > 5000000) {
      score -= 0.1; // Too generic
    }
  }

  // Name-based heuristics
  const highMerchKeywords = ['dad', 'mom', 'fishing', 'hunting', 'nurse', 'teacher', 'coffee', 'dog', 'cat', 'craft'];
  const lowMerchKeywords = ['news', 'politics', 'advice', 'help', 'questions', 'meta'];

  const nameLower = name.toLowerCase();
  if (highMerchKeywords.some((kw) => nameLower.includes(kw))) {
    score += 0.15;
  }
  if (lowMerchKeywords.some((kw) => nameLower.includes(kw))) {
    score -= 0.2;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Categorize a subreddit based on its name
 */
export function categorizeSubreddit(name: string): CommunityCategory {
  const nameLower = name.toLowerCase();

  // Profession patterns
  if (/nurse|teacher|firefight|ems|truck|electric|plumb|carpent|weld|mechanic/.test(nameLower)) {
    return 'profession';
  }

  // Pet patterns
  if (/dog|cat|pet|aquarium|fish|bird|reptile|hamster|rabbit|chicken|bee/.test(nameLower)) {
    return 'pets';
  }

  // Family patterns
  if (/dad|mom|parent|grandparent|family|pregnan|baby|toddler/.test(nameLower)) {
    return 'family';
  }

  // Craft patterns
  if (/crochet|knit|sew|quilt|embroider|craft|woodwork|leather|pottery/.test(nameLower)) {
    return 'crafts';
  }

  // Outdoor patterns
  if (/fish|hunt|hik|camp|kayak|canoe|climb|backpack|outdoor|survival/.test(nameLower)) {
    return 'outdoors';
  }

  // Fitness patterns
  if (/fit|gym|run|crossfit|yoga|lift|bodyweight|strength/.test(nameLower)) {
    return 'fitness';
  }

  // Food patterns
  if (/cook|bak|bbq|grill|coffee|tea|beer|wine|homebrew|recipe/.test(nameLower)) {
    return 'food';
  }

  // Gaming patterns
  if (/game|gaming|nintendo|playstation|xbox|pc|esport|stream/.test(nameLower)) {
    return 'gaming';
  }

  // Music patterns
  if (/guitar|drum|piano|bass|music|band|vinyl|audio/.test(nameLower)) {
    return 'music';
  }

  // Art patterns
  if (/art|paint|draw|sketch|digital|photo|design/.test(nameLower)) {
    return 'art';
  }

  // Sports patterns
  if (/nfl|nba|mlb|hockey|soccer|football|basketball|baseball/.test(nameLower)) {
    return 'sports';
  }

  return 'hobby'; // Default fallback
}

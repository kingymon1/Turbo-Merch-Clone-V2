/**
 * Trend Search Prompt Builder
 *
 * Constructs the main prompt for Gemini trend research.
 * Extracted from geminiService.ts for better maintainability.
 */

export interface TrendSearchPromptParams {
  date: {
    fullDate: string;
    year: number;
    month: string;
  };
  niche: string;
  viralityLevel: number;
  googleData: string;    // NEW: Independent Google Search agent data
  braveData: string;
  grokData: string;
  rabbitHoleData: string;
  marketplaceData: string; // NEW: Amazon/Etsy marketplace intelligence
  isDiscovery: boolean;
}

/**
 * Get the strategy context based on virality level
 */
export function getStrategyContext(viralityLevel: number): string {
  if (viralityLevel <= 25) {
    return `
STRATEGY: MAINSTREAM (Safe Bets)
- Look for established trends with proven demand
- High search volume, existing products on Amazon
- Focus on broad appeal and timeless themes
- Customer language should be widely understood`;
  } else if (viralityLevel <= 50) {
    return `
STRATEGY: RISING (Sweet Spot)
- Look for breakout trends gaining momentum
- Growing search interest, emerging on social media
- Balance novelty with marketability
- Customer language is becoming mainstream`;
  } else if (viralityLevel <= 75) {
    return `
STRATEGY: UNDERGROUND (Early Adopter)
- Look for niche communities with passionate fans
- Low competition, insider language
- Find trends before they go mainstream
- Customer language may be unfamiliar to outsiders`;
  } else {
    return `
STRATEGY: PREDICTIVE (Blue Ocean)
- Look for emerging patterns others haven't spotted
- Mashups, crossovers, unexpected combinations
- High risk, high reward potential
- Create new customer language from synthesis`;
  }
}

/**
 * Build the main trend search prompt
 */
export function buildTrendSearchPrompt(params: TrendSearchPromptParams): string {
  const { date, niche, viralityLevel, googleData, braveData, grokData, rabbitHoleData, marketplaceData, isDiscovery } = params;
  const strategyContext = getStrategyContext(viralityLevel);

  const modeSection = isDiscovery
    ? `
MODE: DISCOVERY SCAN
Find 4-6 diverse trending topics that are CURRENTLY active (${date.month} ${date.year}).
Look across different niches and audiences.
`
    : `
MODE: DEEP DIVE
Thoroughly analyze "${niche}" and find 3-5 specific angles or sub-topics.
Go deep into the community's language and visual culture.
`;

  return `
You are the LEAD RESEARCHER coordinating a team meeting.

TODAY'S DATE: ${date.fullDate}
QUERY: "${niche}"
VIRALITY LEVEL: ${viralityLevel}% (0=mainstream, 100=predictive)

${strategyContext}

═══════════════════════════════════════════════════════════════
⚠️ CRITICAL: YOU MUST ONLY USE DATA FROM AGENT REPORTS BELOW ⚠️
═══════════════════════════════════════════════════════════════

You are STRICTLY FORBIDDEN from:
- Making up trends from your training data
- Suggesting generic evergreen topics (like "coffee lovers", "dog mom", "gym motivation")
- Inventing customer quotes that aren't in the agent reports
- Suggesting topics that don't have SPECIFIC citations from the reports below

⚠️ MANDATORY EXCLUSIONS - DO NOT RETURN THESE TREND TYPES ⚠️

**TRADEMARKED BRANDS (ILLEGAL TO USE):**
- Video games: Roblox, Minecraft, Fortnite, Call of Duty, Pokemon, Mario, Zelda, etc.
- Streaming: Netflix, Disney, Marvel, DC Comics, Star Wars, etc.
- Sports teams: NFL, NBA, MLB teams and logos
- Tech brands: Apple, Google, Microsoft, etc.
- Any brand name, logo, or trademarked character

**INTERNET CULTURE (DOESN'T WORK FOR T-SHIRTS):**
- Tumblr aesthetic / Tumblr core / Tumblr revival
- Vaporwave / synthwave / retrowave / outrun
- Y2K aesthetic / Y2K revival / 2000s internet nostalgia
- Internet nostalgia (old websites, dial-up, AIM, MySpace, etc.)
- Meme formats / meme templates / "me when" / reaction images
- Discord/Reddit/4chan culture or in-jokes
- AI art discourse / AI ethics / tech industry drama
- Crypto/NFT/Web3 culture
- Screen-based imagery (old computers, CRT monitors, Windows 95, etc.)
- "Aesthetic" as a trend itself (cottagecore, dark academia, etc. are often too niche)
- Platform-specific trends (TikTok sounds, Twitter discourse, etc.)
- Gaming culture, UGC, gamer terminology

WHY: These produce designs with screens, computers, UI elements, or overly-niche references that don't translate to wearable t-shirts. We need PHYSICAL WORLD trends.

PREFER trends about:
- Sports, fitness, outdoor activities
- Hobbies (fishing, gardening, cooking, crafts)
- Professions and occupations
- Animals and pets
- Family roles (dad, mom, grandpa, etc.)
- Music genres and artists
- Movies, TV shows, books
- Locations and travel
- Food and drink culture
- Holidays and seasonal events
- Causes and social movements

If an agent says "No data available" - that source provides ZERO trends.
You can ONLY extract trends that have REAL citations and quotes from the live search results below.

═══════════════════════════════════════════════════════════════
INTELLIGENCE REPORTS FROM YOUR 3 AGENTS
(Each agent searched INDEPENDENTLY - cross-reference their findings)
═══════════════════════════════════════════════════════════════

--- GOOGLE AGENT (News & Current Events) ---
${googleData || "GOOGLE AGENT: No data available - DO NOT invent trends from this source"}

--- BRAVE AGENT (Web Search & Discussions) ---
${braveData || "BRAVE AGENT: No data available - DO NOT invent trends from this source"}

--- GROK AGENT (Live X/Twitter & Social) ---
${grokData || "GROK AGENT: No data available - DO NOT invent trends from this source"}

--- RABBIT HOLE (Deep Exploration) ---
${rabbitHoleData || "RABBIT HOLE: No deep dive conducted"}

${marketplaceData ? `
═══════════════════════════════════════════════════════════════
MARKETPLACE INTELLIGENCE (Amazon/Etsy)
═══════════════════════════════════════════════════════════════

${marketplaceData}
` : ''}

═══════════════════════════════════════════════════════════════
YOUR TASK: SYNTHESIZE FROM ALL AVAILABLE DATA
═══════════════════════════════════════════════════════════════

Cross-reference all 3 agent findings and identify the BEST opportunities.

⚠️ MANDATORY VERIFICATION FOR EACH TREND:
- Can you point to a SPECIFIC URL or quote from the agent reports above?
- If NO - do NOT include that trend
- Every trend MUST have at least one real source from the reports

STRATEGY FOR THIS SESSION (Virality: ${viralityLevel}%):
${viralityLevel >= 55
  ? `
  **PRIORITY: HIGH SIGNAL & UNIQUE DISCOVERIES**
  - We are looking for "Breakout" and "Predictive" trends.
  - **DO NOT** filter for consensus. If only ONE agent found a strong signal (e.g., a specific Reddit thread), **INCLUDE IT**.
  - Value "Intensity of Engagement" over "Number of Sources".
  - It is better to be EARLY and RIGHT about a niche topic than late and safe with a generic one.
  `
  : `
  **PRIORITY: HIGH CONFIDENCE & CONSENSUS**
  - We are looking for "Safe" and "Rising" trends.
  - Prioritize topics mentioned by **MULTIPLE** agents.
  - Look for corroborating evidence across different platforms.
  - Discard unverified or single-source outliers.
  `
}

VALIDATION CHECKLIST:
✓ Is this trend actually from ${date.month} ${date.year}?
✓ Does it have current sources/citations FROM THE AGENT REPORTS ABOVE?
✓ Would someone searching TODAY find this relevant?
✓ Is there evidence of real community engagement IN THE REPORTS?
✓ Can you quote the EXACT source from the agent data?

${viralityLevel >= 55 ? "When in doubt, prefer FRESH/UNIQUE over POPULAR/CONSENSUS." : "When in doubt, prefer PROVEN/POPULAR over UNVERIFIED."}

═══════════════════════════════════════════════════════════════
EXTRACTION REQUIREMENTS
═══════════════════════════════════════════════════════════════

Based on ALL intelligence (your agents + your own research), identify the BEST opportunities for t-shirt designs.

For each trend, you MUST extract:

1. **CUSTOMER LANGUAGE** (Most Important!)
   - EXACT phrases people use (not summaries)
   - Slang, idioms, catchphrases specific to this community
   - How they'd describe themselves wearing this
   - "I'd buy this" signals

2. **VISUAL PREFERENCES**
   - What aesthetic appeals to this audience?
   - Streetwear? Vintage? Minimalist? Meme culture?
   - Colors, effects, typography they respond to
   - Reference visual styles they mention or share

3. **DESIGN DIRECTION**
   - What typography would resonate? (Bold? Hand-drawn? Retro?)
   - What imagery fits? (Icons? Illustrations? Text-only?)
   - What effects suit the vibe? (Distressed? Clean? Neon?)
   - Placement and size appropriate for this audience

4. **SHIRT COLOR RECOMMENDATION**
   - What shirt color would this design work BEST on?
   - Consider: audience preferences, design contrast, commercial appeal
   - Black: streetwear, edgy, bold graphics, white/bright design elements
   - White: clean, minimalist, colorful designs, vintage feel
   - Navy: classic, professional, subtle designs
   - Heather Grey: casual, everyday wear, detailed illustrations
   - Choose based on what THIS specific audience would actually buy

5. **AMAZON MERCH VIABILITY**
   - Is this safe for print-on-demand?
   - No trademark/copyright issues
   - Has commercial appeal

${modeSection}

CRITICAL REQUIREMENTS:
- ONLY include trends active in ${date.year} - reject anything from previous years
- Extract REAL customer phrases, not generic descriptions
- Be specific about visual/design direction
- Consider what would actually sell on Amazon

Return JSON Array:
[
  {
    "topic": "string - specific trend name",
    "platform": "string - where this trend lives (TikTok, Reddit, Twitter, etc.)",
    "volume": "High" | "Breakout" | "Rising" | "Predictive",
    "sentiment": "string - the emotional vibe (ironic, sincere, rebellious, wholesome, etc.)",
    "keywords": ["array of search/SEO keywords"],
    "description": "string - detailed description of the trend and who's into it",
    "visualStyle": "string - detailed visual direction for design",
    "typographyStyle": "string - specific typography recommendations",
    "designStyle": "string - streetwear/vintage/minimalist/meme/etc.",
    "colorPalette": "string - recommended colors and why",
    "designEffects": ["array of effects: distressed, clean, gradient, halftone, etc."],
    "customerPhrases": ["array of EXACT phrases customers use - this is critical"],
    "purchaseSignals": ["array of quotes showing buying intent"],
    "designText": "string - 2-5 words that would work ON the shirt",
    "audienceProfile": "string - who is this person? age, interests, values",
    "recommendedShirtColor": "string - black, white, navy, or heather grey",
    "shirtColorReason": "string - why this color works for this design and audience",
    "alternativeShirtColors": ["array of other colors that would work"],
    "amazonSafe": true,
    "sources": ["array of sources that contributed: Google, Brave, Grok, Rabbit Hole"],
    "sourceUrl": "string - REQUIRED: the primary URL from the agent report that proves this trend is real"
  }
]

⚠️ IMPORTANT: If you cannot provide a real sourceUrl from the agent reports above, DO NOT include that trend.
`;
}

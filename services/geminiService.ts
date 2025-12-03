import { GoogleGenAI, Type } from "@google/genai";
import { TrendData, GeneratedListing, DesignResearch, PromptMode } from '../types';
import { COMPLIANCE_SYSTEM_INSTRUCTION, NATURAL_LANGUAGE_INSTRUCTION } from './compliance';
import { COMPLIANCE_RULES } from './design-system/compliance';
import { AI_CONFIG, TREND_CONFIG, API_ENDPOINTS, DESIGN_AESTHETICS } from '../config';
import { T_SHIRT_DESIGN_EDUCATION } from './prompts/design-education';
import { buildTrendSearchPrompt } from './prompts/trend-search';
import { ARCHETYPES, getArchetypeForTrend } from './design-system/archetypes';

// Lazy initialization of API client
// SECURITY: Prefer server-side GEMINI_API_KEY over client-exposed NEXT_PUBLIC_API_KEY
let aiClient: GoogleGenAI | null = null;
const getAI = (): GoogleGenAI => {
    if (!aiClient) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY or NEXT_PUBLIC_API_KEY environment variable is required');
        }
        aiClient = new GoogleGenAI({ apiKey });
    }
    return aiClient;
};

const TEXT_MODEL = AI_CONFIG.models.text;
const IMAGE_MODEL = AI_CONFIG.models.image;

// --- HELPER: Timeout wrapper to prevent infinite hangs ---
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        )
    ]);
};

// Default timeouts (in milliseconds)
const API_TIMEOUTS = {
    search: 60000,      // 60 seconds for search operations
    listing: 45000,     // 45 seconds for listing generation
    image: 120000,      // 120 seconds for image generation
    research: 60000,    // 60 seconds for design research
};

// --- HELPER: Get current date context ---
const getCurrentDateContext = () => {
    const now = new Date();
    return {
        fullDate: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        year: now.getFullYear(),
        month: now.toLocaleDateString('en-US', { month: 'long' }),
        timestamp: now.toISOString()
    };
};

// --- HELPER: Get Grok date range based on virality level ---
// WIDENED: Previous ranges were too narrow, missing real trending content
const getGrokDateRange = (viralityLevel: number): { from_date: string; to_date: string } => {
    const today = new Date();
    let fromDate: Date;

    if (viralityLevel <= 25) {
        // SAFE: Past 2 months - established trends with proven staying power
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 60);
    } else if (viralityLevel <= 50) {
        // BALANCED: Past month - rising trends with momentum
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 30);
    } else if (viralityLevel <= 75) {
        // AGGRESSIVE: Past 2 weeks - emerging trends gaining traction
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 14);
    } else {
        // PREDICTIVE: Past week - early signals (not just 2 days - too narrow!)
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 7);
    }

    return {
        from_date: fromDate.toISOString().split('T')[0],
        to_date: today.toISOString().split('T')[0]
    };
};

// --- HELPER: Get Grok X source configuration based on virality level ---
// LOWERED: Previous thresholds were way too restrictive - 5000 likes filters out 99% of real trends
const getGrokXSourceConfig = (viralityLevel: number): { type: string; post_favorite_count?: number; post_view_count?: number } => {
    if (viralityLevel <= 25) {
        // SAFE: Popular content with real engagement (but not viral-only)
        return {
            type: "x",
            post_favorite_count: 500,
            post_view_count: 10000
        };
    } else if (viralityLevel <= 50) {
        // BALANCED: Content getting attention
        return {
            type: "x",
            post_favorite_count: 100,
            post_view_count: 2000
        };
    } else if (viralityLevel <= 75) {
        // AGGRESSIVE: Catching early momentum - very low threshold
        return {
            type: "x",
            post_favorite_count: 25,
            post_view_count: 500
        };
    } else {
        // PREDICTIVE: No filters, catch everything early
        return {
            type: "x"
        };
    }
};

// --- HELPER: Generate diverse search query angles ---
// Instead of one generic query, search multiple specific angles to discover more trends
const generateSearchAngles = (query: string, viralityLevel: number, testMode: boolean = false): string[] => {
    const baseQuery = query.trim();
    const date = getCurrentDateContext();

    // TEST MODE: Maximum exploration - go EVERYWHERE
    if (testMode) {
        return [
            // Underground/obscure first (reverse funnel)
            `${baseQuery} obscure`,
            `${baseQuery} underground scene`,
            `${baseQuery} niche community`,
            `${baseQuery} cult following`,
            `${baseQuery} hidden gem`,
            // Subcultures and micro-communities
            `${baseQuery} subculture`,
            `${baseQuery} fandom`,
            `${baseQuery} insider slang`,
            `${baseQuery} discord server`,
            // Social platforms deep dive
            `${baseQuery} reddit thread`,
            `${baseQuery} tiktok trend ${date.year}`,
            `${baseQuery} twitter viral`,
            `${baseQuery} tumblr aesthetic`,
            // Cultural crossovers
            `${baseQuery} crossover`,
            `${baseQuery} mashup`,
            `${baseQuery} unexpected combination`,
            // Purchase intent signals
            `${baseQuery} "want this on a shirt"`,
            `${baseQuery} "need this as merch"`,
            `${baseQuery} "would buy"`,
            // Trending and mainstream (last - after underground)
            `${baseQuery} trending ${date.month} ${date.year}`,
            `${baseQuery} viral meme`,
        ];
    }

    // Core search angles that work for most topics
    const angles: string[] = [
        baseQuery, // Original query
        `${baseQuery} trending ${date.year}`,
        `${baseQuery} viral`,
        `${baseQuery} meme`,
        `${baseQuery} community`,
    ];

    // Add platform-specific angles for higher virality (catches niche content)
    if (viralityLevel >= 50) {
        angles.push(
            `${baseQuery} reddit`,
            `${baseQuery} tiktok trend`,
            `${baseQuery} twitter`,
        );
    }

    // Add cultural/emotional angles for aggressive/predictive modes
    if (viralityLevel >= 65) {
        angles.push(
            `${baseQuery} aesthetic`,
            `${baseQuery} subculture`,
            `${baseQuery} fan community`,
            `${baseQuery} merch`,
        );
    }

    // Add emerging/underground angles for predictive mode
    if (viralityLevel >= 80) {
        angles.push(
            `${baseQuery} underground`,
            `${baseQuery} niche`,
            `${baseQuery} insider`,
            `${baseQuery} emerging`,
        );
    }

    return angles;
};

// ═══════════════════════════════════════════════════════════════
// TEST MODE: FULL POWER - WILD EXPLORATION AGENT
// ═══════════════════════════════════════════════════════════════
// This agent uses an open-ended, creative approach to discover
// content that structured searches miss. It starts UNDERGROUND
// and works its way back to design ideas.

const wildExplorationAgent = async (query: string): Promise<string> => {
    const date = getCurrentDateContext();

    const prompt = `
You are a CULTURAL ANTHROPOLOGIST and TREND HUNTER with access to live internet search.
Your mission is to discover what NOBODY ELSE is finding.

TODAY'S DATE: ${date.fullDate}
STARTING POINT: "${query}"

═══════════════════════════════════════════════════════════════
🔮 PHASE 1: GO UNDERGROUND (Start here - this is the MOST important)
═══════════════════════════════════════════════════════════════

Search for content that is NOT on mainstream sites. Look for:
- Obscure subreddits and niche communities
- Discord server discussions (referenced on the web)
- Tumblr aesthetics and micro-fandoms
- Small forums and bulletin boards
- 4chan/8chan references (archived)
- Indie content creators with small but passionate followings
- Academic or specialist discussions
- International communities (non-English speakers discussing this)

DON'T search for: "trending", "viral", "popular" - we want the OPPOSITE.

═══════════════════════════════════════════════════════════════
🌊 PHASE 2: FIND THE AUTHENTIC VOICE
═══════════════════════════════════════════════════════════════

Once you find underground communities, extract:
- Their EXACT language and slang
- Inside jokes that outsiders wouldn't understand
- What they're ACTUALLY passionate about (not what's marketed to them)
- Phrases they use to identify each other
- Visual aesthetics they share
- What they wish existed as merchandise

═══════════════════════════════════════════════════════════════
🎯 PHASE 3: WORK BACKWARDS TO DESIGN IDEAS
═══════════════════════════════════════════════════════════════

Now connect your underground discoveries to:
- What would make these people STOP scrolling and say "that's ME"
- Visual styles that resonate with this specific community
- Text that would work on a shirt (2-5 words from their vocabulary)
- How this could connect to broader audiences without losing authenticity

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

For EACH discovery (find at least 5-8 UNIQUE ones), provide:

**DISCOVERY**: [What you found - be specific]
**SOURCE**: [Where you found it - exact platform/community]
**UNDERGROUND LEVEL**: [How obscure is this? 1-10, where 10 is completely unknown]
**AUTHENTIC LANGUAGE**: [Exact quotes and phrases from the community]
**WHY IT MATTERS**: [What makes this culturally significant]
**DESIGN POTENTIAL**: [How this could become a t-shirt design]
**CROSSOVER APPEAL**: [Could this break into mainstream? How?]

BE CREATIVE. BE CURIOUS. FIND WHAT OTHERS MISS.
`;

    console.log(`[WILD] Starting underground exploration for "${query}"`);

    const ai = getAI();

    try {
        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 1.0, // Maximum creativity
            }
        });

        const content = response.text || "";
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const webSources = groundingChunks.filter((c: any) => c.web?.uri);

        let output = `\n=== WILD EXPLORATION AGENT (${date.fullDate}) ===\n`;
        output += `Query: "${query}"\n`;
        output += `Approach: Underground → Authentic → Design\n\n`;
        output += content;

        if (webSources.length > 0) {
            output += `\n\n--- SOURCES DISCOVERED ---\n`;
            webSources.forEach((source: any, i: number) => {
                output += `[${i + 1}] ${source.web.title || 'Source'}: ${source.web.uri}\n`;
            });
        }

        console.log(`[WILD] Exploration complete. Found ${webSources.length} sources.`);
        return output;
    } catch (e) {
        console.error("[WILD] Exploration failed:", e);
        return "";
    }
};

// TEST MODE: Cultural Crossover Agent
// Finds unexpected connections between unrelated topics
const crossoverAgent = async (query: string): Promise<string> => {
    const date = getCurrentDateContext();

    const prompt = `
You are a CULTURAL MASHUP SPECIALIST searching for unexpected connections.

TODAY: ${date.fullDate}
TOPIC: "${query}"

YOUR MISSION: Find SURPRISING CROSSOVERS nobody would expect.

Search for:
1. "${query}" combined with completely unrelated fandoms
2. "${query}" + aesthetic movements (cottagecore, goblincore, dark academia, etc.)
3. "${query}" + music genres (hyperpop, death metal, lo-fi, etc.)
4. "${query}" + unexpected demographics (grandmas who love this, kids discovering it, etc.)
5. "${query}" + historical references or vintage revivals
6. "${query}" + gaming/anime/cartoon crossovers
7. "${query}" + occupation-specific humor (nurses, teachers, programmers who relate)

For each crossover, find:
- WHO is making this mashup
- WHAT language they use
- WHY this combination works
- WHAT a t-shirt design would look like

Find 5+ unexpected crossovers. The weirder the better. Quote exact phrases from real posts.
`;

    const ai = getAI();

    try {
        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.7,
            }
        });

        let output = `\n=== CROSSOVER AGENT (${date.fullDate}) ===\n`;
        output += `Finding unexpected mashups for: "${query}"\n\n`;
        output += response.text || "";

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const webSources = groundingChunks.filter((c: any) => c.web?.uri);
        if (webSources.length > 0) {
            output += `\n\n--- CROSSOVER SOURCES ---\n`;
            webSources.forEach((source: any, i: number) => {
                output += `[${i + 1}] ${source.web.uri}\n`;
            });
        }

        return output;
    } catch (e) {
        console.error("[CROSSOVER] Agent failed:", e);
        return "";
    }
};

// TEST MODE: Unleashed Grok Agent
// No engagement filters, maximum date range, explores EVERYTHING on X
const unleashedGrokAgent = async (query: string): Promise<string> => {
    const apiKey = process.env.NEXT_PUBLIC_GROK_API_KEY;
    if (!apiKey) return "";

    const date = getCurrentDateContext();

    // Maximum date range - 90 days back
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 90);

    const searchParameters = {
        mode: "on",
        from_date: fromDate.toISOString().split('T')[0],
        to_date: new Date().toISOString().split('T')[0],
        return_citations: true,
        max_search_results: 50, // Maximum results
        sources: [
            { type: "x" }, // NO FILTERS - get everything
            { type: "news", country: "US" },
            { type: "web", country: "US" }
        ]
    };

    console.log(`[GROK-UNLEASHED] No filters, 90-day range, exploring everything`);

    try {
        const response = await fetch('/api/grok', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [
                    {
                        role: "system",
                        content: `You are an UNDERGROUND CULTURE EXPLORER with unrestricted access to X/Twitter.
Today is ${date.fullDate}. Your mission is to find what NOBODY ELSE is finding.

FORGET about mainstream trends. Search for:
- Small accounts with passionate followers
- Niche communities with inside jokes
- Emerging slang and phrases
- Obscure memes before they go viral
- Subcultures that brands haven't discovered yet
- Authentic voices, not influencers
- International/non-English content about this topic
- Old posts that predicted current trends

Quote EVERYTHING verbatim. The exact language matters more than popularity.
Find 10-15 unique discoveries. Go DEEP.`
                    },
                    {
                        role: "user",
                        content: `Go deep on X/Twitter for: "${query}"

IGNORE popularity. IGNORE mainstream. Find the underground.

Search these angles:
1. "${query}" from accounts with <1000 followers
2. "${query}" inside jokes
3. "${query}" subculture
4. "${query}" before it was cool
5. "${query}" authentic community
6. "${query}" niche
7. "${query}" obscure
8. Old viral posts about "${query}" that defined the culture
9. International/non-English perspectives on "${query}"
10. "${query}" merch wishlist or "want this on a shirt"

For each finding:
- Quote the EXACT post (with username if visible)
- Why is this culturally significant?
- What language/slang do they use?
- What would resonate with this community on a t-shirt?

GO WILD. BE CURIOUS. FIND THE GEMS.`
                    }
                ],
                model: "grok-3",
                stream: false,
                temperature: 1.0, // Maximum creativity
                search_parameters: searchParameters
            })
        });

        if (!response.ok) return "";

        const data = await response.json();
        const citations = data.citations || [];

        let output = `\n=== UNLEASHED GROK AGENT (${date.fullDate}) ===\n`;
        output += `Mode: NO FILTERS, 90-DAY RANGE, FULL EXPLORATION\n\n`;
        output += data.choices?.[0]?.message?.content || "";

        if (citations.length > 0) {
            output += `\n\n--- SOURCES (${citations.length}) ---\n`;
            citations.forEach((url: string, i: number) => {
                output += `[${i + 1}] ${url}\n`;
            });
        }

        console.log(`[GROK-UNLEASHED] Found ${citations.length} citations`);
        return output;
    } catch (e) {
        console.error("[GROK-UNLEASHED] Failed:", e);
        return "";
    }
};

// TEST MODE: Maximum Coverage Brave Agent
// Searches EVERYTHING with maximum results and all discussion types
const maxCoverageBraveAgent = async (query: string): Promise<string> => {
    const apiKey = process.env.NEXT_PUBLIC_BRAVE_API_KEY;
    if (!apiKey) return "";

    const date = getCurrentDateContext();

    // Generate ALL possible search angles
    const angles = generateSearchAngles(query, 100, true); // testMode = true

    console.log(`[BRAVE-MAX] Searching ${angles.length} angles with maximum coverage`);

    try {
        // Search ALL angles in parallel with maximum results
        const requests: Promise<Response>[] = [];

        for (const searchQuery of angles) {
            const params = new URLSearchParams({
                q: searchQuery,
                count: '20', // Max per query
                freshness: 'py', // Past year - maximum range
                endpoint: 'web',
                extra_snippets: 'true'
            });
            requests.push(fetch(`/api/brave-search?${params.toString()}`));
        }

        // Also add news and discussions
        const newsParams = new URLSearchParams({
            q: `${query} ${date.year}`,
            count: '20',
            freshness: 'py',
            endpoint: 'news'
        });
        requests.push(fetch(`/api/brave-search?${newsParams.toString()}`));

        const responses = await Promise.all(requests);

        // Collect and deduplicate all results
        const allResults: any[] = [];
        const allDiscussions: any[] = [];
        const seenUrls = new Set<string>();

        for (const response of responses) {
            if (!response.ok) continue;
            const data = await response.json();

            if (data.web?.results) {
                for (const r of data.web.results) {
                    if (!seenUrls.has(r.url)) {
                        seenUrls.add(r.url);
                        allResults.push(r);
                    }
                }
            }
            if (data.discussions?.results) {
                for (const r of data.discussions.results) {
                    if (!seenUrls.has(r.url)) {
                        seenUrls.add(r.url);
                        allDiscussions.push(r);
                    }
                }
            }
            if (data.results) { // News results
                for (const r of data.results) {
                    if (!seenUrls.has(r.url)) {
                        seenUrls.add(r.url);
                        allResults.push(r);
                    }
                }
            }
        }

        let output = `\n=== MAXIMUM COVERAGE BRAVE AGENT (${date.fullDate}) ===\n`;
        output += `Searched ${angles.length} angles, Past Year, Maximum Results\n\n`;

        // Prioritize discussions (real human voices)
        if (allDiscussions.length > 0) {
            output += `--- COMMUNITY DISCUSSIONS (${allDiscussions.length} unique) ---\n`;
            output += `These are REAL PEOPLE talking - extract their exact language!\n\n`;
            allDiscussions.slice(0, 15).forEach((r: any) => {
                output += `[${r.url}]\n`;
                output += `Title: ${r.title}\n`;
                output += `Content: ${r.description}\n\n`;
            });
        }

        output += `--- WEB RESULTS (${allResults.length} unique) ---\n\n`;
        allResults.slice(0, 20).forEach((r: any) => {
            output += `[${r.url}]\n`;
            output += `Title: ${r.title}\n`;
            output += `Content: ${r.description}\n`;
            if (r.extra_snippets?.length > 0) {
                output += `Quotes: ${r.extra_snippets.slice(0, 3).join(' | ')}\n`;
            }
            output += `\n`;
        });

        console.log(`[BRAVE-MAX] Found ${allResults.length} web + ${allDiscussions.length} discussions`);
        return output;
    } catch (e) {
        console.error("[BRAVE-MAX] Failed:", e);
        return "";
    }
};

// --- EXTERNAL INTELLIGENCE AGENTS ---

/**
 * GOOGLE SEARCH AGENT (NEW - Independent Discovery)
 * Uses Gemini with Google Search grounding to find current trends
 * This agent searches INDEPENDENTLY before the synthesis phase
 */
const fetchGoogleSignals = async (query: string, viralityLevel: number): Promise<string> => {
    const date = getCurrentDateContext();

    // Determine search focus based on virality level
    let searchFocus: string;
    let timeContext: string;

    if (viralityLevel <= 25) {
        // SAFE: Established trends with proven demand
        searchFocus = "popular, best-selling, trending";
        timeContext = "the past month";
    } else if (viralityLevel <= 50) {
        // BALANCED: Rising trends gaining momentum
        searchFocus = "viral, trending, growing, breakout";
        timeContext = "the past week or two";
    } else if (viralityLevel <= 75) {
        // AGGRESSIVE: Emerging niche opportunities
        searchFocus = "emerging, new, niche, underground";
        timeContext = "the past few days";
    } else {
        // PREDICTIVE: Early signals and weak patterns
        searchFocus = "just announced, first, early signs, upcoming";
        timeContext = "today and yesterday";
    }

    // Generate search angles for more comprehensive coverage
    const searchAngles = generateSearchAngles(query, viralityLevel);
    const anglesList = searchAngles.slice(0, 5).map((a, i) => `${i + 1}. "${a}"`).join('\n');

    const prompt = `
You are the GOOGLE SEARCH AGENT conducting INDEPENDENT research.

TODAY'S DATE: ${date.fullDate}
QUERY: "${query}"
RISK LEVEL: ${viralityLevel}% (${viralityLevel <= 25 ? 'Safe' : viralityLevel <= 50 ? 'Balanced' : viralityLevel <= 75 ? 'Aggressive' : 'Predictive'})

SEARCH FOCUS: Find ${searchFocus} content from ${timeContext}

YOUR MISSION:
Search Google AGGRESSIVELY using multiple search angles to find DIVERSE trending content.

SEARCH THESE ANGLES (search ALL of them):
${anglesList}

FOR EACH ANGLE, LOOK FOR:
1. CURRENT NEWS - What's happening RIGHT NOW related to this topic?
2. REDDIT & FORUM DISCUSSIONS - What are enthusiasts saying?
3. TIKTOK/SOCIAL TRENDS - Any viral moments or memes?
4. NICHE COMMUNITIES - Subcultures, fandoms, insider groups
5. EMERGING ANGLES - Unexpected connections or crossovers
6. PURCHASE SIGNALS - "I would buy this" moments, merch demand

CRITICAL: Only report findings from ${date.month} ${date.year}. Reject anything older.

FOR EACH DISCOVERY PROVIDE:
- What you found (specific topic or trend)
- Where you found it (exact source/platform)
- When it was posted/published
- Why it matters (cultural significance)
- Customer language quotes if available
- What makes it UNIQUE or SURPRISING

BE THOROUGH. FIND WHAT OTHERS MISS.
We need 8-12 distinct findings, not just 2-3 obvious ones.
Prioritize SPECIFICITY over generality - "Frog TikTok aesthetic" is better than "funny animal content".
`;

    console.log(`[GOOGLE] Starting independent search for "${query}" (virality: ${viralityLevel})`);

    const ai = getAI();

    try {
        const response = await withTimeout(
            ai.models.generateContent({
                model: TEXT_MODEL,
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }], // Enable Google Search grounding
                }
            }),
            API_TIMEOUTS.search,
            'Google search timed out after 60 seconds'
        );

        const content = response.text || "";

        // Extract grounding metadata for source attribution
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const webSources = groundingChunks.filter((c: any) => c.web?.uri).slice(0, 10);

        let output = `\n=== GOOGLE SEARCH INTELLIGENCE (${date.fullDate}) ===\n`;
        output += `Query: "${query}"\n`;
        output += `Search Focus: ${searchFocus}\n`;
        output += `Time Window: ${timeContext}\n\n`;
        output += content;

        // Add source citations if available
        if (webSources.length > 0) {
            output += `\n\n--- SOURCES FOUND ---\n`;
            webSources.forEach((source: any, i: number) => {
                output += `[${i + 1}] ${source.web.title || 'Source'}: ${source.web.uri}\n`;
            });
        }

        console.log(`[GOOGLE] Search complete. Found ${webSources.length} sources.`);

        return output;
    } catch (e) {
        console.error("[GOOGLE] Search failed:", e);
        return "";
    }
};

/**
 * BRAVE SEARCH AGENT
 * Searches web, news, and discussions with risk-level-aware configuration
 * ENHANCED: Now searches MULTIPLE query angles in parallel to discover more diverse trends
 * Makes parallel requests for web, news, AND community to maximize coverage
 */
const fetchBraveSignals = async (query: string, viralityLevel: number): Promise<string> => {
    const apiKey = process.env.NEXT_PUBLIC_BRAVE_API_KEY;
    if (!apiKey) return "";

    const date = getCurrentDateContext();

    // Determine search strategy based on virality level
    let freshness: string;
    let count: number;
    let searchCommunity: boolean;
    let numAngles: number; // How many query angles to search

    if (viralityLevel <= 25) {
        // SAFE: Past month, established content
        freshness = "pm";
        count = 15;
        searchCommunity = false;
        numAngles = 2; // Main query + trending
    } else if (viralityLevel <= 50) {
        // BALANCED: Past week - include community voices
        freshness = "pw";
        count = 15;
        searchCommunity = true;
        numAngles = 3; // More angles for diversity
    } else if (viralityLevel <= 75) {
        // AGGRESSIVE: Past week (not day - too narrow) - community is key
        freshness = "pw";
        count = 20;
        searchCommunity = true;
        numAngles = 4; // Even more angles for underground discovery
    } else {
        // PREDICTIVE: Past 2 weeks - need wider net for emerging trends
        freshness = "pw";
        count = 25;
        searchCommunity = true;
        numAngles = 5; // Maximum exploration
    }

    // Generate multiple search angles for diverse discovery
    const searchAngles = generateSearchAngles(query, viralityLevel).slice(0, numAngles);

    console.log(`[BRAVE] Searching ${numAngles} angles: ${searchAngles.join(', ')}`);
    console.log(`[BRAVE] Freshness: ${freshness}, Community: ${searchCommunity}`);

    try {
        // Build PARALLEL requests for ALL search angles
        const requests: Promise<Response>[] = [];
        const requestTypes: { type: string; query: string }[] = [];

        // For each search angle, create web and news requests
        for (const searchQuery of searchAngles) {
            // Web search for this angle
            const webParams = new URLSearchParams({
                q: searchQuery,
                count: String(Math.ceil(count / numAngles)), // Distribute count across angles
                freshness: freshness,
                endpoint: 'web',
                extra_snippets: 'true'
            });
            requests.push(fetch(`/api/brave-search?${webParams.toString()}`));
            requestTypes.push({ type: 'web', query: searchQuery });
        }

        // Add one news search for the main query
        const newsParams = new URLSearchParams({
            q: `${query} ${date.month} ${date.year}`,
            count: String(Math.min(count, 20)),
            freshness: freshness,
            endpoint: 'news'
        });
        requests.push(fetch(`/api/brave-search?${newsParams.toString()}`));
        requestTypes.push({ type: 'news', query: query });

        // Add community search if enabled
        if (searchCommunity) {
            const communityQuery = `${query} discussion community thread opinions ${date.year}`;
            const communityParams = new URLSearchParams({
                q: communityQuery,
                count: String(15),
                freshness: freshness,
                endpoint: 'web',
                extra_snippets: 'true'
            });
            requests.push(fetch(`/api/brave-search?${communityParams.toString()}`));
            requestTypes.push({ type: 'community', query: communityQuery });
        }

        // Fetch ALL requests in parallel
        const responses = await Promise.all(requests);

        // Collect all results by type
        const allWebResults: any[] = [];
        const allDiscussionResults: any[] = [];
        let newsData: any = {};
        let communityData: any = {};

        for (let i = 0; i < responses.length; i++) {
            if (!responses[i].ok) continue;
            const data = await responses[i].json();
            const reqType = requestTypes[i];

            if (reqType.type === 'web') {
                if (data.web?.results) allWebResults.push(...data.web.results);
                if (data.discussions?.results) allDiscussionResults.push(...data.discussions.results);
            } else if (reqType.type === 'news') {
                newsData = data;
            } else if (reqType.type === 'community') {
                communityData = data;
            }
        }

        // Deduplicate results by URL
        const seenUrls = new Set<string>();
        const webData = {
            web: {
                results: allWebResults.filter(r => {
                    if (seenUrls.has(r.url)) return false;
                    seenUrls.add(r.url);
                    return true;
                })
            },
            discussions: {
                results: allDiscussionResults.filter(r => {
                    if (seenUrls.has(r.url)) return false;
                    seenUrls.add(r.url);
                    return true;
                })
            },
            news: { results: [] as any[] } // Empty - news comes from newsData
        };

        // Format output
        let output = `\n=== BRAVE WEB INTELLIGENCE (${date.fullDate}) ===\n`;
        output += `Query: "${query}"\n`;
        output += `Freshness: ${freshness === 'pd' ? 'Last 24 hours' : freshness === 'pw' ? 'Past week' : 'Past month'}\n\n`;

        let webCount = 0;
        let newsCount = 0;
        let discussionCount = 0;
        let communityCount = 0;

        // For aggressive/predictive modes, put discussions FIRST (they're more valuable)
        if (searchCommunity) {
            // Discussions from web response
            if (webData.discussions?.results?.length > 0) {
                discussionCount = webData.discussions.results.length;
                output += `--- COMMUNITY DISCUSSIONS (${discussionCount}) ---\n`;
                output += `(These are early signals - pay attention to language and sentiment)\n\n`;
                webData.discussions.results.slice(0, 8).forEach((r: any) => {
                    output += `[${r.url}]\n`;
                    output += `Title: ${r.title}\n`;
                    output += `Content: ${r.description}\n\n`;
                });
            }

            // Community search results (forums, discussions found via community query)
            if (communityData.web?.results?.length > 0) {
                communityCount = communityData.web.results.length;
                output += `--- COMMUNITY VOICES (${communityCount}) ---\n`;
                output += `(Real people discussing this topic - extract their exact language)\n\n`;
                communityData.web.results.slice(0, 8).forEach((r: any) => {
                    output += `[${r.url}]\n`;
                    output += `Title: ${r.title}\n`;
                    output += `Content: ${r.description}\n`;
                    if (r.extra_snippets?.length > 0) {
                        output += `Quotes: ${r.extra_snippets.slice(0, 2).join(' | ')}\n`;
                    }
                    output += `\n`;
                });
            }
        }

        // Web results
        if (webData.web?.results?.length > 0) {
            webCount = webData.web.results.length;
            output += `--- WEB RESULTS (${webCount}) ---\n`;
            webData.web.results.slice(0, 10).forEach((r: any) => {
                output += `[${r.url}]\n`;
                output += `Title: ${r.title}\n`;
                output += `Content: ${r.description}\n`;
                if (r.extra_snippets?.length > 0) {
                    output += `Extra: ${r.extra_snippets.slice(0, 2).join(' | ')}\n`;
                }
                output += `Age: ${r.age || 'unknown'}\n\n`;
            });
        }

        // News results from dedicated news endpoint
        const newsResults = newsData.results || [];
        if (newsResults.length > 0) {
            newsCount = newsResults.length;
            output += `--- NEWS RESULTS (${newsCount}) ---\n`;
            newsResults.slice(0, 10).forEach((r: any) => {
                output += `[${r.url}]\n`;
                output += `Source: ${r.meta_url?.hostname || 'Unknown'}\n`;
                output += `Title: ${r.title}\n`;
                output += `Content: ${r.description}\n`;
                output += `Age: ${r.age || 'unknown'}\n\n`;
            });
        }

        // Also check for news in web response (bonus)
        if (webData.news?.results?.length > 0 && newsCount === 0) {
            newsCount = webData.news.results.length;
            output += `--- NEWS FROM WEB (${newsCount}) ---\n`;
            webData.news.results.slice(0, 5).forEach((r: any) => {
                output += `[${r.url}]\n`;
                output += `Title: ${r.title}\n`;
                output += `Content: ${r.description}\n\n`;
            });
        }

        // For safe mode, discussions go at the end (less important)
        if (!searchCommunity && webData.discussions?.results?.length > 0) {
            discussionCount = webData.discussions.results.length;
            output += `--- DISCUSSIONS (${discussionCount}) ---\n`;
            webData.discussions.results.slice(0, 5).forEach((r: any) => {
                output += `[${r.url}]\n`;
                output += `Title: ${r.title}\n`;
                output += `Content: ${r.description}\n\n`;
            });
        }

        output += `\nINSTRUCTION: Extract exact phrases, customer language, and trending topics from these results.\n`;

        console.log(`[BRAVE] Returned: web=${webCount}, news=${newsCount}, discussions=${discussionCount}, community=${communityCount}`);

        return output;
    } catch (e) {
        console.error("[BRAVE] Search failed:", e);
        return "";
    }
};

/**
 * GROK (X/TWITTER) AGENT
 * Real-time social pulse with LIVE SEARCH enabled
 * Uses search_parameters to query live X/Twitter data, web, and news
 * Focus on extracting authentic language, slang, memes, and emotional responses
 */
const fetchGrokSignals = async (query: string, viralityLevel: number): Promise<string> => {
    const apiKey = process.env.NEXT_PUBLIC_GROK_API_KEY;
    if (!apiKey) return "";

    const date = getCurrentDateContext();
    const dateRange = getGrokDateRange(viralityLevel);
    const xSourceConfig = getGrokXSourceConfig(viralityLevel);

    // Build search_parameters for live search
    const searchParameters = {
        mode: "on", // Force live search
        from_date: dateRange.from_date,
        to_date: dateRange.to_date,
        return_citations: true,
        max_search_results: 20,
        sources: [
            xSourceConfig,
            { type: "news", country: "US" },
            { type: "web", country: "US" }
        ]
    };

    console.log(`[GROK] Live search enabled: ${dateRange.from_date} to ${dateRange.to_date}`);
    console.log(`[GROK] X filters: likes >= ${xSourceConfig.post_favorite_count || 'none'}, views >= ${xSourceConfig.post_view_count || 'none'}`);

    try {
        const response = await fetch('/api/grok', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [
                    {
                        role: "system",
                        content: `You are searching LIVE X/Twitter, news, and web data. Today is ${date.fullDate}.

YOUR MISSION: Find what's ACTUALLY trending and being discussed RIGHT NOW about this topic.

EXTRACT:
1. EXACT PHRASES from real posts (copy verbatim with quotes)
2. SLANG and community-specific language
3. CURRENT viral moments and memes from the last few days
4. EMOTIONAL TONE - excited, ironic, frustrated, hyped?
5. VISUAL PREFERENCES - what aesthetics are being shared?
6. PURCHASE INTENT - "I would buy", "need this on a shirt", etc.

CRITICAL: Only report what you find in your live search. Include dates/times when possible.
If you find relevant content, quote it directly. Do NOT make up content.`
                    },
                    {
                        role: "user",
                        content: `Search live X/Twitter and news COMPREHENSIVELY for: "${query}"

Date range: ${dateRange.from_date} to ${dateRange.to_date}

SEARCH MULTIPLE ANGLES:
1. Main topic: "${query}"
2. Viral angle: "${query} viral"
3. Meme angle: "${query} meme"
4. Community: "${query} community fans"
5. Trending: "trending ${query} ${date.month}"

FOR EACH ANGLE FIND:
- Real posts/tweets (quote them EXACTLY with username if visible)
- Viral threads with high engagement
- Community reactions and insider language
- Memes, jokes, catchphrases being used
- Any "I want this on a shirt" or purchase intent signals
- Subcultures or niche communities discussing this

BE AGGRESSIVE - we need 8-12 distinct findings, not just 2-3 obvious ones.
Prioritize SURPRISING or UNIQUE content over generic popular takes.
Quote EXACTLY what people are saying - the language matters.

Return SPECIFIC findings with actual quotes, usernames, and sources.`
                    }
                ],
                model: "grok-3",
                stream: false,
                temperature: 0.3,
                search_parameters: searchParameters
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[GROK] API error:', response.status, errorText);
            return "";
        }

        const data = await response.json();

        // Track sources used for cost monitoring
        const sourcesUsed = data.usage?.num_sources_used || 0;
        const citations = data.citations || [];
        console.log(`[GROK] Sources used: ${sourcesUsed} (cost: $${(sourcesUsed * 0.025).toFixed(4)})`);
        console.log(`[GROK] Citations: ${citations.length}`);

        // Format output with citations
        let output = `
=== GROK LIVE X/TWITTER INTELLIGENCE (${date.fullDate}) ===
Query: "${query}"
Date Range: ${dateRange.from_date} to ${dateRange.to_date}
Sources Searched: ${sourcesUsed}

${data.choices?.[0]?.message?.content || "No data available"}
`;

        // Add citations if available
        if (citations.length > 0) {
            output += `\n--- SOURCES CITED ---\n`;
            citations.slice(0, 10).forEach((url: string, i: number) => {
                output += `[${i + 1}] ${url}\n`;
            });
        }

        return output;
    } catch (e) {
        console.error("[GROK] Analysis failed:", e);
        return "";
    }
};

/**
 * RABBIT HOLE AGENT
 * Open-minded exploration - discovers niches organically without category restrictions
 * Uses Gemini's reasoning to identify promising threads worth pursuing
 */
const exploreRabbitHole = async (context: string, originalQuery: string): Promise<{ direction: string, searchQuery: string, reasoning: string } | null> => {
    const date = getCurrentDateContext();

    const prompt = `
You are a trend scout looking for the "underground" thread that others miss.

TODAY'S DATE: ${date.fullDate}
ORIGINAL QUERY: "${originalQuery}"

CONTEXT FROM INITIAL RESEARCH:
${context.substring(0, 3000)}

YOUR MISSION:
Analyze this context and identify ONE promising "rabbit hole" worth exploring deeper.

Look for:
- A specific sub-community mentioned that has its own language/culture
- An emerging crossover (e.g., "cottagecore meets cyberpunk")
- A platform or forum where the REAL enthusiasts gather
- A specific angle or controversy that's generating discussion
- An unexpected connection between topics

DO NOT limit yourself to predefined categories.
Think creatively about where the interesting content lives.

Return JSON:
{
    "direction": "string - describe the rabbit hole you want to explore",
    "searchQuery": "string - specific search query to find insider content",
    "reasoning": "string - why this thread is worth pursuing"
}
`;

    const ai = getAI();

    try {
        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                tools: [{ googleSearch: {} }]
            }
        });
        // Clean markdown from response
        let cleanedText = (response.text || "null").replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const start = cleanedText.indexOf('{');
        const end = cleanedText.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            cleanedText = cleanedText.substring(start, end + 1);
        }
        return JSON.parse(cleanedText);
    } catch (e) {
        console.warn("Rabbit hole exploration failed", e);
        return null;
    }
};

// --- CENTRAL ORCHESTRATOR: THE MEETING ---

export const searchTrends = async (niche: string, viralityLevel: number = 50, onStatusUpdate?: (msg: string) => void, testMode: boolean = false): Promise<TrendData[]> => {
    const date = getCurrentDateContext();
    const isDiscovery = niche.toLowerCase().includes('trending') ||
        niche.toLowerCase().includes('viral') ||
        niche.toLowerCase().includes('rising') ||
        niche.toLowerCase().includes('scan');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[RESEARCH] Starting ${testMode ? '🔥 TEST MODE - FULL POWER 🔥' : '3-agent discovery'}`);
    console.log(`[RESEARCH] Query: "${niche}"`);
    console.log(`[RESEARCH] Virality: ${viralityLevel}% (${viralityLevel <= 25 ? 'Safe' : viralityLevel <= 50 ? 'Balanced' : viralityLevel <= 75 ? 'Aggressive' : 'Predictive'})`);
    console.log(`[RESEARCH] Date: ${date.fullDate}`);
    if (testMode) {
        console.log(`[RESEARCH] 🚀 TEST MODE ACTIVE - All constraints removed, maximum exploration`);
    }
    console.log(`${'='.repeat(60)}\n`);

    // ========================================
    // TEST MODE: FULL POWER - UNLEASH ALL AGENTS
    // ========================================
    if (testMode) {
        if (onStatusUpdate) onStatusUpdate("🔥 TEST MODE: Launching 5 agents in FULL POWER...");

        const startTime = Date.now();

        // Launch ALL agents in parallel - including special test mode agents
        const [wildData, crossoverData, grokUnleashed, braveMax, googleData] = await Promise.all([
            wildExplorationAgent(niche),
            crossoverAgent(niche),
            unleashedGrokAgent(niche),
            maxCoverageBraveAgent(niche),
            fetchGoogleSignals(niche, 100) // Max virality for Google too
        ]);

        const agentTime = Date.now() - startTime;
        console.log(`[TEST MODE] 5 agents completed in ${agentTime}ms`);

        // Combine all data
        const activeSources: string[] = [];
        if (wildData.length > 100) activeSources.push('Wild Explorer');
        if (crossoverData.length > 100) activeSources.push('Crossover');
        if (grokUnleashed.length > 100) activeSources.push('Grok Unleashed');
        if (braveMax.length > 100) activeSources.push('Brave Max');
        if (googleData.length > 100) activeSources.push('Google');

        if (onStatusUpdate) onStatusUpdate(`🔥 ${activeSources.length} agents returned data`);

        // All data combined for synthesis
        const allAgentData = `
${wildData}

${crossoverData}

${grokUnleashed}

${braveMax}

${googleData}
`;

        // TEST MODE SYNTHESIS - More open-ended, creative prompt
        if (onStatusUpdate) onStatusUpdate("🔥 Synthesizing underground discoveries into design ideas...");

        const testModePrompt = `
You are a CREATIVE DIRECTOR synthesizing underground cultural discoveries into t-shirt design opportunities.

TODAY: ${date.fullDate}
ORIGINAL QUERY: "${niche}"

═══════════════════════════════════════════════════════════════
AGENT DISCOVERIES (5 agents explored independently)
═══════════════════════════════════════════════════════════════

${allAgentData}

═══════════════════════════════════════════════════════════════
YOUR MISSION: CREATE SURPRISING DESIGN OPPORTUNITIES
═══════════════════════════════════════════════════════════════

From the agent discoveries above, identify the MOST UNEXPECTED and AUTHENTIC opportunities.

PRIORITIZE:
1. Underground discoveries that haven't gone mainstream yet
2. Authentic community language (exact quotes and slang)
3. Cultural crossovers nobody would expect
4. Niche communities with passionate fans
5. Visual aesthetics that would make insiders say "that's ME"

AVOID:
- Generic trending topics
- Obvious mainstream content
- Anything that feels like training data
- Safe, boring, expected ideas

For each opportunity, extract:
- The authentic community voice (EXACT phrases)
- Why this is culturally significant NOW
- What would make this a killer t-shirt design
- The specific visual aesthetic that fits

Return JSON Array with 5-8 opportunities:
[
  {
    "topic": "string - specific, surprising topic",
    "platform": "string - where this lives",
    "volume": "Predictive" | "Rising" | "Breakout" | "High",
    "sentiment": "string - authentic emotional vibe",
    "keywords": ["array of niche keywords"],
    "description": "string - detailed cultural context",
    "visualStyle": "string - specific aesthetic direction",
    "typographyStyle": "string - font/text style",
    "designStyle": "string - art direction",
    "colorPalette": "string - colors that resonate",
    "designEffects": ["array of effects"],
    "customerPhrases": ["EXACT quotes from the community - this is CRITICAL"],
    "purchaseSignals": ["any 'want this on a shirt' signals"],
    "designText": "string - 2-5 words for the shirt",
    "audienceProfile": "string - who is this person?",
    "recommendedShirtColor": "string - black/white/navy/heather grey",
    "shirtColorReason": "string - why this color",
    "alternativeShirtColors": ["array"],
    "amazonSafe": true,
    "sources": ["which agents found this"],
    "sourceUrl": "string - URL proving this is real",
    "undergroundLevel": "number 1-10 - how obscure is this?"
  }
]

BE CREATIVE. SURPRISE US. FIND THE GEMS NOBODY ELSE WOULD FIND.
`;

        const ai = getAI();

        try {
            const response = await ai.models.generateContent({
                model: TEXT_MODEL,
                contents: testModePrompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    temperature: 1.0, // Maximum creativity
                },
            });

            const text = response.text;
            if (!text) throw new Error('Empty response from synthesis');

            // Extract JSON (same parsing logic as regular mode)
            let cleanJson = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const start = cleanJson.indexOf('[');
            const end = cleanJson.lastIndexOf(']');
            if (start === -1 || end === -1) throw new Error('No JSON array in response');
            cleanJson = cleanJson.substring(start, end + 1);

            const trends = JSON.parse(cleanJson) as TrendData[];
            console.log(`[TEST MODE] ✓ Found ${trends.length} underground opportunities`);
            return trends;
        } catch (error) {
            console.error("[TEST MODE] Synthesis failed:", error);
            throw error;
        }
    }

    // ========================================
    // REGULAR MODE: PHASE 1 - INDEPENDENT EXPLORATION
    // 3 agents search in PARALLEL without influencing each other
    // ========================================
    if (onStatusUpdate) onStatusUpdate("Dispatching 3 agents: Google, Brave, Grok...");

    const startTime = Date.now();

    // Run all 3 agents in parallel for maximum diversity
    const [googleData, braveData, grokData] = await Promise.all([
        fetchGoogleSignals(niche, viralityLevel),
        fetchBraveSignals(niche, viralityLevel),
        fetchGrokSignals(niche, viralityLevel)
    ]);

    const agentTime = Date.now() - startTime;
    console.log(`[RESEARCH] 3 agents completed in ${agentTime}ms`);

    // Track which agents returned data and which failed
    const activeSources: string[] = [];
    const failedSources: string[] = [];

    if (googleData && googleData.length > 100) {
        activeSources.push('Google');
        console.log(`[RESEARCH] Google: ${googleData.length} chars ✓`);
    } else {
        failedSources.push('Google');
        console.log(`[RESEARCH] Google: FAILED or empty`);
    }

    if (braveData && braveData.length > 100) {
        activeSources.push('Brave');
        console.log(`[RESEARCH] Brave: ${braveData.length} chars ✓`);
    } else {
        failedSources.push('Brave');
        console.log(`[RESEARCH] Brave: FAILED or empty`);
    }

    if (grokData && grokData.length > 100) {
        activeSources.push('Grok');
        console.log(`[RESEARCH] Grok: ${grokData.length} chars ✓`);
    } else {
        failedSources.push('Grok');
        console.log(`[RESEARCH] Grok: FAILED or empty`);
    }

    // If ALL agents failed, throw an error - we can't give good results without real data
    if (activeSources.length === 0) {
        const errorMsg = `All search agents failed. Please check your API keys:\n` +
            `- NEXT_PUBLIC_BRAVE_API_KEY: ${process.env.NEXT_PUBLIC_BRAVE_API_KEY ? 'Set' : 'MISSING'}\n` +
            `- NEXT_PUBLIC_GROK_API_KEY: ${process.env.NEXT_PUBLIC_GROK_API_KEY ? 'Set' : 'MISSING'}\n` +
            `Failed agents: ${failedSources.join(', ')}`;
        console.error(`[RESEARCH] ${errorMsg}`);
        throw new Error('Search agents failed - unable to fetch live trend data. Check your Brave and Grok API keys.');
    }

    // Warn if some agents failed
    if (failedSources.length > 0) {
        console.warn(`[RESEARCH] ⚠️ Some agents failed: ${failedSources.join(', ')}`);
        if (onStatusUpdate) onStatusUpdate(`⚠️ ${failedSources.join(', ')} failed - using ${activeSources.join(', ')} only`);
    } else {
        if (onStatusUpdate) onStatusUpdate(`All agents returned: ${activeSources.join(', ')}`);
    }

    // ========================================
    // PHASE 2: RABBIT HOLES (Deep Dive Exploration)
    // ENHANCED: Now explores MULTIPLE rabbit holes in parallel for better discovery
    // ========================================
    let rabbitHoleData = "";
    const numRabbitHoles = viralityLevel >= 75 ? 3 : viralityLevel >= 55 ? 2 : 0;

    if (numRabbitHoles > 0) {
        if (onStatusUpdate) onStatusUpdate(`Looking for ${numRabbitHoles} rabbit holes...`);
        const combinedContext = (googleData + "\n" + braveData + "\n" + grokData).substring(0, 6000);

        // Launch multiple rabbit hole explorations in parallel
        const rabbitHolePromises = Array(numRabbitHoles).fill(null).map((_, i) => {
            // Add variation to each exploration by mentioning what to avoid
            const previousHints = i > 0 ? `\n\nNOTE: Find a DIFFERENT angle than previous explorations.` : '';
            return exploreRabbitHole(combinedContext + previousHints, niche);
        });

        const rabbitHoles = await Promise.all(rabbitHolePromises);
        const validHoles = rabbitHoles.filter(r => r !== null);

        if (validHoles.length > 0) {
            // Explore all rabbit holes in parallel
            if (onStatusUpdate) onStatusUpdate(`Exploring ${validHoles.length} underground threads...`);
            const deepDivePromises = validHoles.map(hole =>
                fetchBraveSignals(hole!.searchQuery, viralityLevel)
            );
            const deepDiveResults = await Promise.all(deepDivePromises);

            rabbitHoleData = "\n=== RABBIT HOLE DISCOVERIES ===\n";
            validHoles.forEach((hole, i) => {
                rabbitHoleData += `
--- RABBIT HOLE ${i + 1}: ${hole!.direction} ---
Reasoning: ${hole!.reasoning}
Search: "${hole!.searchQuery}"

${deepDiveResults[i]}
`;
            });

            activeSources.push(`${validHoles.length} Rabbit Holes`);
            console.log(`[RESEARCH] Rabbit Holes (${validHoles.length}): ${rabbitHoleData.length} chars`);
        }
    }

    // ========================================
    // PHASE 3: THE MEETING - Synthesis
    // All 3 agents present findings to Lead Researcher (Gemini)
    // Cross-reference, identify high-confidence vs unique discoveries
    // ========================================
    if (onStatusUpdate) onStatusUpdate("The Meeting: Synthesizing all agent findings...");

    // Build prompt using extracted template with ALL 3 agents' data
    const prompt = buildTrendSearchPrompt({
        date,
        niche,
        viralityLevel,
        googleData,
        braveData,
        grokData,
        rabbitHoleData,
        isDiscovery,
    });

    console.log(`[RESEARCH] Synthesis prompt: ${prompt.length} chars`);

    const ai = getAI();

    try {
        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const text = response.text;
        console.log('Gemini API Response Text:', text?.substring(0, 500)); // Log first 500 chars

        if (!text) {
            console.error('No text in Gemini response');
            console.error('Full response:', JSON.stringify(response, null, 2));
            throw new Error('Gemini returned empty response. Please check your API key and try again.');
        }

        // Robust JSON extraction and cleaning
        const extractAndCleanJson = (rawText: string): string => {
            // Step 1: Remove markdown code blocks
            let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

            // Step 2: Find the JSON array boundaries more carefully
            // Look for [{ which starts an array of objects
            let start = cleaned.indexOf('[{');
            if (start === -1) {
                // Try finding [ followed by whitespace and {
                const match = cleaned.match(/\[\s*\{/);
                if (match) {
                    start = match.index!;
                } else {
                    start = cleaned.indexOf('[');
                }
            }

            // Find the matching closing bracket by counting brackets
            let end = -1;
            if (start !== -1) {
                let bracketCount = 0;
                let inString = false;
                let escapeNext = false;

                for (let i = start; i < cleaned.length; i++) {
                    const char = cleaned[i];

                    if (escapeNext) {
                        escapeNext = false;
                        continue;
                    }

                    if (char === '\\') {
                        escapeNext = true;
                        continue;
                    }

                    if (char === '"' && !escapeNext) {
                        inString = !inString;
                        continue;
                    }

                    if (!inString) {
                        if (char === '[') bracketCount++;
                        if (char === ']') {
                            bracketCount--;
                            if (bracketCount === 0) {
                                end = i;
                                break;
                            }
                        }
                    }
                }
            }

            // Fallback to lastIndexOf if bracket matching failed
            if (end === -1) {
                end = cleaned.lastIndexOf(']');
            }

            if (start === -1 || end === -1 || end <= start) {
                throw new Error('No JSON array found in response');
            }

            cleaned = cleaned.substring(start, end + 1);

            // Step 3: Clean problematic characters
            cleaned = cleaned
                // Remove control characters except \n, \r, \t
                .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
                // Replace arrow newlines with actual newlines
                .replace(/↵/g, '\n')
                // Fix common JSON issues: unescaped newlines inside strings
                .replace(/([^\\])(\r?\n)(?=[^"]*"[^"]*$)/gm, '$1\\n')
                .trim();

            return cleaned;
        };

        // Attempt to fix common JSON issues
        const attemptJsonRepair = (jsonStr: string): string => {
            let repaired = jsonStr;

            // Fix trailing commas before ] or }
            repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

            // Fix missing commas between array elements (between } and {)
            repaired = repaired.replace(/}(\s*){/g, '},$1{');

            // Escape unescaped quotes inside JSON string values
            // Process character by character to properly handle strings
            let result = '';
            let inString = false;
            let escapeNext = false;

            for (let i = 0; i < repaired.length; i++) {
                const char = repaired[i];

                if (escapeNext) {
                    result += char;
                    escapeNext = false;
                    continue;
                }

                if (char === '\\') {
                    result += char;
                    escapeNext = true;
                    continue;
                }

                if (char === '"') {
                    if (!inString) {
                        inString = true;
                        result += char;
                    } else {
                        // Check if this quote is followed by valid JSON structural characters
                        const nextChars = repaired.substring(i + 1).trimStart();
                        const isEndOfString = nextChars.length === 0 ||
                            nextChars.startsWith(',') ||
                            nextChars.startsWith('}') ||
                            nextChars.startsWith(']') ||
                            nextChars.startsWith(':');

                        if (isEndOfString) {
                            inString = false;
                            result += char;
                        } else {
                            // This quote appears to be inside a string - escape it
                            result += '\\"';
                        }
                    }
                } else {
                    result += char;
                }
            }

            return result;
        };

        let cleanJson: string;
        try {
            cleanJson = extractAndCleanJson(text);
        } catch (extractError) {
            console.error('Could not extract JSON from response:', text?.substring(0, 500));
            throw new Error('No JSON array found in response');
        }

        console.log('Cleaned JSON for parsing:', cleanJson.substring(0, 300)); // Log first 300 chars

        // Try parsing, with repair attempt on failure
        let trends: TrendData[];
        try {
            trends = JSON.parse(cleanJson) as TrendData[];
        } catch (parseError) {
            console.warn("Initial JSON parse failed, attempting repair...");
            console.log("Parse error:", parseError);

            try {
                const repairedJson = attemptJsonRepair(cleanJson);
                console.log('Repaired JSON (first 300 chars):', repairedJson.substring(0, 300));
                trends = JSON.parse(repairedJson) as TrendData[];
                console.log('✓ JSON repair successful');
            } catch (repairError) {
                console.error("JSON Parse Error (after repair attempt):", repairError);
                console.error("Failed JSON string (first 1000 chars):", cleanJson.substring(0, 1000));
                console.error("Failed JSON string (last 500 chars):", cleanJson.substring(Math.max(0, cleanJson.length - 500)));
                throw new Error(`Failed to parse trend data: ${parseError instanceof Error ? parseError.message : 'Invalid JSON format'}. The AI response contained malformed JSON.`);
            }
        }

        console.log('Successfully parsed trends:', trends.length, 'results');

        if (trends.length === 0) {
            console.warn('Gemini returned valid JSON but empty array');
            throw new Error('No trending topics found. Try adjusting virality level or search again.');
        }

        // Grounding Metadata Processing
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks && trends.length > 0) {
            const webChunks = chunks.filter((c: any) => c.web?.uri);
            trends.forEach((trend, i) => {
                const source = webChunks[i] || webChunks[0];
                if (source?.web?.uri) trend.sourceUrl = source.web.uri;

                // Validation: Ensure sources are accurate based on active keys
                if (!process.env.NEXT_PUBLIC_BRAVE_API_KEY) trend.sources = trend.sources?.filter(s => s !== 'Brave');
                if (!process.env.NEXT_PUBLIC_GROK_API_KEY) trend.sources = trend.sources?.filter(s => s !== 'Grok');
                if (!trend.sources || trend.sources.length === 0) trend.sources = ['Google'];
            });
        }
        return trends;

    } catch (error) {
        console.error("Error searching trends:", error);
        // Re-throw the error so it can be caught and displayed to the user
        throw error;
    }
};

export const analyzeNicheDeeply = async (niche: string): Promise<string> => {
    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: `Analyze the commercial viability of "${niche}" for Merch on Demand. Identify the "Viral Hook". Max 80 words.`,
        });
        return response.text || "Analysis unavailable.";
    } catch (e) {
        return "Analysis temporarily unavailable.";
    }
};

/**
 * Generate a SLIGHT variation of an existing listing
 * Creates near-identical designs for niche saturation (like Amazon sellers do)
 * Same concept, same keywords, minor visual/text tweaks
 */
export const generateListingVariation = async (
    trend: TrendData,
    sourceListing: GeneratedListing,
    variationIndex: number
): Promise<GeneratedListing> => {
    // Extract original keywords to pass to AI
    const originalKeywords = Array.isArray(sourceListing.keywords)
        ? sourceListing.keywords.join(', ')
        : 'Not available';

    const prompt = `
    You are creating a NICHE SATURATION variation for Amazon Merch.

    ORIGINAL WINNING DESIGN - COPY THESE CLOSELY:
    Title: ${sourceListing.title}
    Brand: ${sourceListing.brand}
    Design Text on Shirt: "${sourceListing.designText}"
    Bullet 1: ${sourceListing.bullet1 || 'Not provided'}
    Bullet 2: ${sourceListing.bullet2 || 'Not provided'}
    Description: ${sourceListing.description || 'Not provided'}
    Keywords: ${originalKeywords}
    Image Concept: ${sourceListing.imagePrompt || trend.visualStyle}

    VARIATION #${variationIndex} INSTRUCTIONS:

    KEEP EXACTLY THE SAME:
    - designText: Use EXACTLY "${sourceListing.designText}" (copy it character for character)
    - keywords: Copy ALL the original keywords listed above
    - The same niche, audience, and selling points
    - The same layout and composition

    VARY ONLY THESE:
    - title: Rearrange words slightly but keep all main keywords
    - brand: Create a new 3+ word brand name
    - bullet1/bullet2: Reword slightly, same selling points
    - description: Reword slightly, same message
    - refinementInstruction: A specific instruction to an AI image editor to modify the visual style while keeping the layout. Pick ONE:
      * Style ${variationIndex % 4 + 1}: ${['Change the art style to watercolor', 'Change the art style to retro pixel art', 'Change the art style to neon line art', 'Change the art style to vintage distressed'][variationIndex % 4]}

    CRITICAL FOR refinementInstruction:
    - Must be a direct command to the AI editor
    - Example: "Change the colors to a pastel palette" or "Apply a halftone texture effect"
    - DO NOT ask to change the text or the subject matter

    Return complete JSON with ALL fields filled:
    {
      "title": "...",
      "brand": "...",
      "bullet1": "200-256 chars...",
      "bullet2": "200-256 chars...",
      "description": "...",
      "keywords": ["copy", "all", "original", "keywords"],
      "refinementInstruction": "instruction to change style to ${['watercolor', 'pixel art', 'neon line art', 'vintage distressed'][variationIndex % 4]}",
      "designText": "${sourceListing.designText}"
    }
    `;

    const ai = getAI();
    const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: prompt,
        config: {
            systemInstruction: COMPLIANCE_SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    brand: { type: Type.STRING },
                    bullet1: { type: Type.STRING },
                    bullet2: { type: Type.STRING },
                    description: { type: Type.STRING },
                    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    refinementInstruction: { type: Type.STRING },
                    designText: { type: Type.STRING },
                }
            }
        },
    });

    // Clean markdown from response
    let cleanedText = (response.text || '{}').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const start = cleanedText.indexOf('{');
    const end = cleanedText.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
        cleanedText = cleanedText.substring(start, end + 1);
    }
    const parsed = JSON.parse(cleanedText);

    // Validate and provide defaults for required fields
    const listing: GeneratedListing = {
        title: parsed.title || sourceListing.title,
        brand: parsed.brand || sourceListing.brand,
        bullet1: parsed.bullet1 || sourceListing.bullet1,
        bullet2: parsed.bullet2 || sourceListing.bullet2,
        description: parsed.description || sourceListing.description,
        keywords: parsed.keywords || sourceListing.keywords,
        imagePrompt: parsed.imagePrompt || sourceListing.imagePrompt,
        refinementInstruction: parsed.refinementInstruction || `Variation ${variationIndex}`,
        designText: parsed.designText || sourceListing.designText,
    };

    return listing;
};

export const generateListing = async (trend: TrendData): Promise<GeneratedListing> => {
    const customerPhrasesContext = trend.customerPhrases ? trend.customerPhrases.join(", ") : "Use general slang";

    const prompt = `
    You are an expert Amazon Merch copywriter who deeply understands internet culture and knows how to write listings that convert.

    TREND RESEARCH CONTEXT:
    Topic: ${trend.topic}
    Platform Origin: ${trend.platform}
    Audience Sentiment: ${trend.sentiment}
    Visual Style Direction: ${trend.visualStyle}
    Typography Style: ${trend.typographyStyle || 'Not specified'}
    Volume/Popularity: ${trend.volume}
    Description: ${trend.description}
    Authentic Audience Language: ${customerPhrasesContext}
    Keywords Found in Research: ${trend.keywords?.join(', ') || 'Not specified'}

    YOUR CREATIVE MISSION:
    Write a listing that speaks directly to people who are INTO this trend. Don't write generically "about" the topic -
    write like you're part of the community. Use their language, reference their culture, capture the vibe.

    ${NATURAL_LANGUAGE_INSTRUCTION}

    CREATIVE APPROACH:

    1. **TITLE STRATEGY** (50-60 chars):
       - Think: What would make someone who's obsessed with this topic STOP scrolling?
       - Use the authentic phrases from the research, but compress them into searchable form
       - Focus on the aesthetic/vibe words that this community actually uses
       - Example structure: "[Specific Subject] [Cultural Reference] [Aesthetic Style]"
       - NOT generic: "Funny Cat Lover Design"
       - YES creative: "Chaotic Cat Mom Energy Distressed Vintage"

    2. **BRAND NAME** (3+ words):
       - Create a micro-brand that sounds like it emerged FROM this community
       - Think indie labels, underground studios, fan collectives
       - Match the energy: wholesome trends = wholesome brands, edgy trends = edgy brands
       - Examples by vibe:
         * Gaming/Tech: "Pixel Ghost Labs", "Terminal Velocity Supply"
         * Wholesome: "Cozy Corner Collective", "Gentle Chaos Co"
         * Edgy/Alt: "Void Aesthetic Press", "Feral Energy Studios"
         * Outdoor: "Summit Line Collective", "Trail Grit Supply"

    3. **BULLET 1** (200-256 chars - USE THE SPACE):
       - This is where you capture the IDENTITY and FEELING
       - Who wears this? What does wearing it SAY about them?
       - Reference the cultural context from the research
       - Use the authentic phrases the audience actually uses
       - Build a mini-narrative about wearing this
       - Example: "For those who understand that touching grass is overrated and goblin mode is a lifestyle, not a phase. This chaotic neutral energy graphic speaks to the chronically online, the midnight snackers, the 'just one more episode' crowd who embrace their feral side with zero apologies."

    4. **BULLET 2** (200-256 chars - USE THE SPACE):
       - This is where you describe the AESTHETIC and VISUAL STYLE
       - Reference the visual style from the research (use what the research specified, not defaults)
       - Use art/design terminology that the audience understands
       - Connect the visual choices to the cultural meaning
       - IMPORTANT: Match the style to what the RESEARCH found - don't default to any particular aesthetic
       - Example: "Distressed vintage typography meets hand-drawn illustration style reminiscent of classic Americana. Bold halftone textures and high-contrast composition create that perfectly worn, authentic vibe."

    5. **DESCRIPTION** (Detailed expansion):
       - Expand on bullets with more context and keywords
       - Tell the full story - why this design exists, who it's for
       - Include more search terms naturally woven into narrative
       - Go deeper into the culture and meaning

    6. **KEYWORDS** (20-30 terms):
       - Use the researched keywords as a base
       - Add related terms the audience would search for
       - Include aesthetic descriptors, cultural references, and style terms
       - Mix broad and specific (e.g., both "gamer" and "soulslike veteran")

    7. **DESIGN TEXT** (2-5 words MAX):
       - This is what actually appears ON the design
       - Use the most punchy, quotable phrase from the research
       - Or create a new phrase that captures the essence
       - Make it memeable, shareable, iconic
       - Examples: "Goblin Mode", "Touch Grass Challenge Failed", "Chronically Chill"

    8. **IMAGE PROMPT** (Detailed art direction):
       - Combine the visual style research with the topic
       - Be specific about composition, art style, effects
       - Reference the typography style from research
       - Give enough detail for accurate generation

    CRITICAL REMINDERS:
    - ABSORB the trend research - let it guide your voice and word choices
    - AVOID template language - each listing should feel unique to its trend
    - USE the authentic phrases from the research (${customerPhrasesContext})
    - MATCH the sentiment and platform culture (${trend.sentiment} vibe from ${trend.platform})
    - BE SPECIFIC not generic - "this is for gamers" vs "this is for Soulslike veterans who platinum'd Elden Ring"

    Now create a listing that would make someone deep in this community think "they GET it."
  `;

    const ai = getAI();
    const response = await withTimeout(
        ai.models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                systemInstruction: COMPLIANCE_SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        brand: { type: Type.STRING },
                        bullet1: { type: Type.STRING },
                        bullet2: { type: Type.STRING },
                        description: { type: Type.STRING },
                        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                        imagePrompt: { type: Type.STRING },
                        designText: { type: Type.STRING },
                    }
                }
            },
        }),
        API_TIMEOUTS.listing,
        'Listing generation timed out after 45 seconds'
    );

    // Clean markdown from response
    let cleanedText = (response.text || '{}').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const start = cleanedText.indexOf('{');
    const end = cleanedText.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
        cleanedText = cleanedText.substring(start, end + 1);
    }
    const parsed = JSON.parse(cleanedText);

    // Validate and provide defaults for required fields
    const listing: GeneratedListing = {
        title: parsed.title || `${trend.topic} T-Shirt`,
        brand: parsed.brand || 'Original Design',
        bullet1: parsed.bullet1 || `Perfect for ${trend.audienceProfile || 'fans'} who love ${trend.topic}.`,
        bullet2: parsed.bullet2 || `Features ${trend.visualStyle || 'unique'} design that stands out.`,
        description: parsed.description || `${trend.description || trend.topic} - A must-have for your collection.`,
        keywords: parsed.keywords || trend.keywords || [],
        imagePrompt: parsed.imagePrompt || `${trend.visualStyle || 'Modern'} t-shirt design featuring ${trend.topic}`,
        designText: parsed.designText || trend.designText || trend.topic?.split(' ').slice(0, 3).join(' ').toUpperCase() || 'DESIGN',
    };

    return listing;
};

const optimizeDesignPrompt = async (subject: string, style: string, typographyStyle?: string, text?: string): Promise<string> => {
    const prompt = `
        Role: Senior Art Director for Print-on-Demand T-Shirts.
        Goal: Create a prompt for a Vector Illustration Engine (Imagen/Gemini).

        ═══════════════════════════════════════════════════════════════
        CRITICAL: TEXT RENDERING (HIGHEST PRIORITY)
        ═══════════════════════════════════════════════════════════════

        Text to Render: "${text || ''}"
        Typography Style: ${typographyStyle || 'Bold, Clean Vector Font'}

        TEXT REQUIREMENTS:
        - Text must be CRISP, SHARP, and PERFECTLY LEGIBLE
        - Use Bold, Clean Vector Typography with defined edges
        - NO blurry letters, NO dithered edges, NO font merging
        - Text must be ISOLATED in its own zone (not merged with illustration)

        ═══════════════════════════════════════════════════════════════
        LAYOUT: VERTICAL STACK COMPOSITION (MANDATORY)
        ═══════════════════════════════════════════════════════════════

        Structure the design in THREE CLEAR ZONES:
        1. TOP ZONE: Text area (if applicable)
        2. MIDDLE ZONE: Main illustration/graphic
        3. BOTTOM ZONE: Secondary text or tagline (if applicable)

        CRITICAL: Maintain CLEAR VISUAL SEPARATION between zones.
        Use negative space to separate text from illustration.
        Text and graphics must be ISOLATED ELEMENTS, never merged.

        ═══════════════════════════════════════════════════════════════
        VISUAL CONTENT
        ═══════════════════════════════════════════════════════════════

        Subject: ${subject}
        Style: ${style}

        Chain of Thought:
        1. Identify any Copyright risks (names, logos) and replace with "Generic Archetypes".
        2. Apply VERTICAL STACK layout with isolated graphic elements.
        3. Define the specific vector technique (e.g., "Halftone", "Linocut", "Flat Design").

        KEYWORDS to Include: "Vertical Stack Composition", "Isolated Graphic Elements", "Vector Art", "Isolated on Black", "Bold Lines", "Crisp Edges", "Flat Colors", "8k", "No Dither", "No Semi-Transparent Pixels".
        KEYWORDS to Avoid: "Photo", "Realistic", "3D render", "Blur", "Badge", "Emblem", "Merged Text", "Integrated Typography".

        Output a dense, comma-separated prompt string only.
    `;

    const ai = getAI();
    const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: prompt,
    });

    return response.text || subject;
};

// --- ENHANCED DESIGN RESEARCH SYSTEM ---
// Leverages Gemini 3 Pro's advanced reasoning to create professional design briefs

/**
 * REMOVED: determineDesignAesthetic
 * We no longer force trends into predefined categories.
 * Instead, we trust Gemini 3 Pro to determine the best aesthetic approach
 * based on comprehensive education about t-shirt design principles.
 */

/**
 * REDESIGNED: Educated Design Research
 * Provides t-shirt design education to Gemini 3 Pro, then trusts its reasoning
 * to create the most appropriate design for the trend.
 *
 * This approach:
 * - Educates Gemini about professional t-shirt design principles
 * - Provides comprehensive context about the trend
 * - Trusts Gemini's advanced reasoning to determine the best approach
 * - Gives creative freedom while ensuring professional quality
 */
export const performDesignResearch = async (trend: TrendData, promptMode: PromptMode = 'advanced'): Promise<DesignResearch> => {
    const date = getCurrentDateContext();

    // Adjust instructions based on prompt mode
    const modeInstruction = promptMode === 'simple'
        ? `
        **MODE: SIMPLE & CLEAN**
        - Prioritize BOLD, MINIMALIST archetypes.
        - Avoid overly complex or distressed styles unless essential for the trend.
        - Focus on readability and immediate visual impact.
        - If selecting "dynamic", write a prompt structure that is short, punchy, and direct (~50 words).
        `
        : `
        **MODE: ADVANCED & DETAILED**
        - Prioritize RICH, TEXTURED, and DETAILED archetypes.
        - Encourage complex compositions and intricate details.
        - If selecting "dynamic", write a prompt structure that is descriptive and atmospheric (~150+ words).
        `;

    // Prepare Archetype descriptions for the AI
    const archetypeList = Object.values(ARCHETYPES)
        .filter(a => a.id !== 'dynamic')
        .map(a => `- ID: "${a.id}"\n  Name: ${a.name}\n  Description: ${a.description}`)
        .join('\n\n');

    const prompt = `
        You are a world-class t-shirt design strategist and Art Director.

        ${T_SHIRT_DESIGN_EDUCATION}

        ## YOUR CURRENT PROJECT (${date.fullDate})

        **TREND INTELLIGENCE:**
        Topic: ${trend.topic}
        Description: ${trend.description}
        Platform Origin: ${trend.platform}
        Volume/Momentum: ${trend.volume}
        Audience Sentiment: ${trend.sentiment}

        **VISUAL DIRECTION FROM RESEARCH:**
        Visual Style: ${trend.visualStyle}
        Typography: ${trend.typographyStyle || 'Determine based on audience'}
        Design Style: ${trend.designStyle || 'Determine based on trend'}
        Color Palette: ${trend.colorPalette || 'Determine based on vibe'}
        Suggested Effects: ${trend.designEffects?.join(', ') || 'Determine based on aesthetic'}

        **CUSTOMER LANGUAGE (USE THESE - They're authentic!):**
        Phrases: ${trend.customerPhrases?.join(' | ') || 'Create from trend context'}
        Purchase Signals: ${trend.purchaseSignals?.join(' | ') || 'N/A'}
        Suggested Text for Shirt: "${trend.designText || 'Create from phrases'}"

        **AUDIENCE PROFILE:**
        ${trend.audienceProfile || 'Determine from trend context'}

        **AMAZON MERCH COMPLIANCE:**
        Pre-verified Safe: ${trend.amazonSafe !== false ? 'Yes' : 'Needs careful review'}

        ${modeInstruction}

        ## STEP 1: ARCHETYPE SELECTION
        Review the following proven Design Archetypes. Select the one that BEST fits this trend.
        If NONE fit perfectly, select "dynamic" and you will write a custom prompt structure.

        ${archetypeList}

        ## STEP 2: DESIGN STRATEGY
        Using your expertise and the design principles above, create a comprehensive, professional design brief for a t-shirt that will resonate with this trend's audience.

        **APPROACH THIS CREATIVELY:**
        - You are NOT restricted to any predefined aesthetic category
        - Analyze the trend's cultural context and determine what design approach would work best
        - Consider who the audience is and what visual language speaks to them
        - Think about what makes this trend unique and how to capture that visually
        - Balance creative expression with commercial viability
        - Use the design principles as tools, not constraints

        ## STEP 3: SELF-CORRECTION
        Critique your own design plan. Is it too generic? Is it legible? 
        Refine the visual elements to be specific, bold, and "Kick Ass".

        **OUTPUT REQUIREMENTS:**

        Return a comprehensive design brief as JSON with this structure:
        {
            "archetypeId": "string - The ID of the chosen archetype (or 'dynamic')",
            "customPromptStructure": "string - ONLY if archetypeId is 'dynamic'. Write a 'Golden Prompt' template like: '\${aesthetic} style... \${subject}... 4500x5400px...'",
            "aesthetic": "string - describe the overall aesthetic approach",
            "targetDemographic": "string - detailed description of who this design is for",
            "designBrief": {
                "exactText": "string - the EXACT text to render (2-5 words)",
                "typography": {
                    "primaryFont": "string - specific font style description",
                    "weight": "string - font weight",
                    "effects": ["array of typography effects"],
                    "letterSpacing": "string - spacing approach",
                    "hierarchy": "string - text sizing and emphasis strategy"
                },
                "placement": {
                    "position": "string - exact placement on shirt",
                    "size": "string - specific size with measurements",
                    "orientation": "string - orientation and composition"
                },
                "visualElements": {
                    "primaryImagery": "string - main visual elements",
                    "style": "string - illustration style",
                    "composition": "string - how elements are arranged",
                    "effects": ["array of visual effects"]
                },
                "colorStrategy": {
                    "palette": "string - specific color palette",
                    "contrast": "string - contrast approach",
                    "meaning": "string - cultural/emotional significance of color choices"
                }
            },
            "culturalContext": "string - explain why this design approach works for this trend",
            "referenceStyles": ["array of 3-5 reference styles or design movements"]
        }
    `;

    try {
        const ai = getAI();
        const response = await withTimeout(
            ai.models.generateContent({
                model: TEXT_MODEL,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                },
            }),
            API_TIMEOUTS.research,
            'Design research timed out after 60 seconds'
        );

        const rawText = response.text || '';
        console.log('[Design Research] Raw response length:', rawText.length);

        if (!rawText || rawText.trim() === '') {
            console.warn('[Design Research] Empty response, using fallback');
            throw new Error('Empty response from AI');
        }

        // Clean markdown code blocks from response before parsing
        let cleanedText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

        // Find JSON object boundaries if wrapped in extra text
        const start = cleanedText.indexOf('{');
        const end = cleanedText.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) {
            console.error('[Design Research] No valid JSON object found in response:', cleanedText.substring(0, 500));
            throw new Error('No valid JSON object in response');
        }
        cleanedText = cleanedText.substring(start, end + 1);

        let research: DesignResearch;
        try {
            research = JSON.parse(cleanedText) as DesignResearch;
        } catch (parseError) {
            console.error('[Design Research] JSON parse failed. First 500 chars:', cleanedText.substring(0, 500));
            console.error('[Design Research] Last 200 chars:', cleanedText.substring(Math.max(0, cleanedText.length - 200)));
            throw parseError;
        }

        console.log(`✓ Design approach determined: ${research.aesthetic} `);
        return research;
    } catch (error) {
        console.error('Error performing design research:', error);

        // Return basic fallback
        return {
            aesthetic: 'custom',
            targetDemographic: `${trend.topic} enthusiasts`,
            designBrief: {
                exactText: trend.topic.split(' ').slice(0, 3).join(' ').toUpperCase(),
                typography: {
                    primaryFont: 'Bold sans-serif',
                    weight: 'bold',
                    effects: ['clean'],
                    letterSpacing: 'normal',
                    hierarchy: 'single level'
                },
                placement: {
                    position: 'center chest',
                    size: 'medium 8 inches',
                    orientation: 'horizontal'
                },
                visualElements: {
                    primaryImagery: trend.visualStyle,
                    style: 'vector graphic',
                    composition: 'centered',
                    effects: ['clean']
                },
                colorStrategy: {
                    palette: 'monochrome on black background',
                    contrast: 'high contrast',
                    meaning: 'bold and clear'
                }
            },
            culturalContext: trend.description,
            referenceStyles: ['Modern graphic design']
        };
    }
};

/**
 * Enhanced design prompt optimization using comprehensive design research
 * Replaces the basic optimizeDesignPrompt with research-driven approach
 *
 * STRUCTURE: Text-first primacy + Vertical Stack Layout
 */


/**
 * Creates a highly specific image generation prompt using the Data-Driven Design System.
 * 
 * STRATEGY:
 * 1. Select the best "Design Archetype" based on the trend keywords.
 * 2. Use the "Golden Prompt" structure defined in that archetype.
 * 3. Enforce Amazon Merch compliance (4500x5400px, full canvas).
 */
const createEnhancedDesignPrompt = async (research: DesignResearch, promptMode: PromptMode = 'advanced'): Promise<string> => {
    const { designBrief, culturalContext, referenceStyles } = research;

    // 1. Determine the best Archetype
    // In a real scenario, we might want to pass keywords from the trend data
    // to getArchetypeForTrend, but for now we rely on the AI's selection in 'research'
    // or fallback to dynamic if not specified.
    // Note: ARCHETYPES uses UPPERCASE keys, but archetypeId may be lowercase
    const archetypeId = research.archetypeId || 'DYNAMIC';
    const archetype = ARCHETYPES[archetypeId] || ARCHETYPES[archetypeId.toUpperCase()] || ARCHETYPES['DYNAMIC'];

    console.log(`✓ Selected Design Archetype: ${archetype.name}`);

    // 2. Construct the prompt using the Archetype's "Golden Template" or Custom Structure
    let promptTemplate = archetype.promptStructure;

    // If Dynamic Archetype was chosen and AI provided a custom structure, use that
    if (archetype.id === 'dynamic' && research.customPromptStructure) {
        console.log('✨ Using AI-Generated Custom Prompt Structure');
        promptTemplate = research.customPromptStructure;
    }

    // Split text into top/bottom if possible, otherwise just use exact text
    const words = designBrief.exactText.split(' ');
    const midPoint = Math.ceil(words.length / 2);
    const textTop = words.slice(0, midPoint).join(' ');
    const textBottom = words.slice(midPoint).join(' ');

    let prompt = promptTemplate
        .replace(/\${text_top}/g, textTop || designBrief.exactText)
        .replace(/\${text_bottom}/g, textBottom || '')
        .replace(/\${subject}/g, designBrief.visualElements.primaryImagery)
        .replace(/\${color}/g, 'black'); // Defaulting to black for now as per user preference

    // Handle DYNAMIC archetype specific variables (present in Dynamic Archetype OR Custom Structure)
    if (archetype.id === 'dynamic') {
        prompt = prompt
            .replace(/\${aesthetic}/g, research.aesthetic)
            .replace(/\${typography_style}/g, designBrief.typography.primaryFont)
            .replace(/\${visual_style}/g, designBrief.visualElements.style);
    }

    // 3. Append Technical & Compliance Enforcers (Redundant safety net)
    // Adjust detail level based on promptMode
    const detailInstruction = promptMode === 'simple'
        ? "STYLE: Keep it SIMPLE, CLEAN, and BOLD. Minimalist vector style. High contrast. No tiny details."
        : "STYLE: Highly detailed, professional vector art. Intricate textures, complex shading, and depth.";

    prompt += `
    
    ${detailInstruction}

    TECHNICAL REQUIREMENTS:
    - Dimensions: ${COMPLIANCE_RULES.dimensions.width}x${COMPLIANCE_RULES.dimensions.height} px
        - Background: Isolated on Pure Black(#000000)
            - Quality: High resolution, vector style, 300 DPI
                - Composition: Use the entire canvas, fill the space.
    - NO MOCKUPS, NO T - SHIRT PREVIEWS.Just the raw design file.
    `;

    return prompt;
};

/**
 * SIMPLE PROMPT GENERATOR
 * Creates conversational prompts based on user's successful example format.
 * Short, direct, natural language - lets the model's creativity shine.
 *
 * Example format that works well:
 * "Grunge style t-shirt design (no mockup) grunge style typography with the words
 * 'CAT MOTHER' at the top and 'LIVES HERE' at the bottom. Make it in a street wear
 * style using big typography and grunge effects. Add a relevant image in the middle
 * of the design. 4500x5400px use all the canvas. Make it for a black shirt."
 */
const createSimplePrompt = (
    subject: string,
    style: string,
    textOnDesign?: string,
    shirtColor: string = 'black'
): string => {
    // Parse text into top/bottom if it contains multiple parts
    const textParts = textOnDesign?.split(/\s+/).filter(Boolean) || [];
    let textInstruction = '';

    if (textParts.length > 0) {
        if (textParts.length <= 3) {
            // Short text - can be single placement
            textInstruction = `with the words '${textOnDesign?.toUpperCase()}' as the main focal point`;
        } else {
            // Longer text - split into top/bottom
            const midpoint = Math.ceil(textParts.length / 2);
            const topText = textParts.slice(0, midpoint).join(' ').toUpperCase();
            const bottomText = textParts.slice(midpoint).join(' ').toUpperCase();
            textInstruction = `with the words '${topText}' at the top and '${bottomText}' at the bottom`;
        }
    }

    // Determine style keywords
    const styleKeywords = style.toLowerCase();
    let styleDescription = 'bold typography and graphic effects';

    if (styleKeywords.includes('grunge') || styleKeywords.includes('distressed')) {
        styleDescription = 'big typography and grunge effects';
    } else if (styleKeywords.includes('vintage') || styleKeywords.includes('retro')) {
        styleDescription = 'vintage typography and retro effects';
    } else if (styleKeywords.includes('minimal')) {
        styleDescription = 'clean minimal typography';
    } else if (styleKeywords.includes('streetwear') || styleKeywords.includes('urban')) {
        styleDescription = 'bold streetwear typography and urban graphics';
    } else if (styleKeywords.includes('neon') || styleKeywords.includes('cyber')) {
        styleDescription = 'neon glow effects and cyberpunk styling';
    }

    // Determine contrast colors based on shirt
    const colorNote = shirtColor === 'white'
        ? 'Use dark colors that contrast with white.'
        : shirtColor === 'navy'
            ? 'Use light colors that contrast with navy.'
            : 'Use bright/white colors that contrast with black.';

    return `${style} t - shirt design(no mockup) ${styleDescription} ${textInstruction}. Make it in a ${style.toLowerCase()} style.Add a relevant image in the middle of the design. 4500x5400px use all the canvas.Make it for a ${shirtColor} shirt.${colorNote} `.trim();
};

/**
 * ADVANCED PROMPT GENERATOR (Existing approach)
 * Detailed, technical prompts with sections and constraints.
 */
const createAdvancedPrompt = async (
    basicPrompt: string,
    style: string,
    textOnDesign?: string,
    typographyStyle?: string,
    shirtColor: string = 'black'
): Promise<string> => {
    const optimizedPrompt = await optimizeDesignPrompt(basicPrompt, style, typographyStyle, textOnDesign);

    let colorStrategy = '';
    switch (shirtColor) {
        case 'white':
            colorStrategy = `
            TARGET SHIRT: WHITE
        - Design should use DARK colors that contrast with white
        - Primary: Black, Navy, Dark Grey for text and main elements
            - Accents: Bold colors like Red, Blue, Green pop well on white
                - AVOID: Light yellows, pale colors, white elements(will disappear)`;
            break;
        case 'navy':
            colorStrategy = `
            TARGET SHIRT: NAVY BLUE
        - Design should use LIGHT colors that contrast with navy
        - Primary: White, Cream, Light Grey for text and main elements
            - Accents: Gold, Orange, Light Blue, Yellow work well
                - AVOID: Dark blue, purple, black(poor contrast)`;
            break;
        case 'heather grey':
        case 'grey':
        case 'gray':
            colorStrategy = `
            TARGET SHIRT: HEATHER GREY
        - Design should use HIGH CONTRAST colors
            - Primary: Black or White for text(both work)
                - Accents: Bold saturated colors pop on grey
                    - AVOID: Light grey elements, muted tones(will blend)`;
            break;
        case 'black':
        default:
            colorStrategy = `
            TARGET SHIRT: BLACK
        - Design should use LIGHT / BRIGHT colors that contrast with black
        - Primary: White, Off - white, Cream for text and main elements
            - Accents: Neon colors, bright tones, metallic effects work well
                - AVOID: Dark colors, black elements(will disappear on shirt)`;
            break;
    }

    return `
        VECTOR T - SHIRT GRAPHIC using VERTICAL STACK COMPOSITION.

        ${optimizedPrompt}

        LAYOUT CONSTRAINTS:
    - Use THREE - ZONE vertical stack: TOP(text) → MIDDLE(graphic) → BOTTOM(optional text)
        - Text and illustration must be ISOLATED ELEMENTS with clear separation
            - Use NEGATIVE SPACE between zones

        ${colorStrategy}

        TECHNICAL CONSTRAINTS:
    - Background: #000000(Pure Black) - this will be removed, design floats on shirt
        - Format: Vertical 3: 4 Aspect Ratio
            - Style: Flat Vector, Crisp Edges, No Semi - Transparent Pixels
                - Text Rendering: SHARP, CRISP, ISOLATED(not merged with art)

        NEGATIVE PROMPTS(AVOID):
    Photorealistic, Photograph, Human Face, Skin Texture, Square Border, Frame, T - shirt Mockup,
        Blurry Text, Dithered Edges, Noisy Text, Font Merging, Text Integrated Into Art,
            Badge Style, Emblem Composition, Text Curving Through Images, Soft Edges On Text.
    `;
};

/**
 * REFINE DESIGN IMAGE (Image-to-Image Editing)
 * Sends an existing image + modification instruction to Gemini to get a refined version.
 * This allows users to make specific changes like "change text color to green" without
 * regenerating the entire design from scratch.
 *
 * @param imageUrl - Base64 data URL of the original image
 * @param instruction - User's modification instruction
 * @returns Base64 encoded image data URL of the refined image
 */
export const refineDesignImage = async (
    imageUrl: string,
    instruction: string
): Promise<string> => {
    try {
        console.log('🎨 Refining image with instruction:', instruction.substring(0, 50) + '...');

        // Extract base64 data from data URL
        const base64Match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!base64Match) {
            throw new Error('Invalid image URL format. Expected base64 data URL.');
        }

        const mimeType = base64Match[1];
        const base64Data = base64Match[2];

        // Build the refinement prompt
        const refinementPrompt = `
            You are editing an existing t - shirt design image.Make ONLY the specific change requested.
            Keep everything else in the image EXACTLY the same - same layout, same style, same composition.

            USER INSTRUCTION: "${instruction}"

            IMPORTANT RULES:
    - Make ONLY the change requested - nothing else
    - Preserve the exact layout and composition
        - Keep all text that wasn't mentioned in the same position
            - Maintain the same art style and quality
                - Keep the black background for transparency processing
                    - Ensure text remains CRISP and LEGIBLE

            Apply the requested change and return the modified design.
        `;

        // Send image + instruction to Gemini for refinement
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Data,
                            },
                        },
                        {
                            text: refinementPrompt,
                        },
                    ],
                },
            ],
        });

        // Extract refined image from response
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                const refinedImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                console.log('✓ Image refinement successful');
                return refinedImageUrl;
            }
        }

        throw new Error('No refined image generated in response');
    } catch (error) {
        console.error('Image Refinement Error:', error);
        throw error;
    }
};

export const generateDesignImage = async (
    basicPrompt: string,
    style: string,
    textOnDesign?: string,
    typographyStyle?: string,
    recommendedShirtColor?: string,
    promptMode: PromptMode = 'advanced'
): Promise<string> => {
    try {
        const shirtColor = recommendedShirtColor?.toLowerCase() || 'black';

        let finalPrompt: string;

        if (promptMode === 'simple') {
            // Use the conversational, short prompt approach
            finalPrompt = createSimplePrompt(basicPrompt, style, textOnDesign, shirtColor);
            console.log('🎨 Using SIMPLE prompt mode (~50 words)');
            console.log('Prompt:', finalPrompt);
        } else {
            // Use the detailed, technical prompt approach
            finalPrompt = await createAdvancedPrompt(basicPrompt, style, textOnDesign, typographyStyle, shirtColor);
            console.log('🎨 Using ADVANCED prompt mode (~500 words)');
        }

        // Using Gemini image generation (Nano Banana)
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: finalPrompt,
        });

        // Extract image from response - parts are nested under candidates[0].content.parts
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                // inlineData.data contains the base64 encoded image
                return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            }
        }

        throw new Error("No image generated in response");
    } catch (error) {
        console.error("Image Gen Error:", error);
        throw error;
    }
};

/**
 * ENHANCED: Generate design image using educated research pipeline
 * This leverages Gemini 3 Pro's capabilities for professional-grade designs
 * with creative freedom guided by comprehensive design education
 *
 * @param trend - The trend data to base the design on
 * @param useEnhancedResearch - Whether to use the full research pipeline (default: true)
 * @returns Base64 encoded image data URL and research brief
 */
export const generateDesignImageEnhanced = async (
    trend: TrendData,
    useEnhancedResearch: boolean = true,
    promptMode: PromptMode = 'advanced'
): Promise<{ imageUrl: string; research: DesignResearch }> => {
    try {
        let research: DesignResearch;

        if (useEnhancedResearch) {
            console.log('🎨 Starting educated design research pipeline...');

            // Step 1: Perform educated design research
            // Gemini 3 Pro receives comprehensive design education and determines
            // the best creative approach for this specific trend
            console.log('🔍 Educating Gemini and performing creative design research...');
            research = await performDesignResearch(trend, promptMode);
            console.log(`✓ Design approach: ${research.aesthetic} `);
            console.log('✓ Design research complete');

            // Step 2: Create enhanced design prompt
            console.log('📝 Creating professional design brief...');
            const designPrompt = await createEnhancedDesignPrompt(research, promptMode);
            console.log('✓ Design brief ready');

            // Step 3: Generate image with Gemini 3 Pro Image
            console.log('🖼️  Generating professional design...');

            const ai = getAI();
            const response = await ai.models.generateContent({
                model: IMAGE_MODEL,
                contents: designPrompt,
            });

            // Extract image from response
            const parts = response.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    const imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                    console.log('✓ Professional design generated successfully');
                    return { imageUrl, research };
                }
            }

            throw new Error("No image generated in enhanced pipeline");
        } else {
            // Fallback to basic generation
            console.log('Using basic design generation...');

            research = {
                aesthetic: 'custom',
                targetDemographic: `${trend.topic} enthusiasts`,
                designBrief: {
                    exactText: trend.topic.split(' ').slice(0, 3).join(' ').toUpperCase(),
                    typography: {
                        primaryFont: 'Bold sans-serif',
                        weight: 'bold',
                        effects: ['clean'],
                        letterSpacing: 'normal',
                        hierarchy: 'single level'
                    },
                    placement: {
                        position: 'center chest',
                        size: 'medium',
                        orientation: 'horizontal'
                    },
                    visualElements: {
                        primaryImagery: trend.visualStyle,
                        style: 'vector graphic',
                        composition: 'centered',
                        effects: []
                    },
                    colorStrategy: {
                        palette: 'monochrome',
                        contrast: 'high',
                        meaning: 'bold and clear'
                    }
                },
                culturalContext: trend.description,
                referenceStyles: ['Modern graphic design']
            };

            const imageUrl = await generateDesignImage(
                trend.visualStyle,
                trend.visualStyle,
                research.designBrief.exactText,
                trend.typographyStyle
            );

            return { imageUrl, research };
        }
    } catch (error) {
        console.error("Enhanced Image Gen Error:", error);
        throw error;
    }
};
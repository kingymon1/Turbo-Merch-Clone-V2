import { GoogleGenAI, Type } from "@google/genai";
import { TrendData, GeneratedListing, DesignResearch, PromptMode } from '../types';
import { COMPLIANCE_SYSTEM_INSTRUCTION, NATURAL_LANGUAGE_INSTRUCTION } from './compliance';
import { COMPLIANCE_RULES } from './design-system/compliance';
import { AI_CONFIG, TREND_CONFIG, API_ENDPOINTS, DESIGN_AESTHETICS } from '../config';
import { T_SHIRT_DESIGN_EDUCATION } from './prompts/design-education';
import { buildTrendSearchPrompt } from './prompts/trend-search';
import { ARCHETYPES, getArchetypeForTrend } from './design-system/archetypes';

// Lazy initialization of API client to prevent errors when env var is missing
// SECURITY: Prefer server-side GEMINI_API_KEY over client-exposed NEXT_PUBLIC_API_KEY
let aiClient: GoogleGenAI | null = null;
const getAI = () => {
    if (!aiClient) {
        // Prefer server-only key (when running in API routes)
        // Fall back to public key for backward compatibility during migration
        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY or NEXT_PUBLIC_API_KEY environment variable is not set');
        }
        aiClient = new GoogleGenAI({ apiKey });
    }
    return aiClient;
};

const TEXT_MODEL = AI_CONFIG.models.text;
const IMAGE_MODEL = AI_CONFIG.models.image;

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
const getGrokDateRange = (viralityLevel: number): { from_date: string; to_date: string } => {
    const today = new Date();
    let fromDate: Date;

    if (viralityLevel <= 25) {
        // SAFE: Past month - established trends
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 30);
    } else if (viralityLevel <= 50) {
        // BALANCED: Past 2 weeks - rising trends
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 14);
    } else if (viralityLevel <= 75) {
        // AGGRESSIVE: Past week - emerging trends
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 7);
    } else {
        // PREDICTIVE: Past 2 days - just appearing
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 2);
    }

    return {
        from_date: fromDate.toISOString().split('T')[0],
        to_date: today.toISOString().split('T')[0]
    };
};

// --- HELPER: Get Grok X source configuration based on virality level ---
const getGrokXSourceConfig = (viralityLevel: number): { type: string; post_favorite_count?: number; post_view_count?: number } => {
    if (viralityLevel <= 25) {
        // SAFE: Only established viral content
        return {
            type: "x",
            post_favorite_count: 5000,
            post_view_count: 100000
        };
    } else if (viralityLevel <= 50) {
        // BALANCED: Moderately popular content
        return {
            type: "x",
            post_favorite_count: 1000,
            post_view_count: 20000
        };
    } else if (viralityLevel <= 75) {
        // AGGRESSIVE: Lower threshold, catching rising content
        return {
            type: "x",
            post_favorite_count: 100,
            post_view_count: 5000
        };
    } else {
        // PREDICTIVE: No filters, catch everything
        return {
            type: "x"
        };
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

    const prompt = `
You are the GOOGLE SEARCH AGENT conducting INDEPENDENT research.

TODAY'S DATE: ${date.fullDate}
QUERY: "${query}"
RISK LEVEL: ${viralityLevel}% (${viralityLevel <= 25 ? 'Safe' : viralityLevel <= 50 ? 'Balanced' : viralityLevel <= 75 ? 'Aggressive' : 'Predictive'})

SEARCH FOCUS: Find ${searchFocus} content from ${timeContext}

YOUR MISSION:
Search Google for current news, discussions, and trending content related to "${query}".

SEARCH FOR:
1. CURRENT NEWS - What's happening RIGHT NOW related to this topic?
2. SEASONAL CONTEXT - Any holidays, events, or seasonal moments? (Today is ${date.month} ${date.year})
3. VIRAL CONTENT - What's being shared and discussed online?
4. COMMUNITY LANGUAGE - How are people talking about this?
5. PURCHASE SIGNALS - Any mentions of merchandise, products, or "I would buy" moments?

CRITICAL: Only report findings from ${date.month} ${date.year}. Reject anything older.

For each discovery, provide:
- What you found (specific topic or trend)
- Where you found it (source type)
- When it was posted/published
- Why it matters (cultural significance)
- Customer language quotes if available

Be thorough. Search multiple angles. Find what others might miss.
`;

    console.log(`[GOOGLE] Starting independent search for "${query}" (virality: ${viralityLevel})`);

    try {
        const response = await getAI().models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }], // Enable Google Search grounding
            }
        });

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
 * Uses DIRECT queries (not meta-content) to find actual trending topics
 * Makes parallel requests for web and news to maximize coverage
 * For higher risk levels, also searches for community discussions
 */
const fetchBraveSignals = async (query: string, viralityLevel: number): Promise<string> => {
    const apiKey = process.env.NEXT_PUBLIC_BRAVE_API_KEY;
    if (!apiKey) return "";

    const date = getCurrentDateContext();

    // Determine search strategy based on virality level
    let freshness: string;
    let count: number;
    let searchCommunity: boolean;

    if (viralityLevel <= 25) {
        // SAFE: Past month, established content - focus on mainstream sources
        freshness = "pm";
        count = 15;
        searchCommunity = false;
    } else if (viralityLevel <= 50) {
        // BALANCED: Past week - start including community voices
        freshness = "pw";
        count = 15;
        searchCommunity = true;
    } else if (viralityLevel <= 75) {
        // AGGRESSIVE: Past day - community discussions are KEY for early trends
        freshness = "pd";
        count = 20;
        searchCommunity = true;
    } else {
        // PREDICTIVE: Past day - community is where trends are BORN
        freshness = "pd";
        count = 25;
        searchCommunity = true;
    }

    // DIRECT query - search for the actual topic, not meta-content
    const searchQuery = `${query} ${date.month} ${date.year}`;

    console.log(`[BRAVE] Query: "${searchQuery}", Freshness: ${freshness}, Community: ${searchCommunity}`);

    try {
        // Make PARALLEL requests for web and news
        const webParams = new URLSearchParams({
            q: searchQuery,
            count: String(count),
            freshness: freshness,
            endpoint: 'web',
            extra_snippets: 'true'
        });

        const newsParams = new URLSearchParams({
            q: searchQuery,
            count: String(Math.min(count, 20)), // News endpoint max is usually 20
            freshness: freshness,
            endpoint: 'news'
        });

        // For higher risk levels, add a community-focused search
        // Uses terms that encourage finding discussions without naming specific platforms
        const communityQuery = `${query} discussion community thread opinions ${date.year}`;
        const communityParams = new URLSearchParams({
            q: communityQuery,
            count: String(15),
            freshness: freshness,
            endpoint: 'web',
            extra_snippets: 'true'
        });

        // Build request array - always web+news, optionally community
        const requests = [
            fetch(`/api/brave-search?${webParams.toString()}`),
            fetch(`/api/brave-search?${newsParams.toString()}`)
        ];

        if (searchCommunity) {
            requests.push(fetch(`/api/brave-search?${communityParams.toString()}`));
        }

        // Fetch all in parallel
        const responses = await Promise.all(requests);

        const webData = responses[0].ok ? await responses[0].json() : {};
        const newsData = responses[1].ok ? await responses[1].json() : {};
        const communityData = searchCommunity && responses[2]?.ok ? await responses[2].json() : {};

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
                        content: `Search live X/Twitter and news for: "${query}"

Date range: ${dateRange.from_date} to ${dateRange.to_date}

Find and report:
- Real posts/tweets discussing this topic (quote them)
- Current news articles about it
- Community reactions and language
- Memes, jokes, catchphrases being used
- Any merchandise/purchase intent signals

Return SPECIFIC findings with actual quotes and sources.`
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

    try {
        const response = await getAI().models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                tools: [{ googleSearch: {} }]
            }
        });
        return JSON.parse(response.text || "null");
    } catch (e) {
        console.warn("Rabbit hole exploration failed", e);
        return null;
    }
};

// --- CENTRAL ORCHESTRATOR: THE MEETING ---

export const searchTrends = async (niche: string, viralityLevel: number = 50, onStatusUpdate?: (msg: string) => void): Promise<TrendData[]> => {
    const date = getCurrentDateContext();
    const isDiscovery = niche.toLowerCase().includes('trending') ||
        niche.toLowerCase().includes('viral') ||
        niche.toLowerCase().includes('rising') ||
        niche.toLowerCase().includes('scan');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[RESEARCH] Starting 3-agent discovery`);
    console.log(`[RESEARCH] Query: "${niche}"`);
    console.log(`[RESEARCH] Virality: ${viralityLevel}% (${viralityLevel <= 25 ? 'Safe' : viralityLevel <= 50 ? 'Balanced' : viralityLevel <= 75 ? 'Aggressive' : 'Predictive'})`);
    console.log(`[RESEARCH] Date: ${date.fullDate}`);
    console.log(`${'='.repeat(60)}\n`);

    // ========================================
    // PHASE 1: INDEPENDENT EXPLORATION
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

    // Track which agents returned data
    const activeSources: string[] = [];
    if (googleData) {
        activeSources.push('Google');
        console.log(`[RESEARCH] Google: ${googleData.length} chars`);
    }
    if (braveData) {
        activeSources.push('Brave');
        console.log(`[RESEARCH] Brave: ${braveData.length} chars`);
    }
    if (grokData) {
        activeSources.push('Grok');
        console.log(`[RESEARCH] Grok: ${grokData.length} chars`);
    }

    if (onStatusUpdate) onStatusUpdate(`Agents returned: ${activeSources.join(', ')}`);

    // ========================================
    // PHASE 2: RABBIT HOLE (Optional Deep Dive)
    // If virality is high, look for underground threads
    // ========================================
    let rabbitHoleData = "";
    if (viralityLevel >= 55) {
        if (onStatusUpdate) onStatusUpdate("Looking for rabbit holes...");
        const combinedContext = (googleData + "\n" + braveData + "\n" + grokData).substring(0, 6000);
        const rabbitHole = await exploreRabbitHole(combinedContext, niche);

        if (rabbitHole) {
            if (onStatusUpdate) onStatusUpdate(`Exploring: ${rabbitHole.direction}...`);
            const deepDiveResults = await fetchBraveSignals(rabbitHole.searchQuery, viralityLevel);
            rabbitHoleData = `
=== RABBIT HOLE DISCOVERY ===
Direction: ${rabbitHole.direction}
Reasoning: ${rabbitHole.reasoning}
Search: "${rabbitHole.searchQuery}"

${deepDiveResults}
`;
            activeSources.push('Rabbit Hole');
            console.log(`[RESEARCH] Rabbit Hole: ${rabbitHoleData.length} chars`);
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

    try {
        const response = await getAI().models.generateContent({
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
    try {
        const response = await getAI().models.generateContent({
            model: TEXT_MODEL,
            contents: `Analyze the commercial viability of "${niche}" for Merch on Demand. Identify the "Viral Hook". Max 80 words.`,
        });
        return response.text || "Analysis unavailable.";
    } catch (e) {
        return "Analysis temporarily unavailable.";
    }
};

/**
 * Generate a variation of an existing listing
 * Uses the same trend/research but creates a distinctly different design
 */
export const generateListingVariation = async (
    trend: TrendData,
    sourceListing: GeneratedListing,
    variationIndex: number
): Promise<GeneratedListing> => {
    const customerPhrasesContext = trend.customerPhrases ? trend.customerPhrases.join(", ") : "Use general slang";

    const prompt = `
    You are an expert Amazon Merch copywriter creating a VARIATION of an existing design.

    ORIGINAL DESIGN REFERENCE (DO NOT COPY - Use as inspiration only):
    Title: ${sourceListing.title}
    Brand: ${sourceListing.brand}
    Design Text: ${sourceListing.designText}

    TREND CONTEXT:
    Topic: ${trend.topic}
    Platform Origin: ${trend.platform}
    Audience Sentiment: ${trend.sentiment}
    Visual Style Direction: ${trend.visualStyle}
    Typography Style: ${trend.typographyStyle || 'Not specified'}
    Authentic Audience Language: ${customerPhrasesContext}

    YOUR MISSION - VARIATION #${variationIndex}:
    Create a COMPLETELY DIFFERENT design that appeals to the SAME audience but with:
    - A DIFFERENT catchy phrase/slogan (2-5 words)
    - A DIFFERENT visual concept
    - A DIFFERENT title approach
    - The SAME overall vibe and quality

    VARIATION STRATEGIES (pick one):
    1. Different angle on the same topic (e.g., if original was about "cat mom life", try "feline obsession")
    2. Different emotional tone (e.g., if original was funny, try wholesome)
    3. Different visual metaphor (e.g., if original was minimal text, try graphic-heavy)
    4. Different catchphrase from the same culture

    REQUIREMENTS:
    - Title: 50-60 chars, SEO-optimized, DIFFERENT from original
    - Brand: Create a NEW micro-brand name (3+ words)
    - Design Text: 2-5 words MAX, catchy and DIFFERENT from "${sourceListing.designText}"
    - Bullets: Full 200-256 chars each, focus on the NEW design concept
    - Keywords: 20-30 terms, mix of original topic + new variation angle

    Return JSON with: title, brand, bullet1, bullet2, description, keywords[], imagePrompt, designText
    `;

    const response = await getAI().models.generateContent({
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
    });

    return JSON.parse(response.text || '{}') as GeneratedListing;
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

    const response = await getAI().models.generateContent({
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
    });

    return JSON.parse(response.text || '{}') as GeneratedListing;
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

    const response = await getAI().models.generateContent({
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
        const response = await getAI().models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                tools: [{ googleSearch: {} }], // Enable search for visual style research
            },
        });

        const research = JSON.parse(response.text || '{}') as DesignResearch;
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
    const archetypeId = research.archetypeId || 'dynamic';
    const archetype = ARCHETYPES[archetypeId] || ARCHETYPES['dynamic'];

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
        const response = await getAI().models.generateContent({
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
                const refinedImageUrl = `data:${part.inlineData.mimeType || 'image/png'}; base64, ${part.inlineData.data} `;
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
        const response = await getAI().models.generateContent({
            model: IMAGE_MODEL,
            contents: finalPrompt,
        });

        // Extract image from response - parts are nested under candidates[0].content.parts
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                // inlineData.data contains the base64 encoded image
                return `data:${part.inlineData.mimeType || 'image/png'}; base64, ${part.inlineData.data} `;
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
            const response = await getAI().models.generateContent({
                model: IMAGE_MODEL,
                contents: designPrompt,
            });

            // Extract image from response
            const parts = response.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    const imageUrl = `data:${part.inlineData.mimeType || 'image/png'}; base64, ${part.inlineData.data} `;
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
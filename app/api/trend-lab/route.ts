import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
const getAI = () => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing Gemini API key');
    return new GoogleGenAI({ apiKey });
};

const TEXT_MODEL = 'gemini-2.0-flash';

// Get current date context
const getCurrentDateContext = () => {
    const now = new Date();
    return {
        fullDate: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        month: now.toLocaleDateString('en-US', { month: 'long' }),
        year: now.getFullYear().toString(),
        timestamp: now.toISOString()
    };
};

// Interpretation level descriptions
const INTERPRETATION_CONFIG: Record<number, { name: string; focus: string; searchStyle: string }> = {
    0: {
        name: 'Commercial',
        focus: 'mainstream catchphrases, mass-appeal humor, proven design patterns',
        searchStyle: 'trending phrases, popular sayings, viral captions, gift-worthy slogans'
    },
    25: {
        name: 'Rising',
        focus: 'emerging phrases gaining traction, fresh takes on popular themes',
        searchStyle: 'new catchphrases, rising hashtags, emerging slang, up-and-coming trends'
    },
    50: {
        name: 'Niche',
        focus: 'community-specific content, targeted audiences, notable twists',
        searchStyle: 'subreddit favorites, community inside jokes, fandom references, hobbyist language'
    },
    75: {
        name: 'Underground',
        focus: 'subculture discoveries, unexpected connections, authentic voices',
        searchStyle: 'obscure communities, cult followings, micro-trends, crossover mashups'
    },
    100: {
        name: 'Extreme',
        focus: 'avant-garde, experimental, weird aesthetics, abstract concepts',
        searchStyle: 'weirdcore, liminal spaces, surreal humor, anti-mainstream aesthetics'
    }
};

// Get interpretation config based on slider value
const getInterpretationConfig = (value: number) => {
    const keys = Object.keys(INTERPRETATION_CONFIG).map(Number).sort((a, b) => a - b);
    const closest = keys.reduce((prev, curr) =>
        Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
    return INTERPRETATION_CONFIG[closest];
};

// Build constraint instructions for the prompt
const buildConstraintInstructions = (constraints: any[], agentFreedom: number): string => {
    if (!constraints || constraints.length === 0) {
        return 'No specific constraints - you have full creative freedom.';
    }

    const freedomModifier = agentFreedom < 30 ? 'STRICTLY REQUIRED' :
                           agentFreedom < 70 ? 'should be followed' :
                           'consider as suggestions';

    let instructions = `\n## User Constraints (${freedomModifier}):\n`;

    constraints.forEach((c, i) => {
        const strictnessLabel = c.strictness < 30 ? 'suggestion' :
                               c.strictness < 70 ? 'important' : 'REQUIRED';

        switch (c.type) {
            case 'phrase':
                instructions += `${i + 1}. [${strictnessLabel}] Design MUST include this phrase: "${c.value}"\n`;
                break;
            case 'element':
                instructions += `${i + 1}. [${strictnessLabel}] Design MUST include: ${c.value}\n`;
                break;
            case 'style':
                instructions += `${i + 1}. [${strictnessLabel}] Design style should be: ${c.value}\n`;
                break;
            case 'color':
                instructions += `${i + 1}. [${strictnessLabel}] Color palette: ${c.value}\n`;
                break;
            case 'exclude':
                instructions += `${i + 1}. [${strictnessLabel}] DO NOT include: ${c.value}\n`;
                break;
            case 'custom':
                instructions += `${i + 1}. [${strictnessLabel}] ${c.value}\n`;
                break;
        }
    });

    return instructions;
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, interpretation, agentFreedom, constraints } = body;

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        const date = getCurrentDateContext();
        const interpretConfig = getInterpretationConfig(interpretation || 25);
        const constraintInstructions = buildConstraintInstructions(constraints || [], agentFreedom || 50);

        console.log(`[TREND LAB] Query: "${query}"`);
        console.log(`[TREND LAB] Interpretation: ${interpretConfig.name} (${interpretation})`);
        console.log(`[TREND LAB] Agent Freedom: ${agentFreedom}`);
        console.log(`[TREND LAB] Constraints: ${constraints?.length || 0}`);

        // Build the search prompt based on interpretation level
        const prompt = `
You are a TREND DISCOVERY AGENT with live Google Search access.

TODAY: ${date.fullDate}
TOPIC: "${query}"
INTERPRETATION MODE: ${interpretConfig.name}
FOCUS: ${interpretConfig.focus}

═══════════════════════════════════════════════════════════════
YOUR MISSION
═══════════════════════════════════════════════════════════════

Search for ${interpretConfig.searchStyle} related to "${query}".

${interpretation <= 25 ? `
COMMERCIAL MODE PRIORITIES:
- Find catchy phrases like "Chillin with my Snowmies" - memorable, shareable, mass appeal
- Look for emerging sayings, puns, wordplay that people would want on a t-shirt
- Find "I need this" moments with MAINSTREAM appeal
- Search TikTok captions, Pinterest quotes, Etsy trending searches
- The design should be something a parent/grandparent would understand and buy
` : interpretation <= 50 ? `
RISING/NICHE MODE PRIORITIES:
- Find phrases/concepts gaining momentum but not yet saturated
- Look for community favorites that are crossing over to mainstream
- Find fresh takes on popular themes
- Balance creativity with commercial viability
` : `
UNDERGROUND/EXTREME MODE PRIORITIES:
- Find content from obscure communities
- Look for unexpected crossovers and mashups
- Prioritize authentic, surprising discoveries
- The weirder and more specific, the better
`}

${constraintInstructions}

═══════════════════════════════════════════════════════════════
SEARCH STRATEGY
═══════════════════════════════════════════════════════════════

Search these angles:
1. "${query} t-shirt sayings ${date.year}"
2. "${query} funny quotes"
3. "${query} trending phrases ${date.month}"
4. "${query} gift ideas"
5. "${query} memes ${date.year}"
${interpretation >= 50 ? `6. "${query} reddit"
7. "${query} community"
8. "${query} niche"` : ''}
${interpretation >= 75 ? `9. "${query} underground"
10. "${query} subculture"
11. "${query} crossover"` : ''}

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Return a JSON array with 5-8 trend opportunities.
Each MUST include clear design direction that matches the user's constraints.

[
  {
    "topic": "specific topic/phrase discovered",
    "platform": "where this was found",
    "volume": "Predictive" | "Rising" | "Breakout" | "High",
    "sentiment": "emotional vibe",
    "keywords": ["relevant", "keywords"],
    "description": "why this is a good opportunity, cultural context",
    "visualStyle": "SPECIFIC visual direction for the design",
    "typographyStyle": "font style recommendation",
    "designStyle": "overall aesthetic",
    "colorPalette": "recommended colors",
    "designEffects": ["effects to apply"],
    "customerPhrases": ["exact phrases people use"],
    "purchaseSignals": ["why people would buy this"],
    "designText": "THE TEXT THAT GOES ON THE SHIRT (2-8 words)",
    "audienceProfile": "who would buy this",
    "recommendedShirtColor": "black/white/navy/etc",
    "shirtColorReason": "why this color",
    "alternativeShirtColors": ["other options"],
    "amazonSafe": true,
    "sourceUrl": "URL where you found this",
    "interpretationLevel": "${interpretConfig.name}"
  }
]

${constraints?.some((c: any) => c.type === 'phrase') ?
    `CRITICAL: The designText field MUST contain the phrase specified by the user: "${constraints.find((c: any) => c.type === 'phrase')?.value}"` : ''}

${constraints?.some((c: any) => c.type === 'element') ?
    `CRITICAL: The visualStyle MUST describe how to incorporate: ${constraints.filter((c: any) => c.type === 'element').map((c: any) => c.value).join(', ')}` : ''}

BE CREATIVE BUT STAY ON THEME. Every result must clearly relate to "${query}".
`;

        // Call Gemini with Google Search grounding
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: interpretation >= 75 ? 1.0 : interpretation >= 50 ? 0.8 : 0.6,
            },
        });

        const text = response.text;

        if (!text) {
            throw new Error('Empty response from AI');
        }

        // Parse JSON from response
        let cleanJson = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const start = cleanJson.indexOf('[');
        const end = cleanJson.lastIndexOf(']');

        if (start === -1 || end === -1) {
            console.error('[TREND LAB] No JSON array found in response');
            throw new Error('Invalid response format');
        }

        cleanJson = cleanJson.substring(start, end + 1);
        const trends = JSON.parse(cleanJson);

        console.log(`[TREND LAB] Found ${trends.length} trends`);

        return NextResponse.json({ trends });

    } catch (error) {
        console.error('[TREND LAB] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Search failed' },
            { status: 500 }
        );
    }
}

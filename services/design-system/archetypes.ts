/**
 * Design Archetypes
 * 
 * The core of the Data-Driven Design System.
 * Each archetype is a proven "winning style" with strict rules for generation.
 * 
 * TEMPLATE VARIABLES:
 * ${subject} - The main topic/image
 * ${text} - The text to display
 * ${color} - Shirt color
 */

export interface DesignArchetype {
    id: string;
    name: string;
    keywords: string[]; // Triggers from trend research
    description: string;
    promptStructure: string; // The "Golden Prompt" template
    recommendedFontCategory: string;
}

export const ARCHETYPES: Record<string, DesignArchetype> = {
    GRUNGE_STREETWEAR: {
        id: 'grunge_streetwear',
        name: 'Grunge Streetwear',
        keywords: ['streetwear', 'edgy', 'urban', 'skate', 'grunge', 'dark', 'rebellious'],
        description: 'Bold, distressed, aggressive style popular with Gen Z',
        recommendedFontCategory: 'GRUNGE',
        promptStructure: `Grunge style t-shirt design (no mockup) grunge style typography with the words '\${text_top}' at the top and '\${text_bottom}' at the bottom. Make it in a street wear style using big typography and grunge effects. Add a relevant image of \${subject} in the middle of the design. 4500x5400px use all the canvas. Make it for a \${color} shirt.`
    },

    RETRO_SUNSET: {
        id: 'retro_sunset',
        name: 'Retro Sunset',
        keywords: ['70s', '80s', 'vintage', 'retro', 'sunset', 'nostalgia', 'outdoors'],
        description: 'Classic distressed sunset stripes with silhouette imagery',
        recommendedFontCategory: 'RETRO_SERIF',
        promptStructure: `Vintage 70s style t-shirt design (no mockup) retro typography with the words '\${text_top}' at the top and '\${text_bottom}' at the bottom. Make it in a vintage style using a distressed sunset stripe background and silhouette vector art of \${subject}. 4500x5400px use all the canvas. Make it for a \${color} shirt.`
    },

    MINIMALIST_LINE_ART: {
        id: 'minimalist_line_art',
        name: 'Minimalist Line Art',
        keywords: ['minimal', 'clean', 'modern', 'line art', 'simple', 'aesthetic'],
        description: 'Clean, single-weight line illustration with modern sans-serif text',
        recommendedFontCategory: 'MINIMALIST',
        promptStructure: `Minimalist line art t-shirt design (no mockup) clean modern typography with the words '\${text_top}' at the top and '\${text_bottom}' at the bottom. Make it in a clean aesthetic style using single-weight line art of \${subject}. White lines on black background. 4500x5400px use all the canvas. Make it for a \${color} shirt.`
    },

    Y2K_CYBER: {
        id: 'y2k_cyber',
        name: 'Y2K Cyber',
        keywords: ['y2k', 'cyber', 'futuristic', 'tech', 'gaming', 'glitch', '2000s'],
        description: 'Futuristic, chrome, liquid metal, and glitch aesthetics',
        recommendedFontCategory: 'STREETWEAR',
        promptStructure: `Y2K futuristic t-shirt design (no mockup) chrome type typography with the words '\${text_top}' at the top and '\${text_bottom}' at the bottom. Make it in a cyberpunk style using liquid metal effects, tribal tattoos, and glitch art of \${subject}. 4500x5400px use all the canvas. Make it for a \${color} shirt.`
    },

    VINTAGE_COLLEGIATE: {
        id: 'vintage_collegiate',
        name: 'Vintage Collegiate',
        keywords: ['college', 'university', 'varsity', 'sports', 'team', 'classic'],
        description: 'Traditional American university style with arched text',
        recommendedFontCategory: 'VINTAGE_ATHLETIC',
        promptStructure: `Vintage collegiate t-shirt design (no mockup) arched varsity typography with the words '\${text_top}' at the top and '\${text_bottom}' at the bottom. Make it in a classic university style using distressed texture and a mascot illustration of \${subject} in the center. 4500x5400px use all the canvas. Make it for a \${color} shirt.`
    },

    UGLY_CHRISTMAS_SWEATER: {
        id: 'ugly_christmas_sweater',
        name: 'Ugly Christmas Sweater',
        keywords: ['christmas', 'xmas', 'holiday', 'festive', 'santa', 'snowman', 'reindeer', 'ugly sweater', 'knit'],
        description: 'Classic knitted ugly christmas sweater pattern style',
        recommendedFontCategory: 'KNITTED',
        promptStructure: `Ugly Christmas Sweater style t-shirt design (no mockup) knitted pixel art typography with the words '\${text_top}' at the top and '\${text_bottom}' at the bottom. Make it in a faux-knit style using red and green pixel patterns and an 8-bit pixel art illustration of \${subject}. 4500x5400px use all the canvas. Make it for a \${color} shirt.`
    },

    DYNAMIC: {
        id: 'dynamic',
        name: 'Dynamic Trend Match',
        keywords: [], // No keywords, this is the fallback
        description: 'Adapts to any trend by using the AI research data',
        recommendedFontCategory: 'MINIMALIST', // Default, but overridden in logic
        promptStructure: `\${aesthetic} style t-shirt design (no mockup) \${typography_style} typography with the words '\${text_top}' at the top and '\${text_bottom}' at the bottom. Make it in a \${aesthetic} style using \${visual_style} of \${subject}. 4500x5400px use all the canvas. Make it for a \${color} shirt.`
    }
};

export const getArchetypeForTrend = (trendKeywords: string[]): DesignArchetype => {
    // Simple keyword matching logic
    // In a real system, this could be an LLM call or weighted scoring
    let bestMatch = ARCHETYPES.DYNAMIC; // Default to DYNAMIC now
    let maxScore = 0;

    for (const key in ARCHETYPES) {
        if (key === 'DYNAMIC') continue; // Skip dynamic in search

        const archetype = ARCHETYPES[key];
        let score = 0;
        trendKeywords.forEach(kw => {
            if (archetype.keywords.some(akw => kw.toLowerCase().includes(akw))) {
                score++;
            }
        });

        if (score > maxScore) {
            maxScore = score;
            bestMatch = archetype;
        }
    }

    return bestMatch;
};

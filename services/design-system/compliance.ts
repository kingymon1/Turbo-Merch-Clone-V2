/**
 * Amazon Merch on Demand Compliance Rules
 * 
 * STRICTLY ENFORCED rules for all generated designs.
 */

export const COMPLIANCE_RULES = {
    // Dimensions are non-negotiable for standard t-shirts
    dimensions: {
        width: 4500,
        height: 5400,
        unit: 'px'
    },

    // Content policies (basic regex checks)
    bannedTerms: [
        // Sports brands
        'nike', 'adidas', 'puma', 'reebok', 'under armour',
        // Entertainment
        'disney', 'marvel', 'dc comics', 'star wars', 'harry potter', 'pixar', 'dreamworks',
        'netflix', 'hbo', 'paramount', 'warner bros',
        // Toys/Games
        'lego', 'barbie', 'funko', 'hot wheels', 'hasbro', 'mattel',
        // Video games
        'pokemon', 'nintendo', 'sega', 'playstation', 'xbox', 'sony',
        'roblox', 'minecraft', 'fortnite', 'epic games', 'call of duty', 'cod',
        'mario', 'zelda', 'pikachu', 'league of legends', 'valorant', 'apex legends',
        // Tech
        'apple', 'google', 'microsoft', 'amazon', 'meta', 'facebook', 'instagram', 'tiktok',
        // Sports leagues
        'nfl', 'nba', 'mlb', 'nhl', 'fifa', 'ufc', 'wwe',
        // Other
        'official', 'licensed', 'copyright', 'trademark', 'coca cola', 'pepsi', 'mcdonalds'
    ],

    // Design requirements
    requirements: [
        'Use all the canvas',
        'No mockup',
        'Isolated on black background',
        '300 DPI equivalent quality'
    ]
};

export const checkCompliance = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return !COMPLIANCE_RULES.bannedTerms.some(term => lowerText.includes(term));
};

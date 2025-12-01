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
        'nike', 'adidas', 'disney', 'marvel', 'star wars', 'harry potter',
        'lego', 'barbie', 'funko', 'pokemon', 'nintendo', 'sega',
        'official', 'licensed', 'copyright', 'trademark'
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

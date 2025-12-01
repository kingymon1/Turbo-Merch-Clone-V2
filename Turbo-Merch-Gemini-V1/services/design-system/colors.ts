/**
 * Color Palette Library
 * 
 * Curated color combinations that work well for specific vibes.
 * Includes rules for which shirt colors they support.
 */

export interface ColorPalette {
    name: string;
    colors: string[]; // Hex codes or descriptive names
    supportedShirtColors: ('black' | 'white' | 'navy' | 'heather grey')[];
    description: string;
}

export const COLOR_LIBRARY: Record<string, ColorPalette[]> = {
    RETRO: [
        {
            name: '70s Sunset',
            colors: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF'],
            supportedShirtColors: ['black', 'white', 'navy'],
            description: 'Warm, nostalgic sunset tones'
        },
        {
            name: 'Vintage Sport',
            colors: ['Mustard Yellow', 'Maroon', 'Navy Blue', 'Cream'],
            supportedShirtColors: ['heather grey', 'white'],
            description: 'Classic collegiate athletic colors'
        }
    ],
    NEON_CYBER: [
        {
            name: 'Cyberpunk',
            colors: ['Neon Pink', 'Cyan', 'Electric Purple', 'Acid Green'],
            supportedShirtColors: ['black'],
            description: 'High contrast neon against dark background'
        },
        {
            name: 'Glitch',
            colors: ['RGB Red', 'RGB Green', 'RGB Blue', 'White'],
            supportedShirtColors: ['black'],
            description: 'Digital screen primary colors'
        }
    ],
    EARTH_TONES: [
        {
            name: 'National Park',
            colors: ['Forest Green', 'Burnt Orange', 'Tan', 'Brown'],
            supportedShirtColors: ['white', 'heather grey', 'black'],
            description: 'Natural, organic outdoor colors'
        },
        {
            name: 'Desert',
            colors: ['Terracotta', 'Sage Green', 'Sand', 'Dusty Rose'],
            supportedShirtColors: ['white', 'black'],
            description: 'Muted, warm desert landscape tones'
        }
    ],
    MONOCHROME: [
        {
            name: 'High Contrast White',
            colors: ['White', 'Light Grey'],
            supportedShirtColors: ['black', 'navy'],
            description: 'Pure white for maximum readability on dark shirts'
        },
        {
            name: 'High Contrast Black',
            colors: ['Black', 'Dark Grey'],
            supportedShirtColors: ['white', 'heather grey'],
            description: 'Pure black for maximum readability on light shirts'
        }
    ],
    PASTEL: [
        {
            name: 'Kawaii',
            colors: ['Pastel Pink', 'Mint Green', 'Baby Blue', 'Lavender'],
            supportedShirtColors: ['white', 'black'],
            description: 'Soft, cute, candy-colored tones'
        }
    ]
};

export const getPaletteForVibe = (vibe: string, shirtColor: string): ColorPalette => {
    // Simple logic to find a palette that supports the shirt color
    // In a real system, this would be smarter
    const allPalettes = Object.values(COLOR_LIBRARY).flat();
    const validPalettes = allPalettes.filter(p => p.supportedShirtColors.includes(shirtColor as any));
    return validPalettes[Math.floor(Math.random() * validPalettes.length)];
};

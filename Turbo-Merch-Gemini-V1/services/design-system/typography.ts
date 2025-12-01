/**
 * Typography Library
 * 
 * A curated list of font styles and specific font names that the image model 
 * is known to render well.
 */

export const TYPOGRAPHY_LIBRARY = {
    categories: {
        GRUNGE: [
            'Distressed Impact', 'Grunge Sans', 'Eroded Gothic', 'Destroyed Serif',
            'Stencil Rough', 'Bleeding Cowboys style', 'Shattered', 'Worn Vintage'
        ],
        RETRO_SERIF: [
            'Cooper Black', 'Serif Gothic', 'Souvenir', 'Windsor',
            'Bookman Swash', 'Goudy Heavy', 'Candice', 'Recurso'
        ],
        STREETWEAR: [
            'Gothic Blackletter', 'Extended Sans-Serif', 'Chrome Type', 'Acid Graphics Font',
            'Y2K Futuristic', 'Liquid Metal', 'Graffiti Tag', 'Brutalism Mono'
        ],
        MINIMALIST: [
            'Helvetica Now', 'Futura Bold', 'Avant Garde', 'Geometric Sans',
            'DIN Condensed', 'Montserrat Bold', 'Clean Line', 'Swiss Style'
        ],
        HANDWRITTEN: [
            'Marker Felt', 'Brush Script', 'Signature Style', 'Rough Pen',
            'Chalkboard', 'Dry Brush', 'Graffiti Marker', 'Messy Scribble'
        ],
        VINTAGE_ATHLETIC: [
            'Varsity Block', 'Collegiate Slab', 'Athletic Script', 'Jersey Number',
            'Team Spirit', 'Vintage Pennant', 'Old School Gym', 'Letterman'
        ],
        KNITTED: [
            'Pixel Art', '8-Bit Wonder', 'Knitted Font', 'Cross Stitch',
            'Retro Computer', 'Bitmap', 'Needlepoint', 'Sweater Stitch'
        ]
    },

    effects: [
        'Distressed Texture Overlay',
        'Halftone Pattern',
        'Drop Shadow',
        'Outline Stroke',
        'Warped / Arched',
        'Glitch Effect',
        'Chrome Reflection',
        'Neon Glow',
        'Vintage Fade',
        'Grainy Noise'
    ]
};

export const getRandomFont = (category: keyof typeof TYPOGRAPHY_LIBRARY.categories): string => {
    const fonts = TYPOGRAPHY_LIBRARY.categories[category];
    return fonts[Math.floor(Math.random() * fonts.length)];
};

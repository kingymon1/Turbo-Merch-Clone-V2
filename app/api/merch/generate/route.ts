import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { GenerationRequest, GenerationResponse, MerchDesign } from '@/lib/merch/types';

// Mock phrases for autopilot mode based on risk level
const AUTOPILOT_PHRASES = {
  low: [
    "World's Okayest Nurse",
    "Best Dad Ever",
    "Coffee Then Adulting",
    "Dog Mom Life",
    "Teacher Mode On",
  ],
  medium: [
    "Tacos Are My Love Language",
    "Professional Overthinker",
    "Fluent in Sarcasm",
    "Napping Champion",
    "Powered by Caffeine",
  ],
  high: [
    "I Survived Another Meeting",
    "Chaos Coordinator",
    "Adulting is Overrated",
    "Plot Twist Master",
    "Professional Procrastinator",
  ],
};

const NICHES = ['nurses', 'teachers', 'dog lovers', 'coffee lovers', 'parents', 'gamers', 'fitness', 'tech'];
const STYLES = ['Bold Modern', 'Vintage Retro', 'Minimalist', 'Distressed', 'Playful'];

function getMockPhrase(riskLevel: number): { phrase: string; niche: string } {
  let phrases: string[];
  if (riskLevel < 30) {
    phrases = AUTOPILOT_PHRASES.low;
  } else if (riskLevel < 70) {
    phrases = AUTOPILOT_PHRASES.medium;
  } else {
    phrases = AUTOPILOT_PHRASES.high;
  }

  const phrase = phrases[Math.floor(Math.random() * phrases.length)];
  const niche = NICHES[Math.floor(Math.random() * NICHES.length)];

  return { phrase, niche };
}

function generateMockDesign(
  userId: string,
  mode: 'autopilot' | 'manual',
  phrase: string,
  niche: string,
  style?: string,
  tone?: string,
  riskLevel?: number,
  userSpecs?: any
): Omit<MerchDesign, 'id' | 'createdAt' | 'updatedAt'> {
  const selectedStyle = style || STYLES[Math.floor(Math.random() * STYLES.length)];

  return {
    userId,
    mode,
    riskLevel: riskLevel,
    sourceData: mode === 'autopilot' ? { riskLevel, generatedAt: new Date().toISOString() } : undefined,
    userSpecs: mode === 'manual' ? userSpecs : undefined,
    phrase,
    niche,
    style: selectedStyle,
    tone: tone || 'Funny',
    imageUrl: `https://placehold.co/400x400/1a1a2e/00d4ff/png?text=${encodeURIComponent(phrase.substring(0, 20))}`,
    imagePrompt: `Create a ${selectedStyle.toLowerCase()} t-shirt design featuring the text "${phrase}" for ${niche}. Style: clean, print-ready, transparent background.`,
    listingTitle: `${phrase} - Funny ${niche.charAt(0).toUpperCase() + niche.slice(1)} Gift - Perfect Shirt`,
    listingBullets: [
      `Perfect gift for ${niche} who appreciate humor`,
      'Premium quality fabric for maximum comfort',
      'Vibrant print that lasts wash after wash',
      'Available in multiple sizes and colors',
      'Makes a great birthday or holiday gift',
    ],
    listingDesc: `Looking for the perfect gift for ${niche}? This "${phrase}" shirt is exactly what you need! Our premium quality tee features a ${selectedStyle.toLowerCase()} design that's sure to get laughs and compliments. Whether it's for a birthday, holiday, or just because, this shirt makes the perfect present. Order now and make someone smile!`,
    approved: false,
    approvedAt: undefined,
    userRating: undefined,
    views: 0,
    sales: 0,
    parentId: undefined,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<GenerationResponse>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: GenerationRequest = await request.json();
    const { mode, riskLevel, specs } = body;

    // Validate request
    if (!mode || (mode !== 'autopilot' && mode !== 'manual')) {
      return NextResponse.json(
        { success: false, error: 'Invalid mode. Must be "autopilot" or "manual".' },
        { status: 400 }
      );
    }

    if (mode === 'manual' && (!specs || !specs.exactText)) {
      return NextResponse.json(
        { success: false, error: 'Manual mode requires specs.exactText.' },
        { status: 400 }
      );
    }

    if (mode === 'autopilot' && (riskLevel === undefined || riskLevel < 0 || riskLevel > 100)) {
      return NextResponse.json(
        { success: false, error: 'Autopilot mode requires riskLevel between 0-100.' },
        { status: 400 }
      );
    }

    // Generate mock design data
    let phrase: string;
    let niche: string;
    let style: string | undefined;
    let tone: string | undefined;

    if (mode === 'autopilot') {
      const mockData = getMockPhrase(riskLevel!);
      phrase = mockData.phrase;
      niche = mockData.niche;
    } else {
      phrase = specs!.exactText;
      niche = specs!.niche || 'general';
      style = specs!.style;
      tone = specs!.tone;
    }

    const designData = generateMockDesign(
      userId,
      mode,
      phrase,
      niche,
      style,
      tone,
      riskLevel,
      specs
    );

    // Save to database
    const savedDesign = await prisma.merchDesign.create({
      data: {
        userId: designData.userId,
        mode: designData.mode,
        riskLevel: designData.riskLevel,
        sourceData: designData.sourceData,
        userSpecs: designData.userSpecs,
        phrase: designData.phrase,
        niche: designData.niche,
        style: designData.style,
        tone: designData.tone,
        imageUrl: designData.imageUrl,
        imagePrompt: designData.imagePrompt,
        listingTitle: designData.listingTitle,
        listingBullets: designData.listingBullets,
        listingDesc: designData.listingDesc,
        approved: designData.approved,
        views: designData.views,
        sales: designData.sales,
      },
    });

    // Transform to response format
    const design: MerchDesign = {
      id: savedDesign.id,
      createdAt: savedDesign.createdAt,
      updatedAt: savedDesign.updatedAt,
      userId: savedDesign.userId,
      mode: savedDesign.mode as 'autopilot' | 'manual',
      riskLevel: savedDesign.riskLevel ?? undefined,
      sourceData: savedDesign.sourceData,
      userSpecs: savedDesign.userSpecs as any,
      phrase: savedDesign.phrase,
      niche: savedDesign.niche,
      style: savedDesign.style ?? undefined,
      tone: savedDesign.tone ?? undefined,
      imageUrl: savedDesign.imageUrl,
      imagePrompt: savedDesign.imagePrompt,
      listingTitle: savedDesign.listingTitle,
      listingBullets: savedDesign.listingBullets,
      listingDesc: savedDesign.listingDesc,
      approved: savedDesign.approved,
      approvedAt: savedDesign.approvedAt ?? undefined,
      userRating: savedDesign.userRating ?? undefined,
      views: savedDesign.views,
      sales: savedDesign.sales,
      parentId: savedDesign.parentId ?? undefined,
    };

    return NextResponse.json({
      success: true,
      design,
    });
  } catch (error) {
    console.error('[Merch Generate] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate design' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch user's designs
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    const designs = await prisma.merchDesign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.merchDesign.count({
      where: { userId },
    });

    return NextResponse.json({
      success: true,
      designs: designs.map((d) => ({
        id: d.id,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        userId: d.userId,
        mode: d.mode,
        riskLevel: d.riskLevel,
        phrase: d.phrase,
        niche: d.niche,
        style: d.style,
        tone: d.tone,
        imageUrl: d.imageUrl,
        imagePrompt: d.imagePrompt,
        listingTitle: d.listingTitle,
        listingBullets: d.listingBullets,
        listingDesc: d.listingDesc,
        approved: d.approved,
        views: d.views,
        sales: d.sales,
      })),
      total,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('[Merch Generate] Error fetching designs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch designs' },
      { status: 500 }
    );
  }
}

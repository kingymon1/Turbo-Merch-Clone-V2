/**
 * POST /api/merch/generate
 *
 * Server-side endpoint for generating merch designs.
 * Integrates with existing Gemini services for AI generation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { GenerationRequest, GenerationResponse, MerchDesign } from '@/lib/merch/types';
import { createImagePrompt, DesignConcept } from '@/lib/merch/image-prompter';
import { generateMerchListing } from '@/lib/merch/listing-generator';
import { generateMerchImage, generatePlaceholderImage, isValidImageUrl } from '@/lib/merch/image-generator';
import { generateAutopilotConcept } from '@/lib/merch/autopilot-generator';
import { logInsightUsage } from '@/lib/merch/learning';

// Increase timeout for AI generation (max 300s on Vercel Pro)
export const maxDuration = 300;

// Feature flag: set to true to use mock data instead of real AI generation
const USE_MOCK_DATA = process.env.MERCH_USE_MOCK === 'true';

/**
 * Generate mock data for testing (when AI services unavailable)
 */
function generateMockData(
  phrase: string,
  niche: string,
  style: string,
  tone: string
): { imageUrl: string; imagePrompt: string; listing: { title: string; bullets: string[]; description: string } } {
  return {
    imageUrl: generatePlaceholderImage(phrase, style),
    imagePrompt: `Mock prompt for: ${phrase}`,
    listing: {
      title: `${phrase} - ${tone} ${niche.charAt(0).toUpperCase() + niche.slice(1)} Gift`,
      bullets: [
        `Perfect gift for ${niche} who appreciate ${tone.toLowerCase()} designs`,
        'Premium quality fabric for maximum comfort',
        'Vibrant print that lasts wash after wash',
        'Available in multiple sizes and colors',
        'Makes a great birthday or holiday gift',
      ],
      description: `Looking for the perfect gift for ${niche}? This "${phrase}" shirt is exactly what you need! Our premium quality tee features a ${style.toLowerCase()} design that's sure to get laughs and compliments.`,
    },
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

    console.log(`[Merch Generate] Starting ${mode} mode generation`);

    let concept: DesignConcept;
    let sourceData: any = {};
    let isTest = USE_MOCK_DATA;
    let appliedInsights: any[] = []; // Phase 6: Track insights used

    // ========================================
    // STEP 1: Generate or extract concept
    // ========================================
    if (mode === 'autopilot') {
      console.log(`[Merch Generate] Autopilot mode at risk level ${riskLevel}`);

      if (USE_MOCK_DATA) {
        // Mock mode: use simple fallback
        concept = {
          phrase: ['Coffee Then Adulting', 'Living My Best Life', 'Chaos Coordinator'][Math.floor(Math.random() * 3)],
          niche: 'general',
          style: 'Bold Modern',
          tone: 'Funny',
        };
        sourceData = { riskLevel, mock: true };
      } else {
        // Real mode: use multi-agent trend research + insights
        try {
          const autopilotResult = await generateAutopilotConcept(riskLevel!);
          concept = autopilotResult.concept;

          // Phase 6: Capture applied insights for performance tracking
          if (autopilotResult.appliedInsights) {
            appliedInsights = autopilotResult.appliedInsights;
            console.log(`[Merch Generate] Used ${appliedInsights.length} insights`);
          }

          sourceData = {
            riskLevel,
            trend: autopilotResult.trend,
            source: autopilotResult.source,
            generatedAt: new Date().toISOString(),
            // Phase 6: Store insight references for learning system
            appliedInsights: appliedInsights.map(i => ({
              id: i.id,
              type: i.type,
              appliedAs: i.appliedAs,
              confidence: i.confidence,
            })),
            insightCount: appliedInsights.length,
          };
        } catch (error) {
          console.error('[Merch Generate] Autopilot failed, using fallback:', error);
          concept = {
            phrase: 'Living My Best Life',
            niche: 'general',
            style: 'Bold Modern',
            tone: 'Funny',
          };
          sourceData = { riskLevel, fallback: true, error: String(error) };
          isTest = true; // Mark as test since real generation failed
        }
      }
    } else {
      // Manual mode: use user's exact specifications
      concept = {
        phrase: specs!.exactText,
        niche: specs!.niche || 'general',
        style: specs!.style !== 'Let AI decide' ? specs!.style : undefined,
        tone: specs!.tone !== 'Let AI decide' ? specs!.tone : undefined,
        imageFeature: specs!.imageFeature,
      };
      sourceData = { manual: true, userSpecs: specs };
    }

    console.log(`[Merch Generate] Concept: "${concept.phrase}" for ${concept.niche}`);

    // ========================================
    // STEP 2: Generate image prompt
    // ========================================
    const imagePrompt = createImagePrompt(concept, mode, specs);
    console.log(`[Merch Generate] Image prompt created`);

    // ========================================
    // STEP 3: Generate image
    // ========================================
    let imageUrl: string;

    if (USE_MOCK_DATA) {
      imageUrl = generatePlaceholderImage(concept.phrase, concept.style || 'modern');
    } else {
      try {
        const imageResult = await generateMerchImage(
          imagePrompt,
          concept.style || 'Bold Modern',
          concept.phrase,
          'black', // default shirt color
          'simple' // use simple prompts for faster generation
        );
        imageUrl = imageResult.imageUrl;

        // Validate the image
        if (!isValidImageUrl(imageUrl)) {
          console.warn('[Merch Generate] Invalid image URL, using placeholder');
          imageUrl = generatePlaceholderImage(concept.phrase, concept.style || 'modern');
          isTest = true;
        }
      } catch (error) {
        console.error('[Merch Generate] Image generation failed:', error);
        imageUrl = generatePlaceholderImage(concept.phrase, concept.style || 'modern');
        isTest = true;
      }
    }

    console.log(`[Merch Generate] Image generated (isTest: ${isTest})`);

    // ========================================
    // STEP 4: Generate listing
    // ========================================
    let listingTitle: string;
    let listingBrand: string;  // Brand is crucial for Amazon MBA keywords
    let listingBullets: string[];
    let listingDesc: string;

    if (USE_MOCK_DATA) {
      const mockData = generateMockData(
        concept.phrase,
        concept.niche,
        concept.style || 'Bold Modern',
        concept.tone || 'Funny'
      );
      listingTitle = mockData.listing.title;
      listingBrand = `${concept.niche.charAt(0).toUpperCase() + concept.niche.slice(1)} Designs Co`;
      listingBullets = mockData.listing.bullets;
      listingDesc = mockData.listing.description;
    } else {
      try {
        const listing = await generateMerchListing(
          concept.phrase,
          concept.niche,
          concept.tone,
          concept.style
        );
        listingTitle = listing.title;
        listingBrand = listing.brand || `${concept.niche.charAt(0).toUpperCase() + concept.niche.slice(1)} Design Studio`;
        listingBullets = listing.bullets;
        listingDesc = listing.description;
      } catch (error) {
        console.error('[Merch Generate] Listing generation failed:', error);
        const mockData = generateMockData(
          concept.phrase,
          concept.niche,
          concept.style || 'Bold Modern',
          concept.tone || 'Funny'
        );
        listingTitle = mockData.listing.title;
        listingBrand = `${concept.niche.charAt(0).toUpperCase() + concept.niche.slice(1)} Designs Co`;
        listingBullets = mockData.listing.bullets;
        listingDesc = mockData.listing.description;
        isTest = true;
      }
    }

    console.log(`[Merch Generate] Listing generated`);

    // ========================================
    // STEP 5: Save to database
    // ========================================
    const savedDesign = await prisma.merchDesign.create({
      data: {
        userId,
        mode,
        riskLevel: mode === 'autopilot' ? riskLevel : undefined,
        sourceData: sourceData as any,
        userSpecs: mode === 'manual' ? (specs as any) : undefined,
        phrase: concept.phrase,
        niche: concept.niche,
        style: concept.style,
        tone: concept.tone,
        imageUrl,
        imagePrompt,
        listingTitle,
        listingBrand,
        listingBullets,
        listingDesc,
        approved: false,
        views: 0,
        sales: 0,
        isTest,
      },
    });

    console.log(`[Merch Generate] Design saved with ID: ${savedDesign.id}`);

    // Phase 6: Log insight usage for performance tracking (non-blocking)
    if (appliedInsights.length > 0) {
      logInsightUsage(savedDesign.id, appliedInsights).catch(err => {
        console.error('[Merch Generate] Failed to log insight usage:', err);
      });
    }

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
      listingBrand: savedDesign.listingBrand ?? undefined,
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
    const excludeTest = searchParams.get('excludeTest') === 'true';

    const whereClause: any = { userId };
    if (excludeTest) {
      whereClause.isTest = false;
    }

    const designs = await prisma.merchDesign.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.merchDesign.count({
      where: whereClause,
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
        isTest: (d as any).isTest,
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

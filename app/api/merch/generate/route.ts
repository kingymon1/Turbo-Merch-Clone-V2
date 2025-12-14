/**
 * POST /api/merch/generate
 *
 * Server-side endpoint for generating merch designs.
 *
 * ENHANCED VERSION with:
 * - DesignBrief system for style preservation
 * - Niche style discovery integration
 * - Cross-niche opportunity detection
 * - Model selection (Gemini vs DALL-E 3)
 * - Enhanced keyword-intelligent listings
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { GenerationRequest, GenerationResponse, MerchDesign, DesignBrief, DesignForm } from '@/lib/merch/types';
import { createImagePrompt, DesignConcept, buildDesignBriefFromTrend, buildDesignBriefFromManualSpecs } from '@/lib/merch/image-prompter';
import { generateMerchListing, generateEnhancedListing } from '@/lib/merch/listing-generator';
import {
  generateMerchImage,
  generatePlaceholderImage,
  isValidImageUrl,
  generateMerchImageFromBrief,
  generateMerchImageWithModelSelection,
  ImageModel,
  BriefBasedGenerationResult
} from '@/lib/merch/image-generator';
import { generateAutopilotConcept, generateAutopilotConceptWithForm, buildPromptForModel } from '@/lib/merch/autopilot-generator';
import { logInsightUsage } from '@/lib/merch/learning';
import { getSmartStyleProfile } from '@/lib/merch/style-discovery';
import { getCrossNicheOpportunities } from '@/lib/merch/cross-niche-engine';
import { recordGeneration } from '@/lib/merch/diversity-engine';
import { manualSpecsToDesignForm } from '@/lib/merch/form-filler';
import { buildSimplePrompt, buildModelSpecificPrompt } from '@/lib/merch/simple-prompt-builder';

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

    const body: GenerationRequest & { useSimplePrompts?: boolean } = await request.json();
    const {
      mode,
      riskLevel,
      specs,
      // Enhanced options with defaults
      imageModel = 'gemini',
      useEnhancedListing = true,
      useStyleDiscovery = true,
      useCrossNicheBlend = true,
      useBriefSystem = true,
      promptMode = 'advanced',
      // NEW: Form-based simple prompt system (Phase 10)
      useSimplePrompts = false,
    } = body;

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
    console.log(`[Merch Generate] Options: model=${imageModel}, briefSystem=${useBriefSystem}, styleDiscovery=${useStyleDiscovery}, simplePrompts=${useSimplePrompts}`);

    let concept: DesignConcept;
    let sourceData: any = {};
    let isTest = USE_MOCK_DATA;
    let appliedInsights: any[] = [];
    let designBrief: DesignBrief | null = null;
    let nicheStyle: any = null;
    let crossNicheData: any = null;
    let designForm: DesignForm | null = null;
    let simpleImagePrompt: string | null = null;

    // ========================================
    // STEP 1: Generate or extract concept
    // ========================================
    if (mode === 'autopilot') {
      console.log(`[Merch Generate] Autopilot mode at risk level ${riskLevel}`);

      if (USE_MOCK_DATA) {
        concept = {
          phrase: ['Coffee Then Adulting', 'Living My Best Life', 'Chaos Coordinator'][Math.floor(Math.random() * 3)],
          niche: 'general',
          style: 'Bold Modern',
          tone: 'Funny',
        };
        sourceData = { riskLevel, mock: true };
      } else if (useSimplePrompts) {
        // ========================================
        // PHASE 10: Form-Based Simple Prompt System
        // ========================================
        console.log(`[Merch Generate] Using form-based simple prompt system`);

        try {
          const formResult = await generateAutopilotConceptWithForm(riskLevel!, userId);

          concept = formResult.concept;
          designForm = formResult.designForm;
          simpleImagePrompt = buildModelSpecificPrompt(formResult.designForm, imageModel as ImageModel);

          console.log(`[Merch Generate] Simple prompt (${simpleImagePrompt.split(' ').length} words): ${simpleImagePrompt}`);

          sourceData = {
            riskLevel,
            trend: formResult.trend,
            source: formResult.source,
            generatedAt: new Date().toISOString(),
            // Form-based system data
            useSimplePrompts: true,
            designForm: formResult.designForm,
            simplePromptWords: simpleImagePrompt.split(' ').length,
            formFillerTokens: formResult.formFillerResult.tokensUsed,
          };
        } catch (error) {
          console.error('[Merch Generate] Form-based generation failed, falling back to legacy:', error);
          // Fall through to legacy system
          const autopilotResult = await generateAutopilotConcept(riskLevel!, userId);
          concept = autopilotResult.concept;
          sourceData = {
            riskLevel,
            trend: autopilotResult.trend,
            source: autopilotResult.source,
            generatedAt: new Date().toISOString(),
            formBasedFailed: true,
            formBasedError: String(error),
          };
        }
      } else {
        try {
          // PHASE 8: Pass userId to autopilot for per-user diversity tracking (legacy)
          const autopilotResult = await generateAutopilotConcept(riskLevel!, userId);
          concept = autopilotResult.concept;

          if (autopilotResult.appliedInsights) {
            appliedInsights = autopilotResult.appliedInsights;
            console.log(`[Merch Generate] Used ${appliedInsights.length} insights`);
          }

          sourceData = {
            riskLevel,
            trend: autopilotResult.trend,
            source: autopilotResult.source,
            generatedAt: new Date().toISOString(),
            appliedInsights: appliedInsights.map(i => ({
              id: i.id,
              type: i.type,
              appliedAs: i.appliedAs,
              confidence: i.confidence,
            })),
            insightCount: appliedInsights.length,
            // PHASE 8: Track diversity engine results
            diversityInfo: autopilotResult.diversityInfo ? {
              overallScore: autopilotResult.diversityInfo.score.overall,
              nicheNovelty: autopilotResult.diversityInfo.score.nicheNovelty,
              phraseNovelty: autopilotResult.diversityInfo.score.phraseNovelty,
              recommendation: autopilotResult.diversityInfo.score.recommendation,
              source: autopilotResult.diversityInfo.explorationResult?.source,
            } : undefined,
          };

          if (autopilotResult.diversityInfo) {
            console.log(`[Merch Generate] Diversity score: ${(autopilotResult.diversityInfo.score.overall * 100).toFixed(0)}% (${autopilotResult.diversityInfo.score.recommendation})`);
          }
        } catch (error) {
          console.error('[Merch Generate] Autopilot failed, using fallback:', error);
          concept = {
            phrase: 'Living My Best Life',
            niche: 'general',
            style: 'Bold Modern',
            tone: 'Funny',
          };
          sourceData = { riskLevel, fallback: true, error: String(error) };
          isTest = true;
        }
      }
    } else {
      // Manual mode
      concept = {
        phrase: specs!.exactText,
        niche: specs!.niche || 'general',
        style: specs!.style !== 'Let AI decide' ? specs!.style : undefined,
        tone: specs!.tone !== 'Let AI decide' ? specs!.tone : undefined,
        imageFeature: specs!.imageFeature,
      };
      sourceData = { manual: true, userSpecs: specs };

      // PHASE 10: Build simple prompt from manual specs if enabled
      if (useSimplePrompts) {
        designForm = manualSpecsToDesignForm(specs!);
        simpleImagePrompt = buildModelSpecificPrompt(designForm, imageModel as ImageModel);
        console.log(`[Merch Generate] Manual simple prompt (${simpleImagePrompt.split(' ').length} words): ${simpleImagePrompt}`);
        sourceData.useSimplePrompts = true;
        sourceData.designForm = designForm;
        sourceData.simplePromptWords = simpleImagePrompt.split(' ').length;
      }
    }

    console.log(`[Merch Generate] Concept: "${concept.phrase}" for ${concept.niche}`);

    // ========================================
    // STEP 1.5: Enhanced - Fetch niche style profile with ALWAYS-FRESH ANALYSIS
    // ========================================
    // Uses smart style fetcher that:
    // 1. ALWAYS performs real-time Claude Vision analysis (primary source)
    // 2. Uses cached data as CONTEXT for blending (70/30 weight)
    // 3. Falls back to cache only if real-time fails
    // Cache is for LONG-TERM LEARNING, not quick answers
    if (useStyleDiscovery && concept.niche && concept.niche !== 'general') {
      try {
        console.log(`[Merch Generate] Fetching smart style profile for niche: ${concept.niche}, phrase: ${concept.phrase || 'N/A'}`);

        const styleResult = await getSmartStyleProfile(concept.niche, {
          enableRealtime: true,  // Enable real-time Claude Vision analysis
          maxRealtimeImages: 5,  // Analyze up to 5 images for speed
          phrase: concept.phrase // Pass phrase for targeted image search
        });

        if (styleResult.profile) {
          nicheStyle = styleResult.profile;
          console.log(`[Merch Generate] Style profile: source=${styleResult.source}, confidence=${Math.round(styleResult.confidence * 100)}%`);

          sourceData.nicheStyleUsed = true;
          sourceData.nicheStyleSource = styleResult.source;
          sourceData.nicheStyleConfidence = styleResult.confidence;

          // Track if real-time analysis was used (important for debugging)
          if (styleResult.source === 'realtime-blended' || styleResult.source === 'realtime-only') {
            sourceData.realtimeVisionUsed = true;
            console.log(`[Merch Generate] ✓ Real-time Claude Vision analysis applied (${styleResult.source})`);
            if (styleResult.consistency !== undefined) {
              console.log(`[Merch Generate] Cache consistency: ${Math.round(styleResult.consistency * 100)}%`);
            }
          }
        } else {
          console.log(`[Merch Generate] No style profile available for "${concept.niche}"`);
        }
      } catch (error) {
        console.warn('[Merch Generate] Style discovery failed, continuing without:', error);
      }
    }

    // ========================================
    // STEP 1.6: Enhanced - Check cross-niche opportunities
    // ========================================
    if (useCrossNicheBlend && concept.niche && concept.niche !== 'general') {
      try {
        const opportunities = await getCrossNicheOpportunities(concept.niche, {
          minScore: 50,
          recommendations: ['strong_enter', 'enter'],
          limit: 1
        });

        if (opportunities.length > 0) {
          crossNicheData = opportunities[0];
          console.log(`[Merch Generate] Found cross-niche opportunity: ${crossNicheData.primaryNiche} + ${crossNicheData.secondaryNiche}`);
          sourceData.crossNicheUsed = true;
          sourceData.crossNicheCombination = `${crossNicheData.primaryNiche} + ${crossNicheData.secondaryNiche}`;
        }
      } catch (error) {
        console.warn('[Merch Generate] Cross-niche check failed, continuing without:', error);
      }
    }

    // ========================================
    // STEP 2: Build Design Brief OR Use Simple Prompt (Enhanced System)
    // ========================================
    let imagePrompt: string;
    let briefCompliance: any = null;

    // PHASE 10: Prioritize simple prompts if available
    if (simpleImagePrompt) {
      // Use the simple prompt from form-based system
      imagePrompt = simpleImagePrompt;
      console.log(`[Merch Generate] Using simple prompt system (~${imagePrompt.split(' ').length} words)`);
    } else if (useBriefSystem && !USE_MOCK_DATA) {
      // Build DesignBrief from trend data and niche style (legacy complex system)
      if (mode === 'autopilot' && sourceData.trend) {
        designBrief = await buildDesignBriefFromTrend(
          {
            topic: sourceData.trend?.topic,
            designText: concept.phrase,
            phrase: concept.phrase,
            niche: concept.niche,
            audienceProfile: sourceData.trend?.audienceProfile,
            visualStyle: sourceData.trend?.visualStyle || concept.style,
            designStyle: concept.style,
            colorPalette: sourceData.trend?.colorPalette,
            recommendedShirtColor: sourceData.trend?.recommendedShirtColor || 'black',
            sentiment: concept.tone,
            typographyStyle: sourceData.trend?.typographyStyle
          },
          nicheStyle,
          crossNicheData ? { text: undefined, style: crossNicheData.styleBlendRatio } : undefined
        );
      } else if (mode === 'manual' && specs) {
        designBrief = buildDesignBriefFromManualSpecs(specs, nicheStyle);
      }

      if (designBrief) {
        imagePrompt = `Design Brief: ${designBrief.text.exact}`;
        console.log(`[Merch Generate] Design brief created with source: ${designBrief.style.source}`);
        sourceData.briefSystem = true;
        sourceData.briefId = designBrief._meta.briefId;
      } else {
        imagePrompt = createImagePrompt(concept, mode, specs);
      }
    } else {
      imagePrompt = createImagePrompt(concept, mode, specs);
    }

    console.log(`[Merch Generate] Image prompt/brief ready`);

    // ========================================
    // STEP 3: Generate image (with model selection)
    // ========================================
    let imageUrl: string;
    let actualModel: ImageModel = imageModel as ImageModel;

    if (USE_MOCK_DATA) {
      imageUrl = generatePlaceholderImage(concept.phrase, concept.style || 'modern');
    } else {
      try {
        // PHASE 10: Use simple prompt directly when available
        if (simpleImagePrompt) {
          console.log(`[Merch Generate] Using simple prompt generation with ${imageModel}`);

          // Simple prompt goes directly to image model - no brief wrapping
          const imageResult = await generateMerchImage(
            simpleImagePrompt,
            concept.style || 'Bold Modern',
            concept.phrase,
            'black',
            'simple' // Force simple mode since we already have a clean prompt
          );
          imageUrl = imageResult.imageUrl;

        } else if (designBrief) {
          // Legacy brief-based generation
          console.log(`[Merch Generate] Using brief-based generation with ${imageModel}`);

          const briefResult = await generateMerchImageFromBrief(
            designBrief,
            imageModel as ImageModel,
            promptMode
          );

          imageUrl = briefResult.imageUrl;
          actualModel = briefResult.model;
          briefCompliance = briefResult.briefCompliance;

          if (briefCompliance) {
            sourceData.briefCompliance = {
              score: briefCompliance.overallScore,
              textPreserved: briefCompliance.textPreserved,
              typographyFollowed: briefCompliance.typographyFollowed,
              aestheticFollowed: briefCompliance.aestheticFollowed
            };
            console.log(`[Merch Generate] Brief compliance: ${briefCompliance.overallScore * 100}%`);
          }
        } else {
          // Legacy generation without brief
          const imageResult = await generateMerchImage(
            imagePrompt,
            concept.style || 'Bold Modern',
            concept.phrase,
            'black',
            promptMode
          );
          imageUrl = imageResult.imageUrl;
        }

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

    sourceData.imageModel = actualModel;
    console.log(`[Merch Generate] Image generated with ${actualModel} (isTest: ${isTest})`);

    // ========================================
    // STEP 4: Generate listing (Enhanced with keyword intelligence)
    // ========================================
    let listingBrand: string = '';
    let listingTitle: string;
    let listingBullets: string[];
    let listingDesc: string;
    let listingKeywords: string[] = [];

    if (USE_MOCK_DATA) {
      const mockData = generateMockData(
        concept.phrase,
        concept.niche,
        concept.style || 'Bold Modern',
        concept.tone || 'Funny'
      );
      listingBrand = `${concept.niche.charAt(0).toUpperCase() + concept.niche.slice(1)} Design Co`;
      listingTitle = mockData.listing.title;
      listingBullets = mockData.listing.bullets;
      listingDesc = mockData.listing.description;
      listingKeywords = [concept.phrase, concept.niche, 'shirt', 'gift', 'funny'];
    } else {
      try {
        // Use enhanced listing if enabled
        if (useEnhancedListing && concept.niche !== 'general') {
          console.log(`[Merch Generate] Using enhanced listing with keyword intelligence`);

          const enhancedListing = await generateEnhancedListing(
            concept.phrase,
            concept.niche,
            concept.tone,
            concept.style
          );

          listingBrand = enhancedListing.brand || `${concept.niche.charAt(0).toUpperCase() + concept.niche.slice(1)} Merch`;
          listingTitle = enhancedListing.title;
          listingBullets = enhancedListing.bullets;
          listingDesc = enhancedListing.description;
          listingKeywords = enhancedListing.keywords || [];

          // Track enhanced listing data
          sourceData.enhancedListing = {
            used: true,
            autocompleteUsed: enhancedListing.keywordIntelligence?.autocompleteUsed?.length || 0,
            competitorKeywordsUsed: enhancedListing.keywordIntelligence?.competitorKeywordsUsed?.length || 0,
            customerLanguageUsed: enhancedListing.keywordIntelligence?.customerLanguageUsed?.length || 0
          };

          console.log(`[Merch Generate] Enhanced listing created with ${enhancedListing.keywordIntelligence?.autocompleteUsed?.length || 0} autocomplete keywords`);
        } else {
          // Standard listing generation
          const listing = await generateMerchListing(
            concept.phrase,
            concept.niche,
            concept.tone,
            concept.style
          );
          listingBrand = listing.brand || `${concept.niche.charAt(0).toUpperCase() + concept.niche.slice(1)} Merch`;
          listingTitle = listing.title;
          listingBullets = listing.bullets;
          listingDesc = listing.description;
          listingKeywords = listing.keywords || [];
        }
      } catch (error) {
        console.error('[Merch Generate] Listing generation failed:', error);

        // Try standard generation as fallback
        try {
          const listing = await generateMerchListing(
            concept.phrase,
            concept.niche,
            concept.tone,
            concept.style
          );
          listingBrand = listing.brand || `${concept.niche.charAt(0).toUpperCase() + concept.niche.slice(1)} Merch`;
          listingTitle = listing.title;
          listingBullets = listing.bullets;
          listingDesc = listing.description;
          listingKeywords = listing.keywords || [];
        } catch (fallbackError) {
          console.error('[Merch Generate] Fallback listing also failed:', fallbackError);
          const mockData = generateMockData(
            concept.phrase,
            concept.niche,
            concept.style || 'Bold Modern',
            concept.tone || 'Funny'
          );
          listingBrand = `${concept.niche.charAt(0).toUpperCase() + concept.niche.slice(1)} Design Co`;
          listingTitle = mockData.listing.title;
          listingBullets = mockData.listing.bullets;
          listingDesc = mockData.listing.description;
          listingKeywords = [concept.phrase, concept.niche, 'shirt', 'gift', 'funny'];
          isTest = true;
        }
      }
    }

    console.log(`[Merch Generate] Listing generated with brand: ${listingBrand}`);

    // ========================================
    // STEP 5: Save to database (MerchDesign + DesignHistory for Library)
    // ========================================

    // First, get the user's database ID for DesignHistory
    let dbUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!dbUser) {
      dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
      });
    }

    // Calculate retention period based on tier (same as trend scanner)
    const userTier = (dbUser?.subscriptionTier || 'free') as any;
    const retentionDaysMap: Record<string, number> = {
      free: 7,
      starter: 30,
      pro: 90,
      business: 365,
      enterprise: 365,
    };
    const retentionDays = retentionDaysMap[userTier] || 7;
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    // Create the MerchDesign record
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
        listingBrand,
        listingTitle,
        listingBullets,
        listingDesc,
        listingKeywords,
        approved: false,
        views: 0,
        sales: 0,
        isTest,
      },
    });

    console.log(`[Merch Generate] MerchDesign saved with ID: ${savedDesign.id}`);

    // Also save to DesignHistory (Library) for persistence with same benefits as trend scanner
    let libraryDesignId: string | undefined;
    let libraryError: string | undefined;

    if (!dbUser) {
      console.warn(`[Merch Generate] No dbUser found for userId: ${userId} - skipping Library save`);
      libraryError = 'User not found in database';
    } else {
      try {
        console.log(`[Merch Generate] Saving to Library for user: ${dbUser.id}`);
        const designHistoryRecord = await prisma.designHistory.create({
          data: {
            userId: dbUser.id,
            runId: savedDesign.id, // Link to MerchDesign
            runConfig: {
              tierAtCreation: userTier,
              source: 'merch-generator',
              mode,
              savedAt: new Date().toISOString(),
            },
            niche: concept.niche,
            slogan: concept.phrase,
            designCount: 1,
            targetMarket: mode === 'autopilot' ? 'Autopilot Discovery' : 'Manual Design',
            listingData: {
              brand: listingBrand,
              title: listingTitle,
              bullet1: listingBullets[0] || '',
              bullet2: listingBullets[1] || '',
              description: listingDesc,
              keywords: listingKeywords,
              imagePrompt,
              designText: concept.phrase,
            },
            artPrompt: {
              prompt: imagePrompt,
              style: concept.style || '',
            },
            imageUrl,
            imageQuality: 'standard',
            canDownload: true,
            promptMode: promptMode || 'advanced',
            expiresAt,
          },
        });

        libraryDesignId = designHistoryRecord.id;
        console.log(`[Merch Generate] DesignHistory (Library) saved with ID: ${libraryDesignId}`);
      } catch (err: any) {
        console.error('[Merch Generate] Failed to save to Library:', err?.message || err);
        libraryError = err?.message || 'Unknown error saving to library';
        // Continue without failing - MerchDesign is the primary record
      }
    }

    // PHASE 8: Record generation for diversity tracking (non-blocking)
    if (mode === 'autopilot' && !USE_MOCK_DATA) {
      recordGeneration({
        userId,
        phrase: concept.phrase,
        niche: concept.niche,
        topic: sourceData.trend?.topic || concept.phrase,
        riskLevel: riskLevel!,
      }).catch(err => {
        console.warn('[Merch Generate] Failed to record generation for diversity:', err);
      });
    }

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
      listingBrand: savedDesign.listingBrand ?? undefined,
      listingTitle: savedDesign.listingTitle,
      listingBullets: savedDesign.listingBullets,
      listingDesc: savedDesign.listingDesc,
      listingKeywords: savedDesign.listingKeywords ?? [],
      approved: savedDesign.approved,
      approvedAt: savedDesign.approvedAt ?? undefined,
      userRating: savedDesign.userRating ?? undefined,
      views: savedDesign.views,
      sales: savedDesign.sales,
      parentId: savedDesign.parentId ?? undefined,
      libraryDesignId,
    };

    return NextResponse.json({
      success: true,
      design,
      librarySaved: !!libraryDesignId,
      libraryError: libraryError || undefined,
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
        listingBrand: (d as any).listingBrand,
        listingTitle: d.listingTitle,
        listingBullets: d.listingBullets,
        listingDesc: d.listingDesc,
        listingKeywords: (d as any).listingKeywords || [],
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

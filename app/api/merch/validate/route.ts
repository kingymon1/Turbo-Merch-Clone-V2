/**
 * Merch Validation API Endpoint
 *
 * POST /api/merch/validate
 *
 * Test listings against the merch validation system.
 * Returns validation results including errors, warnings, and cleaned listing.
 *
 * Request body:
 * {
 *   title: string,
 *   brand: string,
 *   bullets: string[],
 *   description: string,
 *   keywords?: string[]
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   validation: MerchValidationResult
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateMerchListing,
  getMerchLimits,
  getBannedWordCount,
} from '@/lib/merch/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, brand, bullets, description, keywords } = body;

    // Validate required fields
    if (!title || typeof title !== 'string') {
      return NextResponse.json({
        success: false,
        message: 'Missing or invalid required field: title (string)'
      }, { status: 400 });
    }

    if (!brand || typeof brand !== 'string') {
      return NextResponse.json({
        success: false,
        message: 'Missing or invalid required field: brand (string)'
      }, { status: 400 });
    }

    if (!bullets || !Array.isArray(bullets)) {
      return NextResponse.json({
        success: false,
        message: 'Missing or invalid required field: bullets (array of strings)'
      }, { status: 400 });
    }

    if (!description || typeof description !== 'string') {
      return NextResponse.json({
        success: false,
        message: 'Missing or invalid required field: description (string)'
      }, { status: 400 });
    }

    // Validate bullets are strings
    for (let i = 0; i < bullets.length; i++) {
      if (typeof bullets[i] !== 'string') {
        return NextResponse.json({
          success: false,
          message: `Invalid bullet at index ${i}: must be a string`
        }, { status: 400 });
      }
    }

    // Validate keywords if provided
    if (keywords !== undefined && !Array.isArray(keywords)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid field: keywords must be an array of strings'
      }, { status: 400 });
    }

    // Run validation
    const result = validateMerchListing({
      title,
      brand,
      bullets,
      description,
      keywords
    });

    return NextResponse.json({
      success: true,
      validation: result
    });

  } catch (error) {
    console.error('[MerchValidate] Error:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json({
        success: false,
        message: 'Invalid JSON in request body'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * GET /api/merch/validate
 *
 * Returns validation system info including limits and banned word count.
 */
export async function GET() {
  try {
    const limits = getMerchLimits();
    const bannedWordCount = getBannedWordCount();

    return NextResponse.json({
      success: true,
      info: {
        limits,
        bannedWordCount,
        description: 'Amazon Merch on Demand listing validation system',
        version: '1.0.0'
      }
    });
  } catch (error) {
    console.error('[MerchValidate] Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/proxy-image?url=...
 * Proxies images from R2 to bypass CORS restrictions
 * Used for client-side image processing in ZIP downloads
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Only allow R2 URLs for security
    if (!imageUrl.includes('.r2.') && !imageUrl.includes('r2.dev')) {
      return NextResponse.json({ error: 'Invalid URL - only R2 URLs allowed' }, { status: 403 });
    }

    console.log('[Proxy] Fetching image from R2:', imageUrl);

    // Fetch image from R2 (server-side, no CORS)
    const response = await fetch(imageUrl);

    if (!response.ok) {
      console.error('[Proxy] Failed to fetch image:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch image from R2' },
        { status: response.status }
      );
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';

    console.log('[Proxy] Image fetched successfully, size:', imageBuffer.byteLength, 'bytes');

    // Return image with CORS headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  } catch (error: any) {
    console.error('[Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy image', message: error?.message },
      { status: 500 }
    );
  }
}

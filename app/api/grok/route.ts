import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.NEXT_PUBLIC_GROK_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Grok API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();

    // Log model and search parameters for debugging
    console.log(`[GROK API] Model: ${body.model}, Has search_parameters: ${!!body.search_parameters}`);

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GROK API] Error ${response.status}: ${errorText}`);
      console.error(`[GROK API] Request model: ${body.model}`);
      if (body.search_parameters) {
        console.error(`[GROK API] search_parameters:`, JSON.stringify(body.search_parameters, null, 2));
      }
      return NextResponse.json(
        { error: 'Grok API failed', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Log success with sources used for cost tracking
    const sourcesUsed = data.usage?.num_sources_used || 0;
    if (sourcesUsed > 0) {
      console.log(`[GROK API] Success - Sources used: ${sourcesUsed} (cost: $${(sourcesUsed * 0.025).toFixed(4)})`);
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[GROK API] Exception:', message);
    return NextResponse.json(
      { error: 'Failed to call Grok API', message },
      { status: 500 }
    );
  }
}

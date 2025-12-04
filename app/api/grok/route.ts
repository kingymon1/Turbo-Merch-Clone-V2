import { NextRequest, NextResponse } from 'next/server';

// Increase timeout for Grok Agent Tools API (searches can take time)
// Vercel Pro allows up to 300 seconds
export const maxDuration = 120;

/**
 * Grok API Proxy Route
 *
 * Supports two modes:
 * 1. Agent Tools API (new): Uses /v1/responses with tools array
 * 2. Legacy Chat Completions: Uses /v1/chat/completions with search_parameters
 *
 * The mode is auto-detected based on request body:
 * - If `tools` array present → Agent Tools API
 * - If `search_parameters` present → Legacy (deprecated Dec 15, 2025)
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.NEXT_PUBLIC_GROK_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Grok API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();

    // Determine which API to use based on request body
    const useAgentTools = Array.isArray(body.tools) && body.tools.length > 0;
    const endpoint = useAgentTools
      ? 'https://api.x.ai/v1/responses'
      : 'https://api.x.ai/v1/chat/completions';

    // Log request info
    console.log(`[GROK API] Mode: ${useAgentTools ? 'Agent Tools' : 'Legacy'}`);
    console.log(`[GROK API] Model: ${body.model}`);
    console.log(`[GROK API] Endpoint: ${endpoint}`);
    if (useAgentTools) {
      console.log(`[GROK API] Tools: ${body.tools.map((t: { type: string }) => t.type).join(', ')}`);
    }

    const response = await fetch(endpoint, {
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
      if (body.tools) {
        console.error(`[GROK API] tools:`, JSON.stringify(body.tools, null, 2));
      }
      if (body.search_parameters) {
        console.error(`[GROK API] search_parameters:`, JSON.stringify(body.search_parameters, null, 2));
      }
      return NextResponse.json(
        { error: 'Grok API failed', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Log token usage for cost tracking
    const usage = data.usage || {};
    if (usage.prompt_tokens || usage.completion_tokens) {
      const inputCost = (usage.prompt_tokens || 0) * 0.20 / 1_000_000;
      const outputCost = (usage.completion_tokens || 0) * 0.50 / 1_000_000;
      console.log(`[GROK API] Tokens - Input: ${usage.prompt_tokens || 0}, Output: ${usage.completion_tokens || 0}`);
      console.log(`[GROK API] Cost: $${(inputCost + outputCost).toFixed(6)}`);
    }

    // Legacy: Log sources used (for search_parameters mode)
    const sourcesUsed = data.usage?.num_sources_used || 0;
    if (sourcesUsed > 0) {
      console.log(`[GROK API] Sources used: ${sourcesUsed} (cost: $${(sourcesUsed * 0.025).toFixed(4)})`);
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

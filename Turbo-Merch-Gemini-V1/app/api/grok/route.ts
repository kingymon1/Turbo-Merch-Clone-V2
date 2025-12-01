import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.NEXT_PUBLIC_GROK_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Grok API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();

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
      console.error('Grok API Error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Grok API failed', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Grok API Error:', error);
    return NextResponse.json(
      { error: 'Failed to call Grok API', message: error.message },
      { status: 500 }
    );
  }
}

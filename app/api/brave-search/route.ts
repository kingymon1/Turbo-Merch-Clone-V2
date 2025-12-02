import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.NEXT_PUBLIC_BRAVE_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Brave API key not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const count = searchParams.get('count') || '20';
  const freshness = searchParams.get('freshness') || ''; // pd=past day, pw=past week, pm=past month
  const resultFilter = searchParams.get('result_filter') || ''; // news, discussions, web
  const extraSnippets = searchParams.get('extra_snippets') || 'true';
  const endpoint = searchParams.get('endpoint') || 'web'; // 'web' or 'news'

  if (!query) {
    return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
  }

  // Build base URL based on endpoint type
  const baseUrl = endpoint === 'news'
    ? 'https://api.search.brave.com/res/v1/news/search'
    : 'https://api.search.brave.com/res/v1/web/search';

  // Build URL parameters
  const params = new URLSearchParams({
    q: query,
    country: 'US',
    count: count,
  });

  // Add freshness filter if provided
  if (freshness && ['pd', 'pw', 'pm', 'py'].includes(freshness)) {
    params.append('freshness', freshness);
  }

  // Add result_filter for web endpoint only
  if (resultFilter && endpoint === 'web') {
    params.append('result_filter', resultFilter);
  }

  // Add extra_snippets
  if (extraSnippets === 'true') {
    params.append('extra_snippets', 'true');
  }

  const searchUrl = `${baseUrl}?${params.toString()}`;
  console.log(`[BRAVE] Request: ${searchUrl}`);

  try {
    const response = await fetch(
      searchUrl,
      {
        headers: {
          'X-Subscription-Token': apiKey,
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Brave Search API Error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Brave Search API failed', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Log result counts
    console.log(`[BRAVE] Results: web=${data.web?.results?.length || 0}, news=${data.news?.results?.length || data.results?.length || 0}, discussions=${data.discussions?.results?.length || 0}`);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Brave Search Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Brave Search', message: error.message },
      { status: 500 }
    );
  }
}

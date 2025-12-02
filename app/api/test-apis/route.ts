import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";

export async function GET(request: NextRequest) {
  const results: {
    timestamp: string;
    environment: string;
    tests: {
      gemini: { status: string; configured: boolean; error?: string; response?: any; latency?: number };
      brave: { status: string; configured: boolean; error?: string; response?: any; latency?: number };
      grok: { status: string; configured: boolean; error?: string; response?: any; latency?: number };
    };
    summary: {
      total: number;
      passed: number;
      failed: number;
      notConfigured: number;
    };
  } = {
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development',
    tests: {
      gemini: { status: 'pending', configured: false },
      brave: { status: 'pending', configured: false },
      grok: { status: 'pending', configured: false },
    },
    summary: {
      total: 3,
      passed: 0,
      failed: 0,
      notConfigured: 0,
    },
  };

  // Test 1: Google Gemini AI
  console.log('🧪 Testing Gemini API...');
  const geminiStart = Date.now();
  const geminiApiKey = process.env.NEXT_PUBLIC_API_KEY;

  if (!geminiApiKey) {
    results.tests.gemini.status = 'not_configured';
    results.tests.gemini.error = 'NEXT_PUBLIC_API_KEY not set';
    results.summary.notConfigured++;
    console.log('❌ Gemini: API key not configured');
  } else {
    results.tests.gemini.configured = true;
    try {
      const aiClient = new GoogleGenAI({ apiKey: geminiApiKey });

      // Simple test: Generate a very short response
      const result = await aiClient.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: 'Say "API test successful" in exactly 3 words.',
        config: {
          temperature: 0,
          maxOutputTokens: 10,
        },
      });

      const text = result.text || 'No response';
      results.tests.gemini.latency = Date.now() - geminiStart;
      results.tests.gemini.status = 'success';
      results.tests.gemini.response = {
        model: 'gemini-2.0-flash-exp',
        text: text,
        candidatesCount: result.candidates?.length || 0,
      };
      results.summary.passed++;
      console.log(`✅ Gemini: Success (${results.tests.gemini.latency}ms)`);
    } catch (error: any) {
      results.tests.gemini.status = 'failed';
      results.tests.gemini.error = error.message || String(error);
      results.tests.gemini.latency = Date.now() - geminiStart;
      results.summary.failed++;
      console.error('❌ Gemini: Failed -', error.message);
    }
  }

  // Test 2: Brave Search API
  console.log('🧪 Testing Brave Search API...');
  const braveStart = Date.now();
  const braveApiKey = process.env.NEXT_PUBLIC_BRAVE_API_KEY;

  if (!braveApiKey) {
    results.tests.brave.status = 'not_configured';
    results.tests.brave.error = 'NEXT_PUBLIC_BRAVE_API_KEY not set (optional)';
    results.summary.notConfigured++;
    console.log('⚠️  Brave: API key not configured (optional)');
  } else {
    results.tests.brave.configured = true;
    try {
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent('test')}&count=1`,
        {
          headers: {
            'X-Subscription-Token': braveApiKey,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      results.tests.brave.latency = Date.now() - braveStart;
      results.tests.brave.status = 'success';
      results.tests.brave.response = {
        query: data.query?.original || 'test',
        resultsCount: data.web?.results?.length || 0,
        type: data.type,
      };
      results.summary.passed++;
      console.log(`✅ Brave: Success (${results.tests.brave.latency}ms)`);
    } catch (error: any) {
      results.tests.brave.status = 'failed';
      results.tests.brave.error = error.message || String(error);
      results.tests.brave.latency = Date.now() - braveStart;
      results.summary.failed++;
      console.error('❌ Brave: Failed -', error.message);
    }
  }

  // Test 3: Grok (X.AI) API
  console.log('🧪 Testing Grok API...');
  const grokStart = Date.now();
  const grokApiKey = process.env.NEXT_PUBLIC_GROK_API_KEY;

  if (!grokApiKey) {
    results.tests.grok.status = 'not_configured';
    results.tests.grok.error = 'NEXT_PUBLIC_GROK_API_KEY not set (optional)';
    results.summary.notConfigured++;
    console.log('⚠️  Grok: API key not configured (optional)');
  } else {
    results.tests.grok.configured = true;
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${grokApiKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a test assistant. Respond in exactly 3 words.',
            },
            {
              role: 'user',
              content: 'Say "API test successful"',
            },
          ],
          model: 'grok-3',
          temperature: 0,
          max_tokens: 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      results.tests.grok.latency = Date.now() - grokStart;
      results.tests.grok.status = 'success';
      results.tests.grok.response = {
        model: data.model,
        message: data.choices?.[0]?.message?.content || '',
        finishReason: data.choices?.[0]?.finish_reason,
      };
      results.summary.passed++;
      console.log(`✅ Grok: Success (${results.tests.grok.latency}ms)`);
    } catch (error: any) {
      results.tests.grok.status = 'failed';
      results.tests.grok.error = error.message || String(error);
      results.tests.grok.latency = Date.now() - grokStart;
      results.summary.failed++;
      console.error('❌ Grok: Failed -', error.message);
    }
  }

  // Overall status
  console.log('\n📊 Test Summary:');
  console.log(`   ✅ Passed: ${results.summary.passed}`);
  console.log(`   ❌ Failed: ${results.summary.failed}`);
  console.log(`   ⚠️  Not Configured: ${results.summary.notConfigured}`);

  return NextResponse.json(results, {
    status: results.summary.failed > 0 ? 500 : 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

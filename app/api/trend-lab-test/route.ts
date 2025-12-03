import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ message: 'Trend Lab route is working!' });
}

export async function POST(request: Request) {
    const body = await request.json();
    return NextResponse.json({
        message: 'POST received',
        query: body.query,
        mockTrends: [
            { topic: `[MOCK] ${body.query} Test 1`, platform: 'Test' },
            { topic: `[MOCK] ${body.query} Test 2`, platform: 'Test' },
        ]
    });
}

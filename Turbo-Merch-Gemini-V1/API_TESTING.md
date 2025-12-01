# API Testing Guide

This guide helps you verify that Gemini, Brave Search, and Grok APIs are working correctly in your Vercel deployment.

## Testing Endpoints Created

1. **UI Test Page**: `/test-apis`
   - Beautiful visual interface showing test results
   - Real-time testing with status indicators
   - Detailed error messages and response data

2. **API Endpoint**: `/api/test-apis`
   - Returns JSON with detailed test results
   - Can be called programmatically
   - Includes latency measurements

## How to Test on Vercel

### Step 1: Ensure Environment Variables are Set

Go to your Vercel project dashboard:
1. Navigate to **Settings** → **Environment Variables**
2. Verify these variables are set:

#### Required:
- `NEXT_PUBLIC_API_KEY` - Your Google Gemini API key

#### Optional (but recommended):
- `NEXT_PUBLIC_BRAVE_API_KEY` - Your Brave Search API key
- `NEXT_PUBLIC_GROK_API_KEY` - Your Grok/X.AI API key

#### Important Notes:
- Make sure variables are available in **Production**, **Preview**, and **Development** environments
- After adding/updating variables, you must **redeploy** for changes to take effect

### Step 2: Deploy Your Changes

Push your code to GitHub:
```bash
git add .
git commit -m "Add API testing endpoints"
git push origin claude/identify-live-sources-01SVSCb54WiLqg9rnJy5dLBz
```

Vercel will automatically deploy your changes.

### Step 3: Run the Tests

#### Option A: Visual UI (Recommended)
1. Open your browser and navigate to:
   ```
   https://your-app.vercel.app/test-apis
   ```
2. The page will automatically run tests on load
3. Click "Run Tests Again" to re-test
4. View detailed results for each API

#### Option B: API Endpoint (For Programmatic Access)
1. Make a GET request to:
   ```
   https://your-app.vercel.app/api/test-apis
   ```
2. You'll receive a JSON response with test results

### Step 4: Interpret Results

#### Status Indicators

- ✅ **SUCCESS** - API is configured correctly and responding
- ❌ **FAILED** - API key is set but there's an error (check error message)
- ⚠️ **NOT_CONFIGURED** - API key is not set (optional for Brave/Grok)

#### Common Issues

**Gemini API Fails:**
- Verify `NEXT_PUBLIC_API_KEY` is correct
- Check your Google AI Studio quota at https://ai.google.dev/
- Ensure API key has proper permissions

**Brave Search Fails:**
- Verify `NEXT_PUBLIC_BRAVE_API_KEY` is correct
- Check your Brave Search API quota
- Ensure you have an active subscription

**Grok API Fails:**
- Verify `NEXT_PUBLIC_GROK_API_KEY` is correct
- Check your X.AI API access
- Ensure you have proper permissions

### Step 5: Check Vercel Logs (If Issues Occur)

1. Go to Vercel Dashboard → Your Project
2. Click on the latest deployment
3. Navigate to **Functions** tab
4. Look for `/api/test-apis` function
5. Check the logs for detailed error messages

## Example Response

```json
{
  "timestamp": "2024-01-23T10:30:45.123Z",
  "environment": "production",
  "tests": {
    "gemini": {
      "status": "success",
      "configured": true,
      "latency": 1234,
      "response": {
        "model": "gemini-2.0-flash-exp",
        "text": "API test successful",
        "candidatesCount": 1
      }
    },
    "brave": {
      "status": "success",
      "configured": true,
      "latency": 567,
      "response": {
        "query": "test",
        "resultsCount": 1,
        "type": "search"
      }
    },
    "grok": {
      "status": "success",
      "configured": true,
      "latency": 890,
      "response": {
        "model": "grok-3",
        "message": "API test successful",
        "finishReason": "stop"
      }
    }
  },
  "summary": {
    "total": 3,
    "passed": 3,
    "failed": 0,
    "notConfigured": 0
  }
}
```

## Troubleshooting

### Tests Don't Run
- Clear browser cache and reload
- Check browser console for JavaScript errors
- Verify Vercel deployment succeeded

### All Tests Show "Not Configured"
- Environment variables might not be set
- Redeploy after adding environment variables
- Check variable names match exactly (case-sensitive)

### Tests Run Locally But Fail on Vercel
- Environment variables are environment-specific
- Make sure variables are set for Production/Preview
- Redeploy after setting variables

## Security Note

These test endpoints are public (no authentication required) for easy testing. If you want to restrict access:

1. Edit `middleware.ts`
2. Remove `/test-apis` and `/api/test-apis` from `isPublicRoute`
3. Redeploy

This will require authentication to access the test pages.

## Next Steps

Once all APIs are confirmed working:
1. Remove test endpoints if desired (optional)
2. Monitor API usage and quotas
3. Set up error tracking (Sentry, etc.)
4. Configure rate limiting if needed

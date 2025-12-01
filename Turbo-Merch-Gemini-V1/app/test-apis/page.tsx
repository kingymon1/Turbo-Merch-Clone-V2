'use client';

import { useEffect, useState } from 'react';

interface TestResult {
  status: string;
  configured: boolean;
  error?: string;
  response?: any;
  latency?: number;
}

interface TestResults {
  timestamp: string;
  environment: string;
  tests: {
    gemini: TestResult;
    brave: TestResult;
    grok: TestResult;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    notConfigured: number;
  };
}

export default function TestAPIsPage() {
  const [results, setResults] = useState<TestResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTests = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/test-apis');
      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Failed to run tests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'failed':
        return '❌';
      case 'not_configured':
        return '⚠️';
      default:
        return '⏳';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'not_configured':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">API Connection Tests</h1>
            <button
              onClick={runTests}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Testing...' : 'Run Tests Again'}
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 font-medium">Error: {error}</p>
            </div>
          )}

          {results && (
            <>
              {/* Summary Section */}
              <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Test Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">{results.summary.total}</div>
                    <div className="text-sm text-gray-600">Total Tests</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{results.summary.passed}</div>
                    <div className="text-sm text-gray-600">Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">{results.summary.failed}</div>
                    <div className="text-sm text-gray-600">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">{results.summary.notConfigured}</div>
                    <div className="text-sm text-gray-600">Not Configured</div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  <p>Environment: <span className="font-mono font-semibold">{results.environment}</span></p>
                  <p>Timestamp: <span className="font-mono">{new Date(results.timestamp).toLocaleString()}</span></p>
                </div>
              </div>

              {/* Individual Test Results */}
              <div className="space-y-6">
                {/* Gemini */}
                <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                      {getStatusIcon(results.tests.gemini.status)} Google Gemini AI
                    </h3>
                    <div className="flex items-center gap-4">
                      {results.tests.gemini.latency && (
                        <span className="text-sm text-gray-500">{results.tests.gemini.latency}ms</span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(results.tests.gemini.status)}`}>
                        {results.tests.gemini.status.toUpperCase().replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-600">
                      <span className="font-semibold">Configured:</span> {results.tests.gemini.configured ? '✓ Yes' : '✗ No'}
                    </p>
                    {results.tests.gemini.error && (
                      <p className="text-red-600 bg-red-50 p-3 rounded">
                        <span className="font-semibold">Error:</span> {results.tests.gemini.error}
                      </p>
                    )}
                    {results.tests.gemini.response && (
                      <div className="bg-green-50 p-3 rounded">
                        <p className="text-gray-700"><span className="font-semibold">Model:</span> {results.tests.gemini.response.model}</p>
                        <p className="text-gray-700"><span className="font-semibold">Response:</span> {results.tests.gemini.response.text}</p>
                        <p className="text-gray-700"><span className="font-semibold">Candidates:</span> {results.tests.gemini.response.candidatesCount}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Brave */}
                <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                      {getStatusIcon(results.tests.brave.status)} Brave Search API
                      <span className="text-xs text-gray-500 font-normal">(Optional)</span>
                    </h3>
                    <div className="flex items-center gap-4">
                      {results.tests.brave.latency && (
                        <span className="text-sm text-gray-500">{results.tests.brave.latency}ms</span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(results.tests.brave.status)}`}>
                        {results.tests.brave.status.toUpperCase().replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-600">
                      <span className="font-semibold">Configured:</span> {results.tests.brave.configured ? '✓ Yes' : '✗ No'}
                    </p>
                    {results.tests.brave.error && (
                      <p className="text-yellow-600 bg-yellow-50 p-3 rounded">
                        <span className="font-semibold">Note:</span> {results.tests.brave.error}
                      </p>
                    )}
                    {results.tests.brave.response && (
                      <div className="bg-green-50 p-3 rounded">
                        <p className="text-gray-700"><span className="font-semibold">Query:</span> {results.tests.brave.response.query}</p>
                        <p className="text-gray-700"><span className="font-semibold">Results:</span> {results.tests.brave.response.resultsCount}</p>
                        <p className="text-gray-700"><span className="font-semibold">Type:</span> {results.tests.brave.response.type}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grok */}
                <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                      {getStatusIcon(results.tests.grok.status)} Grok (X.AI) API
                      <span className="text-xs text-gray-500 font-normal">(Optional)</span>
                    </h3>
                    <div className="flex items-center gap-4">
                      {results.tests.grok.latency && (
                        <span className="text-sm text-gray-500">{results.tests.grok.latency}ms</span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(results.tests.grok.status)}`}>
                        {results.tests.grok.status.toUpperCase().replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-600">
                      <span className="font-semibold">Configured:</span> {results.tests.grok.configured ? '✓ Yes' : '✗ No'}
                    </p>
                    {results.tests.grok.error && (
                      <p className="text-yellow-600 bg-yellow-50 p-3 rounded">
                        <span className="font-semibold">Note:</span> {results.tests.grok.error}
                      </p>
                    )}
                    {results.tests.grok.response && (
                      <div className="bg-green-50 p-3 rounded">
                        <p className="text-gray-700"><span className="font-semibold">Model:</span> {results.tests.grok.response.model}</p>
                        <p className="text-gray-700"><span className="font-semibold">Response:</span> {results.tests.grok.response.message}</p>
                        <p className="text-gray-700"><span className="font-semibold">Finish Reason:</span> {results.tests.grok.response.finishReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Help Section */}
              <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Configuration Help</h3>
                <div className="text-sm text-gray-700 space-y-2">
                  <p>🔑 <strong>Required:</strong> Google Gemini API key (NEXT_PUBLIC_API_KEY)</p>
                  <p>🔑 <strong>Optional:</strong> Brave Search API key (NEXT_PUBLIC_BRAVE_API_KEY) - Enhances trend discovery</p>
                  <p>🔑 <strong>Optional:</strong> Grok API key (NEXT_PUBLIC_GROK_API_KEY) - Enables Twitter trend analysis</p>
                  <p className="mt-4 pt-4 border-t border-blue-300">
                    💡 <strong>Tip:</strong> Set these as environment variables in your Vercel project settings under "Environment Variables".
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Database, Play, RefreshCw, AlertCircle, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface StyleMinerStatus {
  recipeCount: number;
  principleCount: number;
  avgConfidence: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
  sourceConfig: { design_guides: number; template_galleries: number; market_examples: number };
  recommendation: string;
}

interface MiningResult {
  success: boolean;
  action: string;
  result: {
    recipesUpserted: number;
    principlesUpserted: number;
    errors: number;
    duration: string;
    dbTotals: {
      recipes: number;
      principles: number;
    };
  };
  duration: string;
  error?: string;
}

export default function AdminToolsPage() {
  const [status, setStatus] = useState<StyleMinerStatus | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [mining, setMining] = useState(false);
  const [miningResult, setMiningResult] = useState<MiningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passes, setPasses] = useState(1);
  const [group, setGroup] = useState('all');

  // Check if user is admin
  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch('/api/user');
      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.user?.isAdmin === true);
        if (data.user?.isAdmin) {
          fetchStatus();
        }
      } else {
        setIsAdmin(false);
      }
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/trigger-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'style-mine-status' }),
      });
      const data = await response.json();
      if (data.success) {
        setStatus(data.result);
      } else {
        setError(data.error || 'Failed to fetch status');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch status';
      setError(errorMessage);
    }
  };

  const runMiner = async () => {
    setMining(true);
    setMiningResult(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/trigger-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'style-mine', passes, group }),
      });
      const data = await response.json();
      setMiningResult(data);
      if (data.success) {
        // Refresh status after mining
        fetchStatus();
      } else {
        setError(data.error || 'Mining failed');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Mining failed';
      setError(errorMessage);
    } finally {
      setMining(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This page is only accessible to administrators.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Tools</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Background job management and system tools</p>
        </div>

        {/* Style Miner Section */}
        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg border border-gray-200 dark:border-white/10 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-500/10 rounded-lg">
                <Database className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Style Miner</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Mine design intelligence from external sources
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Status Section */}
            {status && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-dark-900/50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{status.recipeCount}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Style Recipes</div>
                </div>
                <div className="bg-gray-50 dark:bg-dark-900/50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{status.principleCount}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Principles</div>
                </div>
                <div className="bg-gray-50 dark:bg-dark-900/50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(status.avgConfidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Avg Confidence</div>
                </div>
                <div className="bg-gray-50 dark:bg-dark-900/50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {status.sourceConfig.design_guides + status.sourceConfig.template_galleries + status.sourceConfig.market_examples}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Source URLs</div>
                </div>
              </div>
            )}

            {/* Category Breakdown */}
            {status && status.categoryBreakdown.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Recipes by Category</h3>
                <div className="flex flex-wrap gap-2">
                  {status.categoryBreakdown.slice(0, 8).map((cat) => (
                    <span
                      key={cat.category}
                      className="px-3 py-1 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-full text-sm"
                    >
                      {cat.category} ({cat.count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendation */}
            {status && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <p className="text-blue-800 dark:text-blue-300 text-sm">
                  <strong>Recommendation:</strong> {status.recommendation}
                </p>
              </div>
            )}

            {/* Controls */}
            <div className="border-t border-gray-200 dark:border-white/10 pt-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Run Style Miner</h3>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Passes</label>
                  <select
                    value={passes}
                    onChange={(e) => setPasses(parseInt(e.target.value))}
                    disabled={mining}
                    className="px-4 py-2 bg-white dark:bg-dark-900 border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
                  >
                    <option value={1}>1 pass</option>
                    <option value={2}>2 passes</option>
                    <option value={3}>3 passes (warmup)</option>
                    <option value={5}>5 passes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Source Group</label>
                  <select
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    disabled={mining}
                    className="px-4 py-2 bg-white dark:bg-dark-900 border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
                  >
                    <option value="all">All Sources</option>
                    <option value="design_guides">Design Guides Only</option>
                    <option value="template_galleries">Template Galleries Only</option>
                    <option value="market_examples">Market Examples Only</option>
                  </select>
                </div>
                <button
                  onClick={runMiner}
                  disabled={mining}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {mining ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mining...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Run Miner
                    </>
                  )}
                </button>
                <button
                  onClick={fetchStatus}
                  disabled={mining}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Mining Result */}
            {miningResult && (
              <div
                className={`p-4 rounded-xl border ${
                  miningResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  {miningResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className={`font-medium ${miningResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                      {miningResult.success ? 'Mining Complete' : 'Mining Failed'}
                    </h4>
                    {miningResult.success && miningResult.result && (
                      <div className="mt-2 text-sm text-green-700 dark:text-green-400 space-y-1">
                        <p>Recipes upserted: {miningResult.result.recipesUpserted}</p>
                        <p>Principles upserted: {miningResult.result.principlesUpserted}</p>
                        <p>Errors: {miningResult.result.errors}</p>
                        <p>Duration: {miningResult.result.duration}</p>
                        <p className="pt-2 font-medium">
                          Database Totals: {miningResult.result.dbTotals.recipes} recipes, {miningResult.result.dbTotals.principles} principles
                        </p>
                      </div>
                    )}
                    {miningResult.error && (
                      <p className="mt-1 text-sm text-red-700 dark:text-red-400">{miningResult.error}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && !miningResult && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <p className="text-red-800 dark:text-red-300">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Source Configuration Info */}
        {status && (
          <div className="mt-6 bg-white dark:bg-dark-800 rounded-2xl shadow-lg border border-gray-200 dark:border-white/10 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Source Configuration</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900 dark:text-white">{status.sourceConfig.design_guides}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Design Guides</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900 dark:text-white">{status.sourceConfig.template_galleries}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Template Galleries</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900 dark:text-white">{status.sourceConfig.market_examples}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Market Examples</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Edit <code className="bg-gray-100 dark:bg-dark-700 px-2 py-0.5 rounded">config/style-intel-sources.json</code> to add or remove source URLs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

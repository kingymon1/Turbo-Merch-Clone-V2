'use client';

/**
 * Emerging Trends UI Component
 *
 * Displays emerging trends discovered from social platforms (Reddit, TikTok).
 * Allows users to browse trends by velocity tier and generate designs from them.
 *
 * This is a completely separate UI tab from existing features.
 */

import { useState, useEffect, useCallback } from 'react';
import { EmergingTrendData, VelocityPreset } from '@/lib/emerging-trends/types';

// =============================================================================
// TYPES
// =============================================================================

interface GroupedTrends {
  exploding: EmergingTrendData[];
  rising: EmergingTrendData[];
  steady: EmergingTrendData[];
}

interface TrendsResponse {
  success: boolean;
  data?: {
    trends: EmergingTrendData[];
    grouped: GroupedTrends;
    total: number;
    timestamp: string;
  };
  error?: string;
}

interface DiscoverResponse {
  success: boolean;
  data?: {
    signalsFound: number;
    signalsStored: number;
    trendsEvaluated: number;
    trendsCreated: number;
    duration: number;
  };
  error?: string;
  errors?: string[];
}

interface HealthResponse {
  status: string;
  health: {
    decodoConfigured: boolean;
    claudeConfigured: boolean;
    databaseConnected: boolean;
    errors: string[];
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function EmergingTrends() {
  // State
  const [trends, setTrends] = useState<EmergingTrendData[]>([]);
  const [grouped, setGrouped] = useState<GroupedTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse['health'] | null>(null);
  const [velocityPreset, setVelocityPreset] = useState<VelocityPreset>('moderate');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<EmergingTrendData | null>(null);

  // Fetch trends
  const fetchTrends = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/emerging-trends/signals?limit=100&amazonSafeOnly=true');
      const data: TrendsResponse = await response.json();

      if (data.success && data.data) {
        setTrends(data.data.trends);
        setGrouped(data.data.grouped);
        setLastUpdated(data.data.timestamp);
      } else {
        setError(data.error || 'Failed to fetch trends');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trends');
    } finally {
      setLoading(false);
    }
  }, []);

  // Check health
  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/emerging-trends/discover');
      const data: HealthResponse = await response.json();
      setHealth(data.health);
    } catch {
      // Ignore health check errors
    }
  }, []);

  // Trigger discovery
  const triggerDiscovery = async () => {
    try {
      setDiscovering(true);
      setError(null);

      const response = await fetch('/api/emerging-trends/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: ['reddit'],
          velocityPreset,
          includeEvaluations: true,
        }),
      });

      const data: DiscoverResponse = await response.json();

      if (data.success) {
        // Refresh trends after discovery
        await fetchTrends();
      } else {
        setError(data.error || 'Discovery failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setDiscovering(false);
    }
  };

  // Generate design from trend
  const generateFromTrend = async (trend: EmergingTrendData) => {
    // Mark trend as used
    try {
      await fetch('/api/emerging-trends/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trendId: trend.signalId }),
      });
    } catch {
      // Continue even if marking fails
    }

    // Navigate to autopilot with pre-filled data
    // This would integrate with your existing autopilot component
    const params = new URLSearchParams({
      phrase: trend.phrases[0] || '',
      category: trend.topic,
      mood: trend.moodKeywords[0] || '',
      audience: trend.audience,
    });

    window.location.href = `/dashboard?tab=autopilot&${params.toString()}`;
  };

  // Initial load
  useEffect(() => {
    fetchTrends();
    checkHealth();
  }, [fetchTrends, checkHealth]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Emerging Trends</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Discover trending topics from Reddit before they go mainstream
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Velocity Preset Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Sensitivity:</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/10">
              {(['conservative', 'moderate', 'aggressive'] as VelocityPreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setVelocityPreset(preset)}
                  className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                    velocityPreset === preset
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchTrends}
            disabled={loading}
            className="p-2 rounded-lg bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors disabled:opacity-50 border border-gray-200 dark:border-white/10"
            title="Refresh trends"
          >
            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Discover Button */}
          <button
            onClick={triggerDiscovery}
            disabled={discovering || !health?.decodoConfigured}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-brand-500/20"
          >
            {discovering ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Discovering...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Discover Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Health Warning */}
      {health && !health.decodoConfigured && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">Decodo API not configured</span>
          </div>
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
            Set DECODO_USERNAME and DECODO_PASSWORD environment variables to enable social signal discovery.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Last Updated */}
      {lastUpdated && (
        <p className="text-sm text-gray-500">
          Last updated: {new Date(lastUpdated).toLocaleString()}
        </p>
      )}

      {/* Loading State */}
      {loading && !trends.length && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <svg className="w-8 h-8 animate-spin mx-auto text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="mt-2 text-gray-500 dark:text-gray-400">Loading trends...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && trends.length === 0 && (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-transparent">
          <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">No trends discovered yet</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-500">
            Click &quot;Discover Now&quot; to scan social platforms for emerging trends.
          </p>
        </div>
      )}

      {/* Trends Grid */}
      {grouped && (
        <div className="space-y-8">
          {/* Exploding Trends */}
          {grouped.exploding.length > 0 && (
            <TrendSection
              title="Exploding"
              icon="🔥"
              description="10x+ normal engagement"
              trends={grouped.exploding}
              onSelect={setSelectedTrend}
              onGenerate={generateFromTrend}
              colorClass="border-orange-300 dark:border-orange-500/50 bg-orange-50 dark:bg-orange-900/10"
            />
          )}

          {/* Rising Trends */}
          {grouped.rising.length > 0 && (
            <TrendSection
              title="Rising"
              icon="📈"
              description="5-10x normal engagement"
              trends={grouped.rising}
              onSelect={setSelectedTrend}
              onGenerate={generateFromTrend}
              colorClass="border-green-300 dark:border-green-500/50 bg-green-50 dark:bg-green-900/10"
            />
          )}

          {/* Steady Trends */}
          {grouped.steady.length > 0 && (
            <TrendSection
              title="Steady"
              icon="📊"
              description="2-5x normal engagement"
              trends={grouped.steady}
              onSelect={setSelectedTrend}
              onGenerate={generateFromTrend}
              colorClass="border-brand-300 dark:border-brand-500/50 bg-brand-50 dark:bg-brand-900/10"
            />
          )}
        </div>
      )}

      {/* Trend Detail Modal */}
      {selectedTrend && (
        <TrendDetailModal
          trend={selectedTrend}
          onClose={() => setSelectedTrend(null)}
          onGenerate={generateFromTrend}
        />
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface TrendSectionProps {
  title: string;
  icon: string;
  description: string;
  trends: EmergingTrendData[];
  onSelect: (trend: EmergingTrendData) => void;
  onGenerate: (trend: EmergingTrendData) => void;
  colorClass: string;
}

function TrendSection({ title, icon, description, trends, onSelect, onGenerate, colorClass }: TrendSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{icon}</span>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        <span className="text-sm text-gray-500 dark:text-gray-500">({trends.length})</span>
        <span className="text-sm text-gray-500 dark:text-gray-500 ml-2">- {description}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trends.map((trend) => (
          <TrendCard
            key={trend.signalId}
            trend={trend}
            onSelect={onSelect}
            onGenerate={onGenerate}
            colorClass={colorClass}
          />
        ))}
      </div>
    </div>
  );
}

interface TrendCardProps {
  trend: EmergingTrendData;
  onSelect: (trend: EmergingTrendData) => void;
  onGenerate: (trend: EmergingTrendData) => void;
  colorClass: string;
}

function TrendCard({ trend, onSelect, onGenerate, colorClass }: TrendCardProps) {
  return (
    <div
      className={`p-4 rounded-lg border ${colorClass} hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors cursor-pointer`}
      onClick={() => onSelect(trend)}
    >
      <div className="flex items-start justify-between">
        <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2">{trend.topic}</h3>
        <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 ml-2 whitespace-nowrap">
          {Math.round(trend.merchViability * 100)}% viable
        </span>
      </div>

      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{trend.audience}</p>

      {/* Phrases */}
      <div className="mt-3 flex flex-wrap gap-1">
        {trend.phrases.slice(0, 3).map((phrase, i) => (
          <span key={i} className="text-xs px-2 py-1 rounded bg-gray-200/70 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
            &quot;{phrase}&quot;
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1">
          {trend.suggestedStyles.slice(0, 2).map((style, i) => (
            <span key={i} className="text-xs text-gray-500">{style}</span>
          ))}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onGenerate(trend);
          }}
          className="text-sm px-3 py-1 rounded bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white transition-colors shadow-sm"
        >
          Generate
        </button>
      </div>
    </div>
  );
}

interface TrendDetailModalProps {
  trend: EmergingTrendData;
  onClose: () => void;
  onGenerate: (trend: EmergingTrendData) => void;
}

function TrendDetailModal({ trend, onClose, onGenerate }: TrendDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70">
      <div className="bg-white dark:bg-dark-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/10 shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{trend.topic}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs ${
              trend.velocityTrend === 'exploding' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' :
              trend.velocityTrend === 'rising' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
              'bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300'
            }`}>
              {trend.velocityTrend}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">{Math.round(trend.merchViability * 100)}% merch viability</span>
            {trend.amazonSafe && (
              <span className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">Amazon Safe</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Audience */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Target Audience</h3>
            <p className="text-gray-900 dark:text-white">{trend.audience}</p>
            {trend.audienceProfile && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{trend.audienceProfile}</p>
            )}
          </div>

          {/* Phrases */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">T-Shirt Phrases</h3>
            <div className="flex flex-wrap gap-2">
              {trend.phrases.map((phrase, i) => (
                <span key={i} className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white">
                  &quot;{phrase}&quot;
                </span>
              ))}
            </div>
          </div>

          {/* Design Hints */}
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Suggested Styles</h3>
              <div className="flex flex-wrap gap-1">
                {trend.suggestedStyles.map((style, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{style}</span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Color Hints</h3>
              <div className="flex flex-wrap gap-1">
                {trend.colorHints.map((color, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{color}</span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Mood</h3>
              <div className="flex flex-wrap gap-1">
                {trend.moodKeywords.map((mood, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{mood}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Design Notes */}
          {trend.designNotes && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Design Notes</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">{trend.designNotes}</p>
            </div>
          )}

          {/* Viability Reason */}
          {trend.viabilityReason && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Why This Works</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">{trend.viabilityReason}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 transition-colors border border-gray-200 dark:border-white/10"
          >
            Close
          </button>
          <button
            onClick={() => onGenerate(trend)}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-medium transition-colors shadow-lg shadow-brand-500/20"
          >
            Generate Design
          </button>
        </div>
      </div>
    </div>
  );
}

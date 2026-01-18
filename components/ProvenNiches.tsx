'use client';

/**
 * Proven Niches UI Component
 *
 * Displays tracked niches from Amazon marketplace with competition analysis
 * and opportunity identification. Allows users to scan for opportunities
 * and browse product data.
 *
 * This is a completely separate UI tab from existing features.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Target,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Package,
  DollarSign,
  Star,
  Users,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface TrackedNiche {
  name: string;
  displayName?: string;
  searchKeywords: string[];
  description?: string;
  productCount: number;
  avgBsr?: number;
  avgPrice?: number;
  avgReviews?: number;
  competitionScore?: number;
  competitionLevel?: string;
  opportunityScore?: number;
  isActive: boolean;
  lastScannedAt?: string;
}

interface NicheOpportunity {
  nicheId: string;
  title: string;
  description: string;
  keywords: string[];
  opportunityScore: number;
  demandScore: number;
  competitionScore: number;
  reasoning: string;
  suggestedPhrases: string[];
  status: string;
}

interface AmazonProduct {
  asin: string;
  title: string;
  brand?: string;
  price?: number;
  bsr?: number;
  reviewCount: number;
  rating?: number;
  imageUrl?: string;
  productUrl?: string;
}

interface HealthData {
  configured: boolean;
  working: boolean;
  details: {
    decodoConfigured: boolean;
    decodoWorking: boolean;
    seedNichesCount: number;
    trackedNichesCount: number;
  };
  errors?: string[];
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function CompetitionBadge({ level }: { level?: string }) {
  const colors: Record<string, string> = {
    very_low: 'bg-green-500/20 text-green-400 border-green-500/30',
    low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    saturated: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const labels: Record<string, string> = {
    very_low: 'Very Low',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    saturated: 'Saturated',
  };

  const colorClass = colors[level || 'medium'] || colors.medium;
  const label = labels[level || 'medium'] || 'Unknown';

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${colorClass}`}>
      {label}
    </span>
  );
}

function ScoreBar({ score, label, color = 'brand' }: { score: number; label: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    brand: 'bg-brand-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-400">{Math.round(score * 100)}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClasses[color]}`}
          style={{ width: `${score * 100}%` }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ProvenNiches() {
  // State
  const [niches, setNiches] = useState<TrackedNiche[]>([]);
  const [opportunities, setOpportunities] = useState<NicheOpportunity[]>([]);
  const [products, setProducts] = useState<AmazonProduct[]>([]);
  const [selectedNiche, setSelectedNiche] = useState<TrackedNiche | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [activeTab, setActiveTab] = useState<'niches' | 'opportunities'>('niches');
  const [sortBy, setSortBy] = useState<'opportunityScore' | 'competitionScore' | 'name'>('opportunityScore');
  const [showProducts, setShowProducts] = useState(false);

  // Fetch niches
  const fetchNiches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/proven-niches?active=true&sort=${sortBy}`);
      const data = await response.json();

      if (data.success && data.data) {
        setNiches(data.data.niches);
      } else {
        setError(data.error || 'Failed to fetch niches');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch niches');
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  // Fetch opportunities
  const fetchOpportunities = useCallback(async () => {
    try {
      const response = await fetch('/api/proven-niches/opportunities?active=true&minScore=0.5');
      const data = await response.json();

      if (data.success && data.data) {
        setOpportunities(data.data.opportunities);
      }
    } catch (err) {
      console.error('Failed to fetch opportunities:', err);
    }
  }, []);

  // Fetch products for a niche
  const fetchProducts = async (nicheName: string) => {
    try {
      const response = await fetch(`/api/proven-niches/products?niche=${nicheName}&limit=20&sort=bsr`);
      const data = await response.json();

      if (data.success && data.data) {
        setProducts(data.data.products);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  };

  // Check health
  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/proven-niches/health');
      const data = await response.json();
      setHealth(data);
    } catch {
      // Ignore health check errors
    }
  }, []);

  // Trigger marketplace scan
  const triggerScan = async () => {
    try {
      setScanning(true);
      setError(null);

      const response = await fetch('/api/proven-niches/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initializeSeeds: niches.length === 0,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh data after scan
        await fetchNiches();
        await fetchOpportunities();
      } else {
        setError(data.error || 'Scan failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  // Initial load
  useEffect(() => {
    checkHealth();
    fetchNiches();
    fetchOpportunities();
  }, [checkHealth, fetchNiches, fetchOpportunities]);

  // Select niche handler
  const handleSelectNiche = (niche: TrackedNiche) => {
    setSelectedNiche(niche);
    setShowProducts(true);
    fetchProducts(niche.name);
  };

  // Format BSR
  const formatBsr = (bsr?: number) => {
    if (!bsr) return 'N/A';
    if (bsr >= 1000000) return `${(bsr / 1000000).toFixed(1)}M`;
    if (bsr >= 1000) return `${(bsr / 1000).toFixed(0)}K`;
    return bsr.toString();
  };

  // Format price
  const formatPrice = (price?: number) => {
    if (!price) return 'N/A';
    return `$${price.toFixed(2)}`;
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-dark-900 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="w-6 h-6 text-brand-500" />
              Proven Niches
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Track Amazon marketplace opportunities and competition levels
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Health indicator */}
            {health && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-dark-800 rounded-lg">
                {health.working ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-green-500">Connected</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs text-yellow-500">Not Configured</span>
                  </>
                )}
              </div>
            )}
            {/* Scan button */}
            <button
              onClick={triggerScan}
              disabled={scanning || !health?.configured}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning...' : 'Scan Marketplace'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-4">
          <button
            onClick={() => setActiveTab('niches')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'niches'
                ? 'bg-brand-500/10 text-brand-500 border border-brand-500/20'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Tracked Niches ({niches.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'opportunities'
                ? 'bg-brand-500/10 text-brand-500 border border-brand-500/20'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Opportunities ({opportunities.length})
            </span>
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : activeTab === 'niches' ? (
          /* Niches Tab */
          <div className="space-y-4">
            {/* Sort controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-lg"
              >
                <option value="opportunityScore">Opportunity Score</option>
                <option value="competitionScore">Competition (Low First)</option>
                <option value="name">Name</option>
              </select>
            </div>

            {/* Niches grid */}
            {niches.length === 0 ? (
              <div className="text-center py-12">
                <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No niches tracked</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Click &quot;Scan Marketplace&quot; to initialize seed niches and start tracking
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {niches.map((niche) => (
                  <div
                    key={niche.name}
                    className="p-4 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl hover:border-brand-500/50 transition-colors cursor-pointer"
                    onClick={() => handleSelectNiche(niche)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {niche.displayName || niche.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {niche.productCount} products tracked
                        </p>
                      </div>
                      <CompetitionBadge level={niche.competitionLevel} />
                    </div>

                    <div className="space-y-2">
                      {niche.opportunityScore !== undefined && (
                        <ScoreBar
                          score={niche.opportunityScore}
                          label="Opportunity"
                          color="green"
                        />
                      )}
                      {niche.competitionScore !== undefined && (
                        <ScoreBar
                          score={1 - niche.competitionScore}
                          label="Entry Ease"
                          color="brand"
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-white/5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        BSR: {formatBsr(niche.avgBsr)}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {formatPrice(niche.avgPrice)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {niche.avgReviews?.toFixed(0) || 'N/A'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Opportunities Tab */
          <div className="space-y-4">
            {opportunities.length === 0 ? (
              <div className="text-center py-12">
                <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No opportunities found</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Run a marketplace scan to discover new opportunities
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {opp.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{opp.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-brand-500">
                          {Math.round(opp.opportunityScore * 100)}
                        </div>
                        <div className="text-xs text-gray-500">Score</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <ScoreBar score={opp.demandScore} label="Demand" color="green" />
                      <ScoreBar score={1 - opp.competitionScore} label="Entry Ease" color="brand" />
                    </div>

                    <div className="bg-gray-50 dark:bg-dark-900 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400">
                      {opp.reasoning}
                    </div>

                    {opp.suggestedPhrases.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {opp.suggestedPhrases.slice(0, 5).map((phrase, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 text-xs bg-brand-500/10 text-brand-500 rounded"
                          >
                            {phrase}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Products Slide-out Panel */}
      {showProducts && selectedNiche && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowProducts(false)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-dark-800 border-l border-gray-200 dark:border-white/10 overflow-auto">
            <div className="sticky top-0 p-4 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {selectedNiche.displayName || selectedNiche.name}
                </h2>
                <button
                  onClick={() => setShowProducts(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"
                >
                  <ChevronDown className="w-5 h-5 text-gray-400 rotate-90" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Top products by Best Seller Rank
              </p>
            </div>

            <div className="p-4 space-y-3">
              {products.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No products found</p>
                </div>
              ) : (
                products.map((product) => (
                  <div
                    key={product.asin}
                    className="p-3 bg-gray-50 dark:bg-dark-900 rounded-lg"
                  >
                    <div className="flex gap-3">
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="w-16 h-16 object-cover rounded bg-white"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                          {product.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>BSR: {formatBsr(product.bsr)}</span>
                          <span>{formatPrice(product.price)}</span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {product.rating?.toFixed(1) || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {product.reviewCount}
                          </span>
                        </div>
                        {product.brand && (
                          <p className="text-xs text-gray-400 mt-1">by {product.brand}</p>
                        )}
                      </div>
                      {product.productUrl && (
                        <a
                          href={product.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-white dark:hover:bg-dark-700 rounded"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

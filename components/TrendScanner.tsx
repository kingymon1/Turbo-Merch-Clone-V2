
'use client';

import React, { useState, useEffect } from 'react';
import { TrendData, ProcessingStage, MerchPackage, PromptMode, SavedIdea } from '../types';
import { searchTrends, analyzeNicheDeeply, generateListing, generateDesignImage, generateDesignImageEnhanced } from '../services/geminiService';
import { VIRALITY_LEVELS, TREND_CONFIG } from '../config';
import { Search, TrendingUp, Loader2, ArrowRight, Globe, Zap, Palette, Sparkles, Radar, Terminal, Settings2, ChevronDown, Layers, Wand2, HelpCircle, Users, MessageSquare, Newspaper, Lightbulb, Check } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import BatchGenerationPanel from './BatchGenerationPanel';
import { TierName, PRICING_TIERS } from '../lib/pricing';
import { StorageService } from '../services/storage';

interface TrendScannerProps {
    onTrendSelect: (trend: TrendData, autoRun?: boolean, preGenData?: MerchPackage) => void;
    initialAutoRun?: boolean;
    onNavigateToSubscription?: () => void;
}

// Use global discovery queries from config
const GLOBAL_DISCOVERY_QUERIES = TREND_CONFIG.globalDiscoveryQueries;

// Simplified virality presets (maps to internal 0-100 scale)
type ViralityPreset = 'safe' | 'balanced' | 'aggressive' | 'predictive';
const VIRALITY_PRESETS: Record<ViralityPreset, { value: number; label: string; description: string; hint: string; color: string; icon: 'news' | 'rising' | 'community' | 'live' }> = {
    safe: {
        value: 25,
        label: 'Safe',
        description: 'News & established sources',
        hint: 'Focuses on recent news articles and verified trends with proven demand',
        color: 'text-green-400',
        icon: 'news'
    },
    balanced: {
        value: 50,
        label: 'Balanced',
        description: 'Rising trends with momentum',
        hint: 'Combines news with web discussions to find trends gaining traction',
        color: 'text-yellow-400',
        icon: 'rising'
    },
    aggressive: {
        value: 75,
        label: 'Aggressive',
        description: 'Community discussions & forums',
        hint: 'Prioritizes community chatter and discussions to catch trends early',
        color: 'text-orange-400',
        icon: 'community'
    },
    predictive: {
        value: 90,
        label: 'Predictive',
        description: 'Live social signals',
        hint: 'Uses live X/Twitter data and deep exploration for blue ocean opportunities',
        color: 'text-red-400',
        icon: 'live'
    },
};

// Creation modes
type CreationMode = 'quick' | 'research' | 'batch';

const TrendScanner: React.FC<TrendScannerProps> = ({ onTrendSelect, initialAutoRun, onNavigateToSubscription }) => {
    // Primary mode selection
    const [creationMode, setCreationMode] = useState<CreationMode>('quick');

    const [niche, setNiche] = useState('');
    const [viralityPreset, setViralityPreset] = useState<ViralityPreset>('balanced');
    const [promptMode, setPromptMode] = useState<PromptMode>('advanced');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Compute actual virality level from preset
    const viralityLevel = VIRALITY_PRESETS[viralityPreset].value;
    const [trends, setTrends] = useState<TrendData[]>([]);
    const [status, setStatus] = useState<ProcessingStage>(ProcessingStage.IDLE);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [isAutoPilot, setIsAutoPilot] = useState(false);
    const [autoPilotMessage, setAutoPilotMessage] = useState("Initializing Global Scan...");
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [progressPercent, setProgressPercent] = useState(0);
    const [targetProgress, setTargetProgress] = useState(0);

    // Overage modal state
    const [showOverageModal, setShowOverageModal] = useState(false);
    const [overageData, setOverageData] = useState<{
        used: number;
        allowance: number;
        overage: number;
        overageCharge: number;
        tier: string;
    } | null>(null);
    const [pendingAction, setPendingAction] = useState<'autopilot' | null>(null);

    // User tier and quota for batch generation
    const [userTier, setUserTier] = useState<TierName>('free');
    const [remainingQuota, setRemainingQuota] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);

    // Ideas vault state
    const [savedToVault, setSavedToVault] = useState<Set<string>>(new Set());
    const [vaultFeedback, setVaultFeedback] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
    const [lastSearchQuery, setLastSearchQuery] = useState('');

    // Fetch user info for batch generation
    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const response = await fetch('/api/user');
                if (response.ok) {
                    const data = await response.json();
                    setUserTier((data.user?.subscriptionTier || 'free') as TierName);
                    setRemainingQuota(data.usage?.remaining || 0);
                }
            } catch (err) {
                console.log('Could not fetch user info for batch panel');
            }
        };
        fetchUserInfo();
    }, [refreshKey]);

    // Check for active keys
    const hasBrave = !!process.env.NEXT_PUBLIC_BRAVE_API_KEY;
    const hasGrok = !!process.env.NEXT_PUBLIC_GROK_API_KEY;

    // Get current level info from the virality value
    const currentLevelIndex = Math.min(Math.floor(viralityLevel / 25), 4);
    const currentLevel = VIRALITY_LEVELS[currentLevelIndex];

    // Check if user can use batch mode
    const tierConfig = PRICING_TIERS[userTier];
    const canBatch = tierConfig?.limits?.maxPerRun > 1;

    useEffect(() => {
        if (initialAutoRun) {
            handleAutoPilot();
        }
    }, [initialAutoRun]);

    // Smooth progress animation - animate from current to target
    useEffect(() => {
        if (!isAutoPilot || targetProgress === 0) return;

        const animationInterval = setInterval(() => {
            setProgressPercent(prev => {
                // Calculate how far we are from the target
                const remaining = targetProgress - prev;

                // If we're close enough, snap to target
                if (remaining <= 0.5) {
                    return targetProgress;
                }

                // Smooth easing: larger increments when far from target, smaller when close
                const increment = Math.max(0.3, remaining * 0.08) + Math.random() * 0.5;
                return Math.min(prev + increment, targetProgress);
            });
        }, 100);

        return () => clearInterval(animationInterval);
    }, [isAutoPilot, targetProgress]);

    const executeSearch = async (searchTerm: string) => {
        setStatus(ProcessingStage.SEARCHING);
        setTrends([]);
        setAnalysis(null);
        setIsAutoPilot(false);
        setErrorMessage('');
        setProgressPercent(0);
        setLastSearchQuery(searchTerm);
        setSavedToVault(new Set()); // Reset saved state for new search

        try {
            const [trendResults, analysisResult] = await Promise.all([
                searchTrends(searchTerm, viralityLevel, (msg) => setAutoPilotMessage(msg)), // Use status update callback
                analyzeNicheDeeply(searchTerm)
            ]);

            setTrends(trendResults);
            setAnalysis(analysisResult);
            setStatus(ProcessingStage.COMPLETE);

            // Automatically save all ideas to vault
            if (trendResults.length > 0) {
                const ideas: SavedIdea[] = trendResults.map(trend => ({
                    id: crypto.randomUUID(),
                    trend,
                    savedAt: Date.now(),
                    searchQuery: searchTerm,
                    viralityLevel,
                }));

                const result = StorageService.addMultipleToIdeasVault(ideas);

                // Mark all as saved in UI
                const savedTopics = new Set(trendResults.map(t => t.topic));
                setSavedToVault(savedTopics);

                // Show feedback
                if (result.added > 0) {
                    setVaultFeedback({ message: `${result.added} ideas auto-saved to vault`, type: 'success' });
                    setTimeout(() => setVaultFeedback(null), 3000);
                }
            }
        } catch (error: any) {
            console.error('Search error:', error);
            setErrorMessage(error?.message || 'An unexpected error occurred');
            setStatus(ProcessingStage.ERROR);
        }
    };

    // Handle overage modal confirmation - runs the actual generation
    const handleOverageConfirm = async () => {
        setShowOverageModal(false);

        // Reserve the design slot BEFORE generation
        try {
            const trackResponse = await fetch('/api/designs/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ designCount: 1 }),
            });

            if (!trackResponse.ok) {
                const error = await trackResponse.json();
                setErrorMessage(error.error || 'Failed to reserve design slot');
                setStatus(ProcessingStage.ERROR);
                return;
            }

            // Now run the actual generation
            if (pendingAction === 'autopilot') {
                await runAutoPilotGeneration();
            }
        } catch (error: any) {
            console.error('Track failed:', error);
            setErrorMessage('Failed to track design. Please try again.');
            setStatus(ProcessingStage.ERROR);
        }

        setPendingAction(null);
        setOverageData(null);
    };

    // Handle upgrade from overage modal
    const handleOverageUpgrade = () => {
        setShowOverageModal(false);
        setPendingAction(null);
        setOverageData(null);
        if (onNavigateToSubscription) {
            onNavigateToSubscription();
        }
    };

    // The actual autopilot generation (after quota checks pass)
    const runAutoPilotGeneration = async () => {
        setIsAutoPilot(true);
        setStatus(ProcessingStage.SEARCHING);
        setNiche("");
        setProgressPercent(0);
        setTargetProgress(0);

        const discoveryQuery = GLOBAL_DISCOVERY_QUERIES[Math.floor(Math.random() * GLOBAL_DISCOVERY_QUERIES.length)];

        try {
            // 1. Scan for Trends (0-40%)
            let sources = ["Google"];
            if (hasBrave) sources.push("Brave");
            if (hasGrok) sources.push("Grok");

            setAutoPilotMessage(`Triangulating Signals (${currentLevel.label} Mode): ${sources.join(' + ')}...`);
            setTargetProgress(35); // Smoothly animate toward 35%

            const trendResults = await searchTrends(discoveryQuery, viralityLevel, (msg) => setAutoPilotMessage(msg));
            const bestTrend = trendResults.find(t => t.volume === 'High' || t.volume === 'Breakout') || trendResults[0];
            setTargetProgress(45); // Phase 1 complete

            // 2. Generate Listing Text (45-70%)
            setAutoPilotMessage(`Target Acquired: ${bestTrend.topic}. Synthesizing Listing...`);
            setTargetProgress(55);
            const listing = await generateListing(bestTrend);
            setTargetProgress(72); // Phase 2 complete

            // 3. Generate Design (72-95%)
            const shirtColor = bestTrend.recommendedShirtColor || 'black';
            const modeLabel = promptMode === 'simple' ? 'Simple' : 'Advanced';
            setAutoPilotMessage(`Rendering for ${shirtColor} shirt (${modeLabel} mode)...`);
            setTargetProgress(80);

            // Use Enhanced Pipeline
            const { imageUrl, research } = await generateDesignImageEnhanced(bestTrend, true, promptMode);

            setTargetProgress(95); // Phase 3 complete

            // 4. Complete (100%)
            setAutoPilotMessage("Package Compiled. Launching Studio.");
            setTargetProgress(100);

            setTimeout(() => {
                onTrendSelect(bestTrend, true, {
                    trend: bestTrend,
                    listing: listing,
                    imageUrl: imageUrl,
                    promptMode: promptMode,
                    viralityLevel: viralityLevel,
                    generatedAt: Date.now()
                });
            }, 800);
        } catch (error: any) {
            console.error("Auto Pilot Failed", error);
            setErrorMessage(error?.message || 'Autopilot failed unexpectedly');
            setStatus(ProcessingStage.ERROR);
            setIsAutoPilot(false);
            setProgressPercent(0);
            setTargetProgress(0);
        }
    };

    const handleAutoPilot = async () => {
        // CHECK QUOTA FIRST - Don't start generation if quota exceeded
        try {
            const quotaCheck = await fetch('/api/designs/check-quota', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ designCount: 1 }),
            });

            if (!quotaCheck.ok) {
                const error = await quotaCheck.json();
                setErrorMessage(error.error || 'Design limit reached. Please upgrade your plan or wait for next billing period.');
                setStatus(ProcessingStage.ERROR);
                return; // Stop here - don't start generation
            }

            // Check if overage charges will apply
            const quotaData = await quotaCheck.json();
            if (quotaData.usage.remaining === 0 || quotaData.usage.inOverage) {
                // Show styled modal instead of browser confirm()
                setOverageData({
                    used: quotaData.usage.used,
                    allowance: quotaData.usage.allowance,
                    overage: quotaData.usage.overage + 1, // +1 for this design
                    overageCharge: quotaData.usage.overageCharge,
                    tier: quotaData.usage.tier,
                });
                setPendingAction('autopilot');
                setShowOverageModal(true);
                return; // Wait for modal confirmation
            }

            // No overage - proceed directly
            await runAutoPilotGeneration();

        } catch (error: any) {
            console.error('Quota check failed:', error);
            setErrorMessage('Failed to check quota. Please try again.');
            setStatus(ProcessingStage.ERROR);
            return;
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!niche.trim()) return;

        // Handle standard search but show loading screen if High Virality (Deep Dive)
        if (currentLevelIndex >= 3) {
            setIsAutoPilot(true); // Use the "Global Monitor" UI for deep dives
            setAutoPilotMessage("Initiating Deep Dive...");
            executeSearch(niche).finally(() => {
                // If it wasn't a true auto-pilot run (just a manual search), we need to turn off the full screen loader
                // But executeSearch sets status to COMPLETE, so we need to handle the UI transition
            });
        } else {
            executeSearch(niche);
        }
    };

    // Full Screen "Global Monitor" View for Auto-Pilot OR Deep Dive Search
    if (status === ProcessingStage.SEARCHING && isAutoPilot) {
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-8 animate-fade-in">
                <div className="relative inline-block">
                    <div className={`absolute inset-0 ${currentLevel.color.replace('text', 'bg')}/10 blur-3xl rounded-full animate-pulse`}></div>
                    <Radar className={`w-32 h-32 ${currentLevel.color} animate-spin-slow relative z-10`} />
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-black rounded-full border border-white/10 flex items-center justify-center z-20`}>
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                    </div>
                </div>

                <div className="space-y-4 max-w-xl mx-auto">
                    <h3 className="text-4xl font-bold text-white tracking-tight font-mono uppercase">
                        Multi-Agent Research
                    </h3>

                    {/* Active Agents Display */}
                    <div className="flex items-center justify-center gap-4 text-sm">
                        <div className={`flex items-center gap-1.5 ${progressPercent >= 5 ? 'text-blue-400' : 'text-gray-600'}`}>
                            <Globe className="w-4 h-4" />
                            <span>Google</span>
                        </div>
                        {hasBrave && (
                            <div className={`flex items-center gap-1.5 ${progressPercent >= 5 ? 'text-orange-400' : 'text-gray-600'}`}>
                                <Search className="w-4 h-4" />
                                <span>Brave</span>
                            </div>
                        )}
                        {hasGrok && (
                            <div className={`flex items-center gap-1.5 ${progressPercent >= 5 ? 'text-white' : 'text-gray-600'}`}>
                                <Zap className="w-4 h-4" />
                                <span>Grok</span>
                            </div>
                        )}
                    </div>

                    <div className={`bg-dark-800 border border-white/10 rounded-lg p-4 font-mono text-sm ${currentLevel.color} shadow-lg relative overflow-hidden`}>
                        <div className={`absolute top-0 left-0 w-1 h-full ${currentLevel.bg}`}></div>
                        <div className="flex items-center gap-3">
                            <Terminal className="w-4 h-4" />
                            <span className="animate-pulse">{autoPilotMessage}</span>
                        </div>
                    </div>
                </div>

                <div className="w-64 space-y-2">
                    <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${currentLevel.bg} rounded-full transition-all duration-300 ease-out relative`}
                            style={{ width: `${Math.round(progressPercent)}%` }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                        </div>
                    </div>
                    <div className="text-xs text-gray-500 text-center font-mono">
                        {Math.round(progressPercent)}% complete
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col space-y-2">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white font-mono flex items-center gap-3">
                    Trend Scanner
                </h2>
                <p className="text-gray-500 dark:text-gray-400">Find trends and create ready-to-sell designs.</p>
            </div>

            {/* STEP 1: MODE SELECTOR */}
            <div className="bg-white dark:bg-dark-800/50 border border-gray-200 dark:border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-500 dark:text-brand-400 text-xs font-bold flex items-center justify-center">1</span>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Choose your mode</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Quick Design */}
                    <button
                        onClick={() => setCreationMode('quick')}
                        className={`group relative p-5 rounded-xl border-2 transition-all duration-200 text-left ${creationMode === 'quick'
                            ? 'border-brand-500 bg-brand-500/10'
                            : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-dark-900/30 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-100 dark:hover:bg-dark-900/50'
                            }`}
                    >
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl transition-colors ${creationMode === 'quick'
                                ? 'bg-brand-500/20 text-brand-500 dark:text-brand-400'
                                : 'bg-gray-100 dark:bg-dark-800 text-gray-500 group-hover:text-brand-500 dark:group-hover:text-brand-400'
                                }`}>
                                <Zap className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h4 className={`font-bold mb-1 transition-colors ${creationMode === 'quick' ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                                    }`}>Quick Design</h4>
                                <p className="text-sm text-gray-500">Fully automated trend discovery</p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">AI picks the best trend and creates a design</p>
                            </div>
                        </div>
                        {creationMode === 'quick' && (
                            <div className="absolute top-3 right-3 w-2 h-2 bg-brand-500 rounded-full"></div>
                        )}
                    </button>

                    {/* Research First */}
                    <button
                        onClick={() => setCreationMode('research')}
                        className={`group relative p-5 rounded-xl border-2 transition-all duration-200 text-left ${creationMode === 'research'
                            ? 'border-brand-500 bg-brand-500/10'
                            : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-dark-900/30 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-100 dark:hover:bg-dark-900/50'
                            }`}
                    >
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl transition-colors ${creationMode === 'research'
                                ? 'bg-brand-500/20 text-brand-500 dark:text-brand-400'
                                : 'bg-gray-100 dark:bg-dark-800 text-gray-500 group-hover:text-brand-500 dark:group-hover:text-brand-400'
                                }`}>
                                <Search className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h4 className={`font-bold mb-1 transition-colors ${creationMode === 'research' ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                                    }`}>Research First</h4>
                                <p className="text-sm text-gray-500">Start with a topic or niche</p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">See trend ideas before you choose</p>
                            </div>
                        </div>
                        {creationMode === 'research' && (
                            <div className="absolute top-3 right-3 w-2 h-2 bg-brand-500 rounded-full"></div>
                        )}
                    </button>

                    {/* Batch Mode */}
                    <button
                        onClick={() => setCreationMode('batch')}
                        className={`group relative p-5 rounded-xl border-2 transition-all duration-200 text-left ${creationMode === 'batch'
                            ? 'border-brand-500 bg-brand-500/10'
                            : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-dark-900/30 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-100 dark:hover:bg-dark-900/50'
                            }`}
                    >
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl transition-colors ${creationMode === 'batch'
                                ? 'bg-brand-500/20 text-brand-500 dark:text-brand-400'
                                : 'bg-gray-100 dark:bg-dark-800 text-gray-500 group-hover:text-brand-500 dark:group-hover:text-brand-400'
                                }`}>
                                <Layers className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h4 className={`font-bold mb-1 transition-colors flex items-center gap-2 ${creationMode === 'batch' ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                                    }`}>
                                    Batch Mode
                                    {!canBatch && (
                                        <span className="text-[9px] px-1.5 py-0.5 bg-brand-500/20 text-brand-500 dark:text-brand-400 rounded font-normal">PRO</span>
                                    )}
                                </h4>
                                <p className="text-sm text-gray-500">Create multiple designs at once</p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">Parallel generation for speed</p>
                            </div>
                        </div>
                        {creationMode === 'batch' && (
                            <div className="absolute top-3 right-3 w-2 h-2 bg-brand-500 rounded-full"></div>
                        )}
                    </button>
                </div>
            </div>

            {/* STEP 2: SETTINGS */}
            <div className="bg-gray-50 dark:bg-dark-800/30 border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden">
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 dark:hover:bg-dark-800/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-500/20 text-gray-500 dark:text-gray-400 text-xs font-bold flex items-center justify-center">2</span>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Configure settings</span>
                        <span className="text-xs text-gray-400 dark:text-gray-600">
                            ({VIRALITY_PRESETS[viralityPreset].label} intensity, {promptMode === 'advanced' ? 'Detailed' : 'Simple'} images)
                        </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>

                {showAdvanced && (
                    <div className="px-4 pb-4 space-y-6 border-t border-gray-200 dark:border-white/5 pt-4">
                        {/* Active Research Agents */}
                        <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-100 dark:bg-dark-900/50 border border-gray-200 dark:border-white/5">
                            <span className="text-xs text-gray-500 uppercase tracking-wider">Active Agents:</span>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 text-blue-500 dark:text-blue-400">
                                    <Globe className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium">Google</span>
                                </div>
                                {hasBrave && (
                                    <div className="flex items-center gap-1.5 text-orange-500 dark:text-orange-400">
                                        <Search className="w-3.5 h-3.5" />
                                        <span className="text-xs font-medium">Brave</span>
                                    </div>
                                )}
                                {hasGrok && (
                                    <div className="flex items-center gap-1.5 text-gray-900 dark:text-white">
                                        <Zap className="w-3.5 h-3.5" />
                                        <span className="text-xs font-medium">Grok</span>
                                    </div>
                                )}
                            </div>
                            <span className="text-[10px] text-gray-400 dark:text-gray-600 ml-auto">All agents search in parallel</span>
                        </div>

                        {/* Research Intensity */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <label className="text-sm text-gray-500 dark:text-gray-400">Research Intensity</label>
                                <div className="group relative">
                                    <HelpCircle className="w-3.5 h-3.5 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 cursor-help" />
                                    <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-white dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-xs text-gray-600 dark:text-gray-300">
                                        <p className="font-medium text-gray-900 dark:text-white mb-2">How intensity affects research:</p>
                                        <ul className="space-y-1.5">
                                            <li><span className="text-green-500 dark:text-green-400">Safe:</span> Recent news, proven demand</li>
                                            <li><span className="text-yellow-500 dark:text-yellow-400">Balanced:</span> News + discussions</li>
                                            <li><span className="text-orange-500 dark:text-orange-400">Aggressive:</span> Community focus</li>
                                            <li><span className="text-red-500 dark:text-red-400">Predictive:</span> Live social + deep dive</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {(Object.entries(VIRALITY_PRESETS) as [ViralityPreset, typeof VIRALITY_PRESETS['safe']][]).map(([key, preset]) => (
                                    <button
                                        key={key}
                                        onClick={() => setViralityPreset(key)}
                                        title={preset.hint}
                                        className={`group relative p-3 rounded-lg border text-center transition-all ${viralityPreset === key
                                            ? `${preset.color} bg-white dark:bg-white/5 border-current`
                                            : 'text-gray-500 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center gap-1.5">
                                            {preset.icon === 'news' && <Newspaper className="w-3.5 h-3.5" />}
                                            {preset.icon === 'rising' && <TrendingUp className="w-3.5 h-3.5" />}
                                            {preset.icon === 'community' && <MessageSquare className="w-3.5 h-3.5" />}
                                            {preset.icon === 'live' && <Zap className="w-3.5 h-3.5" />}
                                            <span className="font-bold text-sm">{preset.label}</span>
                                        </div>
                                        <div className="text-[10px] opacity-70 mt-1 leading-tight">{preset.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Image Detail */}
                        <div>
                            <label className="text-sm text-gray-500 dark:text-gray-400 mb-3 block">Image Detail Level</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setPromptMode('simple')}
                                    className={`p-3 rounded-lg border text-center transition-all ${promptMode === 'simple'
                                        ? 'text-green-500 dark:text-green-400 bg-green-500/10 border-green-500/30'
                                        : 'text-gray-500 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex items-center justify-center gap-2 font-bold text-sm">
                                        <Sparkles className="w-4 h-4" />
                                        Simple
                                    </div>
                                    <div className="text-xs opacity-70 mt-1">Clean, natural results</div>
                                </button>
                                <button
                                    onClick={() => setPromptMode('advanced')}
                                    className={`p-3 rounded-lg border text-center transition-all ${promptMode === 'advanced'
                                        ? 'text-blue-500 dark:text-blue-400 bg-blue-500/10 border-blue-500/30'
                                        : 'text-gray-500 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex items-center justify-center gap-2 font-bold text-sm">
                                        <Wand2 className="w-4 h-4" />
                                        Detailed
                                    </div>
                                    <div className="text-xs opacity-70 mt-1">More control, complex prompts</div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* STEP 3: LAUNCH */}
            <div className="bg-white dark:bg-dark-800/50 border border-gray-200 dark:border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-500 dark:text-brand-400 text-xs font-bold flex items-center justify-center">3</span>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Launch</h3>
                </div>

                {/* QUICK DESIGN MODE */}
                {creationMode === 'quick' && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 p-3 bg-brand-500/5 border border-brand-500/10 rounded-lg">
                            <Radar className="w-5 h-5 text-brand-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-gray-400">
                                <span className="text-brand-300 font-medium">How it works:</span> All agents search in parallel, cross-reference findings, and pick the best opportunity. Then a complete listing and design are generated automatically.
                                <span className="text-gray-500 block mt-1">Takes 2-4 minutes • {VIRALITY_PRESETS[viralityPreset].label} intensity</span>
                            </div>
                        </div>
                        <button
                            onClick={handleAutoPilot}
                            disabled={status === ProcessingStage.SEARCHING}
                            className="w-full bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-900/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                        >
                            {status === ProcessingStage.SEARCHING && isAutoPilot ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
                            ) : (
                                <><Zap className="w-5 h-5" /> Launch Quick Design</>
                            )}
                        </button>
                    </div>
                )}

                {/* RESEARCH FIRST MODE */}
                {creationMode === 'research' && (
                    <form onSubmit={handleSearch} className="space-y-4">
                        <div>
                            <label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">Enter a topic, niche, or keyword</label>
                            <input
                                type="text"
                                value={niche}
                                onChange={(e) => setNiche(e.target.value)}
                                placeholder="e.g., 'retro gaming', 'nurse humor', 'cat mom', 'Christmas'..."
                                className="w-full bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl py-4 px-4 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-brand-500/5 border border-brand-500/10 rounded-lg">
                            <Search className="w-5 h-5 text-brand-500 dark:text-brand-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                <span className="text-brand-600 dark:text-brand-300 font-medium">What happens:</span> Agents research your topic and return 3-5 trending angles. You pick one, then we generate the design.
                                <span className="text-gray-400 dark:text-gray-500 block mt-1">{VIRALITY_PRESETS[viralityPreset].label} mode • {VIRALITY_PRESETS[viralityPreset].hint}</span>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={status === ProcessingStage.SEARCHING || !niche.trim()}
                            className="w-full bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-900/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                        >
                            {status === ProcessingStage.SEARCHING && !isAutoPilot ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Researching...</>
                            ) : (
                                <><Search className="w-5 h-5" /> Find Trends</>
                            )}
                        </button>
                    </form>
                )}

                {/* BATCH MODE */}
                {creationMode === 'batch' && (
                    <BatchGenerationPanel
                        userTier={userTier}
                        remainingQuota={remainingQuota}
                        viralityLevel={viralityLevel}
                        promptMode={promptMode}
                        onBatchComplete={(results) => {
                            setRefreshKey(prev => prev + 1);
                            console.log(`Batch generated ${results.length} designs`);
                        }}
                        onNavigateToSubscription={onNavigateToSubscription}
                        embedded={true}
                    />
                )}
            </div>

            {/* Status & Results */}
            {status === ProcessingStage.ERROR && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5" />
                        <span className="font-semibold">Error occurred</span>
                    </div>
                    <p className="text-sm text-red-500 dark:text-red-300">{errorMessage || 'Connection interrupted. Please check your API keys or try again.'}</p>
                </div>
            )}

            {status === ProcessingStage.COMPLETE && !isAutoPilot && (
                <div className="animate-fade-in space-y-6 pt-8 border-t border-gray-200 dark:border-white/10">
                    {/* Vault Feedback Toast */}
                    {vaultFeedback && (
                        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in ${
                            vaultFeedback.type === 'success'
                                ? 'bg-green-500 text-white'
                                : 'bg-blue-500 text-white'
                        }`}>
                            {vaultFeedback.type === 'success' ? (
                                <Check className="w-4 h-4" />
                            ) : (
                                <Lightbulb className="w-4 h-4" />
                            )}
                            {vaultFeedback.message}
                        </div>
                    )}

                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-brand-500 dark:text-brand-400" />
                            Search Results
                            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                                ({trends.length} ideas found)
                            </span>
                        </h3>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 text-sm rounded-lg border border-green-500/20">
                            <Check className="w-4 h-4" />
                            Auto-saved to Ideas Vault
                        </div>
                    </div>

                    {analysis && (
                        <div className="bg-white dark:bg-dark-800/50 border border-gray-200 dark:border-white/10 p-6 rounded-xl border-l-4 border-l-brand-500">
                            <h3 className="text-lg font-semibold text-brand-600 dark:text-brand-300 mb-2 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5" /> Strategic Analysis
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{analysis}</p>
                        </div>
                    )}

                    {/* Trend Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {trends.map((trend, idx) => (
                            <div
                                key={idx}
                                className="group bg-white dark:bg-dark-700/50 border border-gray-200 dark:border-white/5 hover:border-brand-500/50 rounded-xl p-6 transition-all duration-300 hover:bg-gray-50 dark:hover:bg-dark-700 hover:-translate-y-1 cursor-pointer flex flex-col h-full relative overflow-hidden shadow-sm hover:shadow-md dark:shadow-none"
                                onClick={() => onTrendSelect(trend, false)}
                            >
                                {/* Highlight Effect */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-col">
                                        <span className="px-2 py-1 rounded bg-gray-100 dark:bg-white/5 text-xs font-mono text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/5 uppercase tracking-wider mb-1 inline-block w-max">
                                            {trend.platform}
                                        </span>
                                        {/* Source Badges */}
                                        <div className="flex items-center gap-1">
                                            {trend.sources?.map(s => (
                                                <span key={s} className={`text-[9px] px-1 rounded ${s === 'Brave' ? 'bg-orange-500/20 text-orange-500 dark:text-orange-400' : s === 'Grok' ? 'bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-white' : 'bg-blue-500/20 text-blue-500 dark:text-blue-400'}`}>
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={`flex items-center gap-2 px-2 py-1 rounded-full ${trend.volume === 'High' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${trend.volume === 'High' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                                        <span className="text-[10px] font-bold">{trend.volume.toUpperCase()}</span>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors">
                                    {trend.topic}
                                </h3>

                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 flex-grow">
                                    {trend.description}
                                </p>

                                <div className="flex items-center gap-2 mb-4 bg-brand-500/5 p-2 rounded-lg border border-brand-500/10">
                                    <Palette className="w-3 h-3 text-brand-500 dark:text-brand-400" />
                                    <span className="text-xs text-brand-600 dark:text-brand-300 font-mono truncate max-w-[200px]" title={trend.visualStyle}>
                                        Style: {trend.visualStyle}
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-2 mb-6">
                                    {(trend.keywords || []).slice(0, 3).map((kw, k) => (
                                        <span key={k} className="text-xs text-brand-600 dark:text-brand-200 bg-brand-50 dark:bg-brand-900/30 px-2 py-1 rounded-md border border-brand-200 dark:border-brand-500/10">#{kw}</span>
                                    ))}
                                </div>

                                <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-200 dark:border-white/5">
                                    <div className="flex items-center gap-2">
                                        {trend.sourceUrl ? (
                                            <a
                                                href={trend.sourceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
                                            >
                                                <Globe className="w-3 h-3" />
                                                <span className="truncate max-w-[100px]">Source</span>
                                            </a>
                                        ) : (
                                            <span className="text-xs text-gray-400 dark:text-gray-600">Verified Trend</span>
                                        )}
                                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                                            <Check className="w-3 h-3" />
                                            In Vault
                                        </span>
                                    </div>

                                    <button className="text-sm font-bold text-brand-500 dark:text-brand-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                        Build <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Overage Confirmation Modal */}
            <ConfirmationModal
                isOpen={showOverageModal}
                onClose={() => {
                    setShowOverageModal(false);
                    setPendingAction(null);
                    setOverageData(null);
                }}
                onConfirm={handleOverageConfirm}
                onUpgrade={handleOverageUpgrade}
                title="Design Limit Reached"
                message={`You've used all ${overageData?.allowance || 0} designs included in your ${overageData?.tier || ''} plan this month. Creating this design will incur an overage charge.`}
                details={overageData ? {
                    used: overageData.used,
                    allowance: overageData.allowance,
                    overage: overageData.overage,
                    overageCharge: overageData.overageCharge,
                    tier: overageData.tier,
                } : undefined}
                confirmText="Continue with Overage"
                cancelText="Cancel"
                variant="warning"
                showUpgradeOption={!!onNavigateToSubscription}
            />
        </div>
    );
};

export default TrendScanner;

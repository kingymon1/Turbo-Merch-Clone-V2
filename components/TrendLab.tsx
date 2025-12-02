'use client';

import React, { useState } from 'react';
import { TrendData } from '../types';
import { Beaker, Plus, X, Sliders, Lock, Unlock, Sparkles, Search, Loader2, Lightbulb, Palette, Type, Image, Wand2 } from 'lucide-react';

// Non-negotiable constraint types
type ConstraintType = 'phrase' | 'element' | 'style' | 'color' | 'exclude' | 'custom';

interface Constraint {
    id: string;
    type: ConstraintType;
    value: string;
    strictness: number; // 0-100: 0 = suggestion, 100 = absolute requirement
}

const CONSTRAINT_TYPES: Record<ConstraintType, { label: string; icon: React.ReactNode; placeholder: string }> = {
    phrase: { label: 'Phrase on shirt', icon: <Type className="w-4 h-4" />, placeholder: 'e.g., Chillin with my Snowmies' },
    element: { label: 'Must include', icon: <Image className="w-4 h-4" />, placeholder: 'e.g., snowman, Christmas tree' },
    style: { label: 'Design style', icon: <Palette className="w-4 h-4" />, placeholder: 'e.g., vintage, minimalist, retro' },
    color: { label: 'Colors', icon: <Sparkles className="w-4 h-4" />, placeholder: 'e.g., red and green, monochrome' },
    exclude: { label: 'Exclude', icon: <X className="w-4 h-4" />, placeholder: 'e.g., no santa, no religious symbols' },
    custom: { label: 'Custom rule', icon: <Wand2 className="w-4 h-4" />, placeholder: 'Any specific instruction...' },
};

// Interpretation levels
const INTERPRETATION_LEVELS = [
    { value: 0, label: 'Commercial', description: 'Mass appeal, mainstream trends, clear visuals' },
    { value: 25, label: 'Rising', description: 'Emerging phrases, slight creative spin' },
    { value: 50, label: 'Niche', description: 'Community-specific, notable twist' },
    { value: 75, label: 'Underground', description: 'Subculture discoveries, unexpected' },
    { value: 100, label: 'Extreme', description: 'Avant-garde, weird, experimental' },
];

interface TrendLabProps {
    onSelectIdea?: (trend: TrendData) => void;
}

const TrendLab: React.FC<TrendLabProps> = ({ onSelectIdea }) => {
    // Search state
    const [searchTerm, setSearchTerm] = useState('');
    const [interpretation, setInterpretation] = useState(25); // Default to "Rising"
    const [agentFreedom, setAgentFreedom] = useState(50); // How much freedom AI has with constraints

    // Constraints state
    const [constraints, setConstraints] = useState<Constraint[]>([]);
    const [showAddConstraint, setShowAddConstraint] = useState(false);
    const [newConstraintType, setNewConstraintType] = useState<ConstraintType>('phrase');
    const [newConstraintValue, setNewConstraintValue] = useState('');

    // Results state
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<TrendData[]>([]);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState('');

    // Add a new constraint
    const addConstraint = () => {
        if (!newConstraintValue.trim()) return;

        const constraint: Constraint = {
            id: crypto.randomUUID(),
            type: newConstraintType,
            value: newConstraintValue.trim(),
            strictness: 80, // Default to fairly strict
        };

        setConstraints([...constraints, constraint]);
        setNewConstraintValue('');
        setShowAddConstraint(false);
    };

    // Remove a constraint
    const removeConstraint = (id: string) => {
        setConstraints(constraints.filter(c => c.id !== id));
    };

    // Update constraint strictness
    const updateStrictness = (id: string, strictness: number) => {
        setConstraints(constraints.map(c =>
            c.id === id ? { ...c, strictness } : c
        ));
    };

    // Get interpretation label
    const getInterpretationLabel = () => {
        const level = INTERPRETATION_LEVELS.reduce((prev, curr) =>
            Math.abs(curr.value - interpretation) < Math.abs(prev.value - interpretation) ? curr : prev
        );
        return level;
    };

    // Run the search
    const handleSearch = async () => {
        if (!searchTerm.trim()) return;

        setIsSearching(true);
        setError('');
        setResults([]);
        setStatusMessage('Initializing Trend Lab...');

        try {
            // Build the search payload
            const payload = {
                query: searchTerm.trim(),
                interpretation, // 0-100 scale
                agentFreedom, // 0-100 scale
                constraints: constraints.map(c => ({
                    type: c.type,
                    value: c.value,
                    strictness: c.strictness,
                })),
            };

            setStatusMessage(`Searching with ${getInterpretationLabel().label} interpretation...`);

            // Call the API
            const response = await fetch('/api/trend-lab', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }

            const data = await response.json();
            setResults(data.trends || []);
            setStatusMessage(`Found ${data.trends?.length || 0} opportunities`);
        } catch (err) {
            console.error('Trend Lab search failed:', err);
            setError(err instanceof Error ? err.message : 'Search failed');
            setStatusMessage('');
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-900 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                        <Beaker className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trend Lab</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Experimental trend discovery with full control</p>
                    </div>
                    <span className="ml-auto px-3 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full">
                        EXPERIMENTAL
                    </span>
                </div>

                {/* Main Search Input */}
                <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-white/10 p-6 mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        What are you looking for?
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="e.g., Christmas, Summer vibes, Cat lover, Gym motivation..."
                            className="w-full px-4 py-3 pr-12 text-lg bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400"
                        />
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    </div>
                </div>

                {/* Interpretation Slider */}
                <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-white/10 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Interpretation
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {getInterpretationLabel().description}
                            </p>
                        </div>
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                            interpretation <= 25 ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400' :
                            interpretation <= 50 ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                            interpretation <= 75 ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' :
                            'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                        }`}>
                            {getInterpretationLabel().label}
                        </span>
                    </div>

                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={interpretation}
                        onChange={(e) => setInterpretation(Number(e.target.value))}
                        className="w-full h-2 bg-gradient-to-r from-green-400 via-yellow-400 via-orange-400 to-red-500 rounded-lg appearance-none cursor-pointer"
                    />

                    <div className="flex justify-between mt-2 text-xs text-gray-400">
                        <span>Commercial</span>
                        <span>Rising</span>
                        <span>Niche</span>
                        <span>Underground</span>
                        <span>Extreme</span>
                    </div>
                </div>

                {/* Non-Negotiables Section */}
                <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-white/10 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Non-Negotiables
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Define what MUST or MUST NOT appear in results
                            </p>
                        </div>
                        <button
                            onClick={() => setShowAddConstraint(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add
                        </button>
                    </div>

                    {/* Existing Constraints */}
                    {constraints.length > 0 ? (
                        <div className="space-y-3 mb-4">
                            {constraints.map((constraint) => (
                                <div
                                    key={constraint.id}
                                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-900 rounded-xl"
                                >
                                    <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg text-purple-600 dark:text-purple-400">
                                        {CONSTRAINT_TYPES[constraint.type].icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {CONSTRAINT_TYPES[constraint.type].label}:
                                            </span>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                {constraint.value}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={constraint.strictness}
                                                onChange={(e) => updateStrictness(constraint.id, Number(e.target.value))}
                                                className="flex-1 h-1 bg-gray-200 dark:bg-dark-700 rounded-lg appearance-none cursor-pointer"
                                            />
                                            <span className="text-xs text-gray-400 w-20 text-right">
                                                {constraint.strictness < 30 ? 'Suggestion' :
                                                 constraint.strictness < 70 ? 'Important' : 'Required'}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeConstraint(constraint.id)}
                                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                            <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No constraints added</p>
                            <p className="text-xs">AI has full creative freedom</p>
                        </div>
                    )}

                    {/* Add Constraint Form */}
                    {showAddConstraint && (
                        <div className="border-t border-gray-200 dark:border-white/10 pt-4 mt-4">
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                {(Object.entries(CONSTRAINT_TYPES) as [ConstraintType, typeof CONSTRAINT_TYPES['phrase']][]).map(([key, config]) => (
                                    <button
                                        key={key}
                                        onClick={() => setNewConstraintType(key)}
                                        className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${
                                            newConstraintType === key
                                                ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-2 border-purple-500'
                                                : 'bg-gray-50 dark:bg-dark-900 text-gray-600 dark:text-gray-400 border-2 border-transparent hover:border-gray-300 dark:hover:border-white/10'
                                        }`}
                                    >
                                        {config.icon}
                                        {config.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newConstraintValue}
                                    onChange={(e) => setNewConstraintValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addConstraint()}
                                    placeholder={CONSTRAINT_TYPES[newConstraintType].placeholder}
                                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400"
                                    autoFocus
                                />
                                <button
                                    onClick={addConstraint}
                                    disabled={!newConstraintValue.trim()}
                                    className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Add
                                </button>
                                <button
                                    onClick={() => setShowAddConstraint(false)}
                                    className="px-4 py-2 bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Agent Freedom Slider */}
                <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-white/10 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Agent Freedom
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                How strictly should AI follow your constraints?
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {agentFreedom < 30 ? (
                                <Lock className="w-4 h-4 text-red-500" />
                            ) : agentFreedom < 70 ? (
                                <Sliders className="w-4 h-4 text-yellow-500" />
                            ) : (
                                <Unlock className="w-4 h-4 text-green-500" />
                            )}
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                {agentFreedom < 30 ? 'Strict' : agentFreedom < 70 ? 'Balanced' : 'Creative'}
                            </span>
                        </div>
                    </div>

                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={agentFreedom}
                        onChange={(e) => setAgentFreedom(Number(e.target.value))}
                        className="w-full h-2 bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 rounded-lg appearance-none cursor-pointer"
                    />

                    <div className="flex justify-between mt-2 text-xs text-gray-400">
                        <span>Follow exactly</span>
                        <span>Balanced</span>
                        <span>Creative freedom</span>
                    </div>
                </div>

                {/* Search Button */}
                <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchTerm.trim()}
                    className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    {isSearching ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {statusMessage || 'Searching...'}
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            Discover Trends
                        </>
                    )}
                </button>

                {/* Error Display */}
                {error && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Results */}
                {results.length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Discoveries ({results.length})
                        </h2>
                        <div className="grid gap-4">
                            {results.map((trend, index) => (
                                <div
                                    key={index}
                                    className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-white/10 p-5 hover:border-purple-300 dark:hover:border-purple-500/30 transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                                {trend.topic}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                {trend.platform} • {trend.volume}
                                            </p>
                                        </div>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                            trend.volume === 'High' ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400' :
                                            trend.volume === 'Breakout' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                                            trend.volume === 'Rising' ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                                            'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                                        }`}>
                                            {trend.volume}
                                        </span>
                                    </div>

                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                                        {trend.description}
                                    </p>

                                    {trend.designText && (
                                        <div className="mb-3 p-3 bg-gray-50 dark:bg-dark-900 rounded-lg">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">Design Text:</span>
                                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                                                "{trend.designText}"
                                            </p>
                                        </div>
                                    )}

                                    {trend.visualStyle && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                            <span className="font-medium">Visual:</span> {trend.visualStyle}
                                        </p>
                                    )}

                                    {trend.customerPhrases && trend.customerPhrases.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            {trend.customerPhrases.slice(0, 5).map((phrase, i) => (
                                                <span key={i} className="px-2 py-0.5 text-xs bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded">
                                                    "{phrase}"
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        onClick={() => onSelectIdea?.(trend)}
                                        className="w-full mt-2 py-2 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors text-sm"
                                    >
                                        Build Design
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!isSearching && results.length === 0 && !error && (
                    <div className="mt-12 text-center text-gray-400 dark:text-gray-500">
                        <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg">Enter a topic to discover trends</p>
                        <p className="text-sm mt-1">Add constraints to control what you get</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrendLab;

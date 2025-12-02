'use client';

import React, { useState, useEffect } from 'react';
import { SavedIdea, TrendData } from '../types';
import { StorageService } from '../services/storage';
import {
  Lightbulb,
  Trash2,
  ArrowRight,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  Palette,
  Globe,
  TrendingUp,
  Sparkles,
  StickyNote,
  X,
  ChevronDown
} from 'lucide-react';

interface IdeasVaultProps {
  onSelectIdea: (trend: TrendData, ideaId: string) => void;
}

type FilterType = 'all' | 'unused' | 'used';
type SortType = 'newest' | 'oldest' | 'topic';

const IdeasVault: React.FC<IdeasVaultProps> = ({ onSelectIdea }) => {
  const [ideas, setIdeas] = useState<SavedIdea[]>([]);
  const [filteredIdeas, setFilteredIdeas] = useState<SavedIdea[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('newest');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Load ideas from storage
  useEffect(() => {
    const loadedIdeas = StorageService.loadIdeasVault();
    setIdeas(loadedIdeas);
  }, []);

  // Filter and sort ideas
  useEffect(() => {
    let result = [...ideas];

    // Apply filter
    if (filter === 'unused') {
      result = result.filter(idea => !idea.isUsed);
    } else if (filter === 'used') {
      result = result.filter(idea => idea.isUsed);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(idea =>
        idea.trend.topic.toLowerCase().includes(query) ||
        idea.trend.description.toLowerCase().includes(query) ||
        idea.searchQuery.toLowerCase().includes(query) ||
        (idea.trend.keywords || []).some(k => k.toLowerCase().includes(query))
      );
    }

    // Apply sort
    if (sort === 'newest') {
      result.sort((a, b) => b.savedAt - a.savedAt);
    } else if (sort === 'oldest') {
      result.sort((a, b) => a.savedAt - b.savedAt);
    } else if (sort === 'topic') {
      result.sort((a, b) => a.trend.topic.localeCompare(b.trend.topic));
    }

    setFilteredIdeas(result);
  }, [ideas, filter, sort, searchQuery]);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this idea?')) {
      StorageService.removeFromIdeasVault(id);
      setIdeas(ideas.filter(idea => idea.id !== id));
    }
  };

  const handleSelectIdea = (idea: SavedIdea) => {
    // Mark as used
    StorageService.markIdeaAsUsed(idea.id);
    setIdeas(ideas.map(i =>
      i.id === idea.id ? { ...i, isUsed: true, usedAt: Date.now() } : i
    ));
    // Navigate to create listing
    onSelectIdea(idea.trend, idea.id);
  };

  const handleSaveNote = (id: string) => {
    StorageService.updateIdeaNotes(id, noteText);
    setIdeas(ideas.map(idea =>
      idea.id === id ? { ...idea, notes: noteText } : idea
    ));
    setEditingNoteId(null);
    setNoteText('');
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all ideas from the vault? This cannot be undone.')) {
      StorageService.clearIdeasVault();
      setIdeas([]);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getRemainingTime = (expiresAt: number | undefined) => {
    if (!expiresAt) return null; // No expiration (legacy ideas)
    const now = Date.now();
    const diff = expiresAt - now;
    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 30) return `${Math.floor(days / 30)}mo left`;
    if (days > 1) return `${days}d left`;
    if (days === 1) return `1d left`;
    if (hours > 0) return `${hours}h left`;
    return "< 1h left";
  };

  const getExpiryUrgency = (expiresAt: number | undefined) => {
    if (!expiresAt) return "text-gray-400 dark:text-gray-500"; // No expiration
    const now = Date.now();
    const diff = expiresAt - now;
    const days = diff / (1000 * 60 * 60 * 24);

    if (diff <= 0) return "text-gray-500 dark:text-gray-600";
    if (days < 1) return "text-red-500 dark:text-red-400";
    if (days < 7) return "text-orange-500 dark:text-orange-400";
    return "text-gray-400 dark:text-gray-500";
  };

  const getViralityLabel = (level: number) => {
    if (level <= 25) return { label: 'Safe', color: 'text-green-500 bg-green-500/10 border-green-500/20' };
    if (level <= 50) return { label: 'Balanced', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' };
    if (level <= 75) return { label: 'Aggressive', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' };
    return { label: 'Predictive', color: 'text-red-500 bg-red-500/10 border-red-500/20' };
  };

  const unusedCount = ideas.filter(i => !i.isUsed).length;
  const usedCount = ideas.filter(i => i.isUsed).length;

  if (ideas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4 animate-fade-in">
        <div className="p-6 bg-gray-100 dark:bg-dark-800 rounded-full border border-gray-200 dark:border-white/5 shadow-xl shadow-black/20 dark:shadow-black/50">
          <Lightbulb className="w-16 h-16 text-gray-400 dark:text-gray-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Your Ideas Vault is Empty</h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          When you research trends, all discovered ideas will be saved here automatically.
          Come back anytime to create listings from your saved ideas.
        </p>
        <div className="flex items-center gap-2 text-sm text-brand-500 dark:text-brand-400 bg-brand-500/10 px-4 py-2 rounded-lg border border-brand-500/20">
          <Sparkles className="w-4 h-4" />
          <span>Go to Trend Scanner to discover ideas</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white font-mono flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-yellow-500" />
            Ideas Vault
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Your saved trend ideas from research sessions. Select any to create a listing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500 font-mono bg-gray-100 dark:bg-dark-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-white/5">
            {ideas.length} Idea{ideas.length !== 1 ? 's' : ''} •
            <span className="text-green-500 ml-1">{unusedCount} unused</span>
          </div>
          {ideas.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-2 text-red-500 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-dark-800/50 border border-gray-200 dark:border-white/10 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ideas by topic, keyword, or query..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
            />
          </div>

          {/* Filter Toggle (Mobile) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-lg text-gray-700 dark:text-gray-300"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Filters (Desktop always visible, Mobile toggle) */}
          <div className={`flex flex-col md:flex-row gap-2 ${showFilters ? 'block' : 'hidden md:flex'}`}>
            {/* Status Filter */}
            <div className="flex gap-1 bg-gray-50 dark:bg-dark-900 rounded-lg p-1 border border-gray-200 dark:border-white/10">
              {(['all', 'unused', 'used'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                    filter === f
                      ? 'bg-brand-500 text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {f}
                  {f === 'unused' && unusedCount > 0 && (
                    <span className="ml-1 text-xs">({unusedCount})</span>
                  )}
                  {f === 'used' && usedCount > 0 && (
                    <span className="ml-1 text-xs">({usedCount})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortType)}
              className="px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-lg text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="topic">By Topic</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ideas Grid */}
      {filteredIdeas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No ideas match your search or filter criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIdeas.map((idea) => {
            const viralityInfo = getViralityLabel(idea.viralityLevel);

            return (
              <div
                key={idea.id}
                className={`bg-white dark:bg-dark-800 border rounded-xl overflow-hidden group hover:border-brand-500/30 transition-all duration-300 shadow-sm hover:shadow-lg ${
                  idea.isUsed
                    ? 'border-gray-200 dark:border-white/5 opacity-75'
                    : 'border-gray-200 dark:border-white/10'
                }`}
              >
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-dark-900/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/5">
                          {idea.trend.platform}
                        </span>
                        {idea.isUsed && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Used
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white truncate group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors">
                        {idea.trend.topic}
                      </h3>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${
                      idea.trend.volume === 'High' || idea.trend.volume === 'Breakout'
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                        : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        idea.trend.volume === 'High' || idea.trend.volume === 'Breakout' ? 'bg-green-500' : 'bg-yellow-500'
                      }`}></div>
                      {idea.trend.volume.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {idea.trend.description}
                  </p>

                  {/* Visual Style */}
                  <div className="flex items-center gap-2 p-2 bg-brand-500/5 rounded-lg border border-brand-500/10">
                    <Palette className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400 flex-shrink-0" />
                    <span className="text-xs text-brand-600 dark:text-brand-300 font-mono truncate">
                      {idea.trend.visualStyle}
                    </span>
                  </div>

                  {/* Keywords */}
                  <div className="flex flex-wrap gap-1">
                    {(idea.trend.keywords || []).slice(0, 3).map((kw, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded border border-gray-200 dark:border-white/5"
                      >
                        #{kw}
                      </span>
                    ))}
                  </div>

                  {/* Notes */}
                  {editingNoteId === idea.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add a note..."
                        className="w-full p-2 text-sm bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:outline-none focus:border-brand-500"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveNote(idea.id)}
                          className="px-3 py-1 text-xs font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-400 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingNoteId(null);
                            setNoteText('');
                          }}
                          className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : idea.notes ? (
                    <div
                      className="flex items-start gap-2 p-2 bg-yellow-500/5 rounded-lg border border-yellow-500/10 cursor-pointer hover:bg-yellow-500/10 transition-colors"
                      onClick={() => {
                        setEditingNoteId(idea.id);
                        setNoteText(idea.notes || '');
                      }}
                    >
                      <StickyNote className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-yellow-700 dark:text-yellow-300 line-clamp-2">{idea.notes}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingNoteId(idea.id);
                        setNoteText('');
                      }}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <StickyNote className="w-3 h-3" />
                      Add note
                    </button>
                  )}

                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(idea.savedAt)}
                      </div>
                      {idea.expiresAt && (
                        <div className={`flex items-center gap-1 ${getExpiryUrgency(idea.expiresAt)}`}>
                          <span>•</span>
                          {getRemainingTime(idea.expiresAt)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded border ${viralityInfo.color}`}>
                        {viralityInfo.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-3 bg-gray-50 dark:bg-dark-900/30 border-t border-gray-200 dark:border-white/5 flex justify-between items-center">
                  <button
                    onClick={() => handleDelete(idea.id)}
                    className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete Idea"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleSelectIdea(idea)}
                    className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-brand-500/20"
                  >
                    Create Listing
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IdeasVault;

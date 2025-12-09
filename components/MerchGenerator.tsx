'use client';

import React, { useState, useEffect } from 'react';
import { Rocket, Target, Copy, Download, Check, Loader2, RefreshCw, ChevronDown } from 'lucide-react';
import { MerchDesign, ManualSpecs, GenerationResponse } from '../lib/merch/types';

type Mode = 'autopilot' | 'manual';

const STYLE_OPTIONS = [
  'Let AI decide',
  'Bold Modern',
  'Vintage Retro',
  'Elegant Script',
  'Minimalist',
  'Distressed',
  'Playful',
  'Professional',
];

const TONE_OPTIONS = [
  'Let AI decide',
  'Funny',
  'Inspirational',
  'Sarcastic',
  'Heartfelt',
  'Proud',
  'Edgy',
];

function getRiskHelperText(riskLevel: number): string {
  if (riskLevel < 30) {
    return 'Focus on proven, evergreen niches with consistent demand';
  } else if (riskLevel < 70) {
    return 'Balance between proven niches and emerging trends';
  } else {
    return 'Chase early trends and viral potential';
  }
}

const MerchGenerator: React.FC = () => {
  const [mode, setMode] = useState<Mode>('autopilot');
  const [riskLevel, setRiskLevel] = useState(50);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDesign, setGeneratedDesign] = useState<MerchDesign | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [recentDesigns, setRecentDesigns] = useState<MerchDesign[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Manual mode form state
  const [exactText, setExactText] = useState('');
  const [visualStyle, setVisualStyle] = useState('Let AI decide');
  const [imageFeature, setImageFeature] = useState('');
  const [targetNiche, setTargetNiche] = useState('');
  const [tone, setTone] = useState('Let AI decide');
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  // Editable result fields
  const [editableTitle, setEditableTitle] = useState('');
  const [editableBullets, setEditableBullets] = useState<string[]>([]);
  const [editableDesc, setEditableDesc] = useState('');

  // Fetch recent designs on mount
  useEffect(() => {
    fetchRecentDesigns();
  }, []);

  // Update editable fields when design changes
  useEffect(() => {
    if (generatedDesign) {
      setEditableTitle(generatedDesign.listingTitle);
      setEditableBullets([...generatedDesign.listingBullets]);
      setEditableDesc(generatedDesign.listingDesc);
    }
  }, [generatedDesign]);

  const fetchRecentDesigns = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch('/api/merch/generate?limit=10');
      if (response.ok) {
        const data = await response.json();
        setRecentDesigns(data.designs || []);
      }
    } catch (error) {
      console.error('Error fetching recent designs:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedDesign(null);

    try {
      const requestBody: any = { mode };

      if (mode === 'autopilot') {
        requestBody.riskLevel = riskLevel;
      } else {
        const specs: ManualSpecs = {
          exactText,
          style: visualStyle !== 'Let AI decide' ? visualStyle : undefined,
          imageFeature: imageFeature || undefined,
          niche: targetNiche || undefined,
          tone: tone !== 'Let AI decide' ? tone : undefined,
          additionalInstructions: additionalInstructions || undefined,
        };
        requestBody.specs = specs;
      }

      const response = await fetch('/api/merch/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data: GenerationResponse = await response.json();

      if (data.success && data.design) {
        setGeneratedDesign(data.design);
        // Refresh history
        fetchRecentDesigns();
      } else {
        console.error('Generation failed:', data.error);
        alert(data.error || 'Failed to generate design');
      }
    } catch (error) {
      console.error('Error generating design:', error);
      alert('Failed to generate design. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (field: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownloadImage = () => {
    if (generatedDesign?.imageUrl) {
      const link = document.createElement('a');
      link.href = generatedDesign.imageUrl;
      link.download = `merch-design-${generatedDesign.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleReset = () => {
    setGeneratedDesign(null);
    setExactText('');
    setVisualStyle('Let AI decide');
    setImageFeature('');
    setTargetNiche('');
    setTone('Let AI decide');
    setAdditionalInstructions('');
  };

  const CopyButton: React.FC<{ field: string; text: string }> = ({ field, text }) => (
    <button
      onClick={() => handleCopy(field, text)}
      className="p-2 text-gray-400 hover:text-brand-500 transition-colors"
      title="Copy to clipboard"
    >
      {copiedField === field ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Merch Design Generator</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Generate print-ready merch designs with AI-powered autopilot or full manual control.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-4">
        <button
          onClick={() => setMode('autopilot')}
          className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold transition-all duration-200 ${
            mode === 'autopilot'
              ? 'bg-gradient-to-r from-brand-600 to-cyan-600 text-white shadow-lg shadow-brand-500/30'
              : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:border-brand-500/50'
          }`}
        >
          <Rocket className="w-5 h-5" />
          Autopilot Mode
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold transition-all duration-200 ${
            mode === 'manual'
              ? 'bg-gradient-to-r from-brand-600 to-cyan-600 text-white shadow-lg shadow-brand-500/30'
              : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:border-brand-500/50'
          }`}
        >
          <Target className="w-5 h-5" />
          Manual Control
        </button>
      </div>

      {/* Generator Panel */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-xl">
        {mode === 'autopilot' ? (
          /* Autopilot Mode UI */
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Risk Level: {riskLevel}
              </label>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-200 dark:bg-dark-700 rounded-full appearance-none cursor-pointer accent-brand-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Proven Sellers</span>
                  <span>Moonshot Viral</span>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 italic">
                {getRiskHelperText(riskLevel)}
              </p>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-4 bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Generate Design
                </>
              )}
            </button>
          </div>
        ) : (
          /* Manual Mode UI */
          <div className="space-y-5">
            {/* Exact Text */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Exact Text <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={exactText}
                onChange={(e) => setExactText(e.target.value)}
                placeholder="e.g., World's Okayest Nurse"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Visual Style */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Visual Style
              </label>
              <div className="relative">
                <select
                  value={visualStyle}
                  onChange={(e) => setVisualStyle(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white appearance-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                >
                  {STYLE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Image Feature */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Image Feature/Icon
              </label>
              <input
                type="text"
                value={imageFeature}
                onChange={(e) => setImageFeature(e.target.value)}
                placeholder="e.g., stethoscope icon, heart symbol"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Target Niche */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Target Niche
              </label>
              <input
                type="text"
                value={targetNiche}
                onChange={(e) => setTargetNiche(e.target.value)}
                placeholder="e.g., nurses, teachers, dog lovers"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Tone */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Tone
              </label>
              <div className="relative">
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white appearance-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                >
                  {TONE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Additional Instructions */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Additional Instructions
              </label>
              <textarea
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="Any other specific requirements..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !exactText.trim()}
              className="w-full py-4 bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Target className="w-5 h-5" />
                  Generate Design with These Specs
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Results Display */}
      {generatedDesign && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Generated Design</h2>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-brand-500 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Generate Another
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Image */}
            <div className="space-y-3">
              <div className="aspect-square bg-gray-100 dark:bg-dark-700 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10">
                <img
                  src={generatedDesign.imageUrl}
                  alt={generatedDesign.phrase}
                  className="w-full h-full object-contain"
                />
              </div>
              <button
                onClick={handleDownloadImage}
                className="w-full py-3 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Image
              </button>
              <div className="text-center">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-500/10 text-brand-500">
                  {generatedDesign.mode === 'autopilot' ? 'Autopilot' : 'Manual'} Mode
                </span>
              </div>
            </div>

            {/* Listing Details */}
            <div className="space-y-4">
              {/* Title */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    Listing Title
                  </label>
                  <CopyButton field="title" text={editableTitle} />
                </div>
                <textarea
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none text-sm"
                />
              </div>

              {/* Bullet Points */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    Bullet Points
                  </label>
                  <CopyButton field="bullets" text={editableBullets.join('\n')} />
                </div>
                <div className="space-y-2">
                  {editableBullets.map((bullet, index) => (
                    <input
                      key={index}
                      type="text"
                      value={bullet}
                      onChange={(e) => {
                        const newBullets = [...editableBullets];
                        newBullets[index] = e.target.value;
                        setEditableBullets(newBullets);
                      }}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-sm"
                    />
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    Description
                  </label>
                  <CopyButton field="desc" text={editableDesc} />
                </div>
                <textarea
                  value={editableDesc}
                  onChange={(e) => setEditableDesc(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Design History */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-xl">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Recent Designs</h2>

        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : recentDesigns.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No designs yet. Generate your first one above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {recentDesigns.map((design) => (
              <div
                key={design.id}
                className="group cursor-pointer"
                onClick={() => setGeneratedDesign(design)}
              >
                <div className="aspect-square bg-gray-100 dark:bg-dark-700 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 group-hover:border-brand-500 transition-colors">
                  <img
                    src={design.imageUrl}
                    alt={design.phrase}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {design.phrase}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400">
                      {design.mode}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(design.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MerchGenerator;

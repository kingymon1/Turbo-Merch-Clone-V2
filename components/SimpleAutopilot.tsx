'use client';

import React, { useState } from 'react';
import { Zap, Loader2, Image as ImageIcon, Copy, Check, Download, ChevronDown, Sparkles } from 'lucide-react';

type ImageModel = 'ideogram' | 'imagen' | 'gpt-image-1' | 'dalle3';

interface SlotValues {
  style: string;
  textTop: string;
  textBottom: string;
  aesthetic: string;
  color: string;
  trendTopic: string;
  trendSummary: string;
}

interface Listing {
  brand: string;
  title: string;
  bullet1: string;
  bullet2: string;
  description: string;
}

interface GenerationResult {
  trendData: {
    topic: string;
    summary: string;
    source: string;
  };
  slotValues: SlotValues;
  prompt: string;
  imageUrl: string;
  listing: Listing;
  savedDesignId: string;
}

const IMAGE_MODELS: { value: ImageModel; label: string; description: string }[] = [
  { value: 'ideogram', label: 'Ideogram 3.0', description: 'Best typography/text rendering' },
  { value: 'imagen', label: 'Google Imagen 4', description: 'Strong text, enterprise-grade' },
  { value: 'gpt-image-1', label: 'GPT-Image-1', description: 'Good text, transparent backgrounds' },
  { value: 'dalle3', label: 'DALL-E 3', description: 'Vivid artistic styles' },
];

const SimpleAutopilot: React.FC = () => {
  const [category, setCategory] = useState('');
  const [imageModel, setImageModel] = useState<ImageModel>('ideogram');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');

  const handleStart = async () => {
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      setCurrentStep('Finding trending topic...');

      const response = await fetch('/api/simple-autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: category.trim() || undefined,
          imageModel,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      setResult(data.data);
      setCurrentStep('');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setCurrentStep('');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownload = async () => {
    if (!result?.imageUrl) return;

    try {
      const response = await fetch(result.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.slotValues.textTop}-${result.slotValues.textBottom}.png`.replace(/\s+/g, '-');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/20">
          <Zap className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Simple Autopilot</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Find trends, generate designs, create listings - all in one click</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-white/10 p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Category Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category / Niche
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Leave blank for any trending topic"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
              disabled={isGenerating}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              e.g., "gaming", "dogs", "fitness", "coffee lovers"
            </p>
          </div>

          {/* Image Model Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Image Model
            </label>
            <div className="relative">
              <select
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value as ImageModel)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 cursor-pointer"
                disabled={isGenerating}
              >
                {IMAGE_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label} - {model.description}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={isGenerating}
          className="mt-6 w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-purple-500/25 disabled:shadow-none flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{currentStep || 'Generating...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Start</span>
            </>
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 dark:text-red-400">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Trend Info */}
          <div className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-xl border border-purple-500/20 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Discovered Trend
            </h3>
            <p className="text-xl text-purple-500 dark:text-purple-400 font-medium mb-2">
              {result.trendData.topic}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {result.trendData.summary}
            </p>
          </div>

          {/* Prompt Display */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-white/10 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Generated Prompt
              </h3>
              <button
                onClick={() => copyToClipboard(result.prompt, 'prompt')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                title="Copy prompt"
              >
                {copiedField === 'prompt' ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-dark-900 rounded-lg border border-gray-200 dark:border-white/10">
              <p className="text-sm text-gray-700 dark:text-gray-300 font-mono leading-relaxed">
                {result.prompt}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="px-2 py-1 text-xs bg-purple-500/10 text-purple-500 rounded">
                Style: {result.slotValues.style}
              </span>
              <span className="px-2 py-1 text-xs bg-pink-500/10 text-pink-500 rounded">
                Aesthetic: {result.slotValues.aesthetic}
              </span>
              <span className="px-2 py-1 text-xs bg-blue-500/10 text-blue-500 rounded">
                Shirt: {result.slotValues.color}
              </span>
            </div>
          </div>

          {/* Image Result */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-500" />
                Generated Design
              </h3>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-gray-100 dark:bg-dark-900 hover:bg-gray-200 dark:hover:bg-dark-700 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
            <div className="relative aspect-[3/4] max-w-md mx-auto bg-gray-100 dark:bg-dark-900 rounded-lg overflow-hidden">
              {result.imageUrl ? (
                <img
                  src={result.imageUrl}
                  alt="Generated design"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No image generated
                </div>
              )}
            </div>
          </div>

          {/* Listing Text */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-white/10 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Listing Text
            </h3>
            <div className="space-y-4">
              {/* Brand */}
              <ListingField
                label="Brand Name"
                value={result.listing.brand}
                fieldKey="brand"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />

              {/* Title */}
              <ListingField
                label="Title"
                value={result.listing.title}
                fieldKey="title"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />

              {/* Bullet 1 */}
              <ListingField
                label="Bullet 1"
                value={result.listing.bullet1}
                fieldKey="bullet1"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />

              {/* Bullet 2 */}
              <ListingField
                label="Bullet 2"
                value={result.listing.bullet2}
                fieldKey="bullet2"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />

              {/* Description */}
              <ListingField
                label="Description"
                value={result.listing.description}
                fieldKey="description"
                copiedField={copiedField}
                onCopy={copyToClipboard}
                multiline
              />
            </div>
          </div>

          {/* Saved Confirmation */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
            <p className="text-green-600 dark:text-green-400 font-medium">
              Design saved to My Library
            </p>
            <p className="text-sm text-green-600/70 dark:text-green-400/70">
              ID: {result.savedDesignId}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

interface ListingFieldProps {
  label: string;
  value: string;
  fieldKey: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  multiline?: boolean;
}

const ListingField: React.FC<ListingFieldProps> = ({
  label,
  value,
  fieldKey,
  copiedField,
  onCopy,
  multiline = false,
}) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {label}
      </label>
      <button
        onClick={() => onCopy(value, fieldKey)}
        className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors"
        title={`Copy ${label.toLowerCase()}`}
      >
        {copiedField === fieldKey ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Copy className="w-3 h-3 text-gray-400" />
        )}
      </button>
    </div>
    {multiline ? (
      <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-dark-900 p-3 rounded-lg border border-gray-200 dark:border-white/10">
        {value}
      </p>
    ) : (
      <p className="text-sm text-gray-900 dark:text-white font-medium">
        {value}
      </p>
    )}
  </div>
);

export default SimpleAutopilot;

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Zap, Loader2, Image as ImageIcon, Copy, Check, Download, ChevronDown, Sparkles, AlertTriangle } from 'lucide-react';
import {
  getAllTypographyOptions,
  getAllEffectOptions,
  getAllAestheticOptions,
  getAllMoodOptions,
} from '@/lib/simple-style-selector';

type ImageModel = 'ideogram' | 'imagen' | 'gpt-image-1' | 'gpt-image-1.5';

// Fixed SlotValues interface to match API response
interface SlotValues {
  typography: string;
  effect: string;
  aesthetic: string;
  textTop: string;
  textBottom: string;
  imageDescription: string;
  trendTopic: string;
  trendSummary: string;
  trendSource: string;
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
  { value: 'ideogram', label: 'Model 1', description: 'Text heavy designs with minimal images' },
  { value: 'gpt-image-1.5', label: 'Model 2', description: 'Advanced images with effects and accurate text' },
];

// Get style options from the style selector
const TYPOGRAPHY_OPTIONS = getAllTypographyOptions();
const EFFECT_OPTIONS = getAllEffectOptions();
const AESTHETIC_OPTIONS = getAllAestheticOptions();
const MOOD_OPTIONS = getAllMoodOptions();

/**
 * Dropdown component with "Other..." option for custom text input
 */
interface DropdownWithCustomProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  helpText?: string;
  disabled?: boolean;
}

const DropdownWithCustom: React.FC<DropdownWithCustomProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Auto',
  helpText,
  disabled = false,
}) => {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  // Check if current value is a custom one (not in options and not empty)
  const isCurrentValueCustom = value && !options.includes(value) && value !== '';

  // Handle dropdown change
  const handleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    if (newValue === '__other__') {
      setIsCustom(true);
      // Keep the custom value if we're switching to custom mode
      if (customValue) {
        onChange(customValue);
      }
    } else {
      setIsCustom(false);
      setCustomValue('');
      onChange(newValue);
    }
  };

  // Handle custom text input change
  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setCustomValue(newValue);
    onChange(newValue);
  };

  // Determine the dropdown display value
  const dropdownValue = isCustom || isCurrentValueCustom ? '__other__' : value;

  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <select
            value={dropdownValue}
            onChange={handleDropdownChange}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white appearance-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all cursor-pointer"
            disabled={disabled}
          >
            <option value="">{placeholder}</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value="__other__">Other...</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>
        {(isCustom || isCurrentValueCustom) && (
          <input
            type="text"
            value={isCurrentValueCustom && !isCustom ? value : customValue}
            onChange={handleCustomChange}
            placeholder="Enter custom value"
            className="flex-1 px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            disabled={disabled}
          />
        )}
      </div>
      {helpText && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helpText}</p>
      )}
    </div>
  );
};

/**
 * Start Button Component - reusable for top and bottom
 */
interface StartButtonProps {
  onClick: () => void;
  isGenerating: boolean;
  currentStep: string;
}

const StartButton: React.FC<StartButtonProps> = ({ onClick, isGenerating, currentStep }) => (
  <button
    onClick={onClick}
    disabled={isGenerating}
    className="w-full py-4 bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
);

const SimpleAutopilot: React.FC = () => {
  // Basic inputs
  const [category, setCategory] = useState('');
  const [imageModel, setImageModel] = useState<ImageModel>('gpt-image-1.5');

  // Content inputs (renamed: additionalNotes -> description, phrase -> shirtText)
  const [description, setDescription] = useState('');
  const [shirtText, setShirtText] = useState('');
  const [mood, setMood] = useState('');
  const [audience, setAudience] = useState('');

  // Style inputs
  const [typography, setTypography] = useState('');
  const [effect, setEffect] = useState('');
  const [aesthetic, setAesthetic] = useState('');

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [isDevMode, setIsDevMode] = useState(false);

  // Ref for scrolling to image
  const imageResultRef = useRef<HTMLDivElement>(null);

  // Check for dev mode (localhost or ?dev=true)
  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const hasDevParam = new URLSearchParams(window.location.search).get('dev') === 'true';
    setIsDevMode(isLocalhost || hasDevParam);
  }, []);

  // Check if shirt text is long (for warning)
  const shirtTextWordCount = shirtText.trim().split(/\s+/).filter(Boolean).length;
  const showTextWarning = shirtTextWordCount > 6;

  // Scroll to image when result is available
  useEffect(() => {
    if (result && imageResultRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        imageResultRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  }, [result]);

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
          phrase: shirtText.trim() || undefined,
          mood: mood || undefined,
          audience: audience.trim() || undefined,
          typography: typography || undefined,
          effect: effect || undefined,
          aesthetic: aesthetic || undefined,
          additionalNotes: description.trim() || undefined,
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
      a.download = `${result.slotValues.textTop}.png`.replace(/\s+/g, '-');
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
        <div className="p-3 bg-gradient-to-br from-brand-500/20 to-cyan-500/20 rounded-xl border border-brand-500/20">
          <Zap className="w-6 h-6 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Simple Autopilot</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Find trends, generate designs, create listings - all in one click</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-xl">
        {/* Prominent Quick Start Section */}
        <div className="mb-8 p-6 bg-gradient-to-br from-brand-500/10 to-cyan-500/10 border border-brand-500/30 rounded-xl">
          <p className="text-center text-lg text-gray-700 dark:text-gray-200 mb-4">
            Just press <span className="font-bold text-brand-500">Start</span> and Turbo Merch will generate an original listing for you.
            <br />
            <span className="text-sm text-gray-500 dark:text-gray-400">Or guide it using the optional fields below.</span>
          </p>
          <StartButton onClick={handleStart} isGenerating={isGenerating} currentStep={currentStep} />
        </div>

        {/* Image Model Selector - Required */}
        <div className="mb-8">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 text-center">
            Select Image Model
          </label>
          <div className="grid grid-cols-2 gap-4">
            {IMAGE_MODELS.map((model) => (
              <button
                key={model.value}
                type="button"
                onClick={() => setImageModel(model.value)}
                disabled={isGenerating}
                className={`p-8 rounded-xl border-2 transition-all text-center ${
                  imageModel === model.value
                    ? 'border-brand-500 bg-brand-500/10 dark:bg-brand-500/20 shadow-lg shadow-brand-500/20'
                    : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-dark-700 hover:border-gray-300 dark:hover:border-white/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <p className={`text-xl font-bold mb-2 ${
                  imageModel === model.value
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {model.label}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {model.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Optional Fields Header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
          <span className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Optional Fields</span>
          <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
        </div>

        {/* Design Section - Description and Text first */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Design
          </h3>
          <div className="space-y-5">
            {/* Description (formerly Additional Notes) - now first */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the design you want..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none"
                disabled={isGenerating}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                e.g., "A bull rider on a bucking bull with USA flag in background, heavy distressed style"
              </p>
            </div>

            {/* Text on the shirt (formerly Phrase) - second */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Text on the shirt
              </label>
              <input
                type="text"
                value={shirtText}
                onChange={(e) => setShirtText(e.target.value)}
                placeholder="Leave blank to discover"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                disabled={isGenerating}
              />
              {showTextWarning ? (
                <div className="flex items-center gap-2 mt-2 text-amber-500">
                  <AlertTriangle className="w-4 h-4" />
                  <p className="text-xs">
                    {shirtTextWordCount} words - less is better for text rendering quality
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  The main text on the shirt - less is better
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Basic Section */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Basic
          </h3>
          {/* Category Input */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              Category / Niche
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Leave blank for any trending topic"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              disabled={isGenerating}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              e.g., "gaming", "dogs", "fitness", "coffee lovers"
            </p>
          </div>
        </div>

        {/* Content Section - Mood and Audience */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Content
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mood Dropdown */}
            <DropdownWithCustom
              label="Mood"
              value={mood}
              onChange={setMood}
              options={MOOD_OPTIONS}
              placeholder="Auto"
              helpText="The emotional tone of the design"
              disabled={isGenerating}
            />

            {/* Audience Input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Target Audience
              </label>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Leave blank to discover"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                disabled={isGenerating}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                e.g., "fishing dads", "coffee addicts", "dog moms"
              </p>
            </div>
          </div>
        </div>

        {/* Style Section */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Style
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DropdownWithCustom
              label="Typography"
              value={typography}
              onChange={setTypography}
              options={TYPOGRAPHY_OPTIONS}
              placeholder="Auto"
              disabled={isGenerating}
            />

            <DropdownWithCustom
              label="Effect"
              value={effect}
              onChange={setEffect}
              options={EFFECT_OPTIONS}
              placeholder="Auto"
              disabled={isGenerating}
            />

            <DropdownWithCustom
              label="Aesthetic"
              value={aesthetic}
              onChange={setAesthetic}
              options={AESTHETIC_OPTIONS}
              placeholder="Auto"
              disabled={isGenerating}
            />
          </div>
        </div>

        {/* Bottom Start Button */}
        <StartButton onClick={handleStart} isGenerating={isGenerating} currentStep={currentStep} />
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
          <div className="bg-gradient-to-br from-brand-500/5 to-cyan-500/5 rounded-xl border border-brand-500/20 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Discovered Trend
            </h3>
            <p className="text-xl text-brand-500 dark:text-brand-400 font-medium mb-2">
              {result.trendData.topic}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {result.trendData.summary}
            </p>
          </div>

          {/* Prompt Display - Dev/Admin only */}
          {isDevMode && (
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-white/10 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Generated Prompt
                  <span className="ml-2 text-xs font-normal text-gray-400">(Dev Mode)</span>
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
                <span className="px-2 py-1 text-xs bg-brand-500/10 text-brand-500 rounded">
                  Typography: {result.slotValues.typography}
                </span>
                <span className="px-2 py-1 text-xs bg-cyan-500/10 text-cyan-500 rounded">
                  Effect: {result.slotValues.effect}
                </span>
                <span className="px-2 py-1 text-xs bg-blue-500/10 text-blue-500 rounded">
                  Aesthetic: {result.slotValues.aesthetic}
                </span>
              </div>
            </div>
          )}

          {/* Image Result - with ref for auto-scroll */}
          <div ref={imageResultRef} className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-brand-500" />
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

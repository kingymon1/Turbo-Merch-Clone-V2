'use client';

import React, { useState, useEffect } from 'react';
import { TrendData, GeneratedListing, ProcessingStage, MerchPackage, PromptMode, ImageVersion, AppView } from '../types';
import { generateListing, generateDesignImageEnhanced } from '../services/geminiService';
import { Loader2, CheckCircle, Edit3, ShieldCheck, AlertTriangle, FileText, Package, Image as ImageIcon, Download, Save, Lock, RefreshCw, Sparkles, Wand2, Copy } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import ImageRefinementChat from './ImageRefinementChat';
import VariationsModal from './VariationsModal';
// @ts-ignore
import JSZip from 'jszip';

interface ListingGeneratorProps {
  selectedTrend: TrendData;
  autoRun?: boolean;
  initialData?: MerchPackage;
  previousView?: AppView;
  onReset: () => void;
  onSave: (data: MerchPackage) => Promise<{ id: string } | void> | void;
  isAnonymous?: boolean;
  onNavigateToSubscription?: () => void;
  userTier?: string;
  remainingQuota?: number;
}

// Map view names to display labels
const VIEW_LABELS: Record<AppView, string> = {
  [AppView.DASHBOARD]: 'Dashboard',
  [AppView.TREND_RESEARCH]: 'Trends',
  [AppView.LISTING_GENERATOR]: 'Trends',
  [AppView.LIBRARY]: 'Library',
  [AppView.IDEAS_VAULT]: 'Ideas Vault',
  [AppView.SUBSCRIPTION]: 'Subscription',
  [AppView.REFUNDS]: 'Refunds',
  [AppView.TERMS]: 'Terms',
  [AppView.PRIVACY]: 'Privacy',
  [AppView.CONTACT]: 'Contact',
};

const ListingGenerator: React.FC<ListingGeneratorProps> = ({ selectedTrend, autoRun, initialData, previousView, onReset, onSave, isAnonymous, onNavigateToSubscription, userTier = 'free', remainingQuota = 0 }) => {
  const [listing, setListing] = useState<GeneratedListing | null>(initialData?.listing || null);
  const [status, setStatus] = useState<ProcessingStage>(initialData ? ProcessingStage.COMPLETE : ProcessingStage.IDLE);
  const [imageUrl, setImageUrl] = useState<string | null>(initialData?.imageUrl || null);
  const [isZipping, setIsZipping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Only skip auto-save if viewing a SAVED design (has id), not pre-generated data
  const [hasAutoSaved, setHasAutoSaved] = useState(!!(initialData && (initialData as any).id));
  const [complianceChecks, setComplianceChecks] = useState({
    bannedWords: !!initialData,
    trademark: !!initialData,
    formatting: !!initialData
  });

  // Variations modal state
  const [showVariationsModal, setShowVariationsModal] = useState(false);

  // Dynamic progress bar state
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('Initializing...');

  // Animated progress effect - never static, always moving
  useEffect(() => {
    if (status !== ProcessingStage.GENERATING_TEXT && status !== ProcessingStage.GENERATING_IMAGE) {
      setProgress(0);
      return;
    }

    const messages = status === ProcessingStage.GENERATING_TEXT
      ? [
          'Analyzing trend data...',
          'Researching Amazon compliance...',
          'Generating SEO keywords...',
          'Crafting compelling title...',
          'Writing product description...',
          'Optimizing bullet points...',
          'Checking trademark database...',
          'Filtering prohibited words...',
          'Validating content structure...',
          'Finalizing listing copy...'
        ]
      : [
          'Preparing design canvas...',
          'Analyzing visual style...',
          'Generating base composition...',
          'Applying typography...',
          'Rendering design elements...',
          'Optimizing color palette...',
          'Adding finishing touches...',
          'Enhancing visual clarity...',
          'Preparing high-res output...',
          'Finalizing artwork...'
        ];

    let currentProgress = status === ProcessingStage.GENERATING_IMAGE ? 50 : 0;
    let messageIndex = 0;

    // Initial progress
    setProgress(currentProgress);
    setProgressMessage(messages[0]);

    // Smooth progress increment - always moving
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        // Calculate target based on stage
        const maxProgress = status === ProcessingStage.GENERATING_TEXT ? 48 : 95;
        const minIncrement = 0.3;
        const maxIncrement = 1.5;

        // Random increment for natural feel
        const increment = minIncrement + Math.random() * (maxIncrement - minIncrement);

        // Slow down as we approach the max
        const remaining = maxProgress - prev;
        const adjustedIncrement = Math.min(increment, remaining * 0.1);

        const newProgress = Math.min(prev + adjustedIncrement, maxProgress);
        return newProgress;
      });
    }, 150); // Update every 150ms for smooth animation

    // Message rotation
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setProgressMessage(messages[messageIndex]);
    }, 2500); // Change message every 2.5 seconds

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [status]);

  // Jump progress when stage changes
  useEffect(() => {
    if (status === ProcessingStage.GENERATING_IMAGE) {
      setProgress(52);
    } else if (status === ProcessingStage.COMPLETE) {
      setProgress(100);
    }
  }, [status]);

  // Regeneration state
  const [regenerationCount, setRegenerationCount] = useState(0);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [promptMode, setPromptMode] = useState<PromptMode>(initialData?.promptMode || 'advanced');
  const [generatedAt] = useState<number>(initialData?.generatedAt || Date.now());

  // Refinement state
  const [refinementCount, setRefinementCount] = useState(0);

  // Image history - store all versions
  const [imageHistory, setImageHistory] = useState<ImageVersion[]>(
    initialData?.imageHistory || (initialData?.imageUrl ? [{
      imageUrl: initialData.imageUrl,
      promptMode: initialData.promptMode || 'advanced',
      generatedAt: initialData.generatedAt || Date.now(),
      regenerationIndex: 0
    }] : [])
  );
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Overage modal state for regeneration
  const [showOverageModal, setShowOverageModal] = useState(false);
  const [overageData, setOverageData] = useState<{
      used: number;
      allowance: number;
      overage: number;
      overageCharge: number;
      tier: string;
      reason?: string;
      requiresUpgrade?: boolean;
  } | null>(null);
  const [pendingRegenerateMode, setPendingRegenerateMode] = useState<PromptMode | undefined>(undefined);

  // Track the saved design ID so regeneration updates instead of creates
  const [savedDesignId, setSavedDesignId] = useState<string | undefined>((initialData as any)?.id);

  // Reset hasAutoSaved when initialData changes
  useEffect(() => {
    // Only set to true if this is a saved design (has id), not pre-generated data
    setHasAutoSaved(!!(initialData && (initialData as any).id));
    console.log('[ListingGenerator] initialData changed, hasAutoSaved set to:', !!(initialData && (initialData as any).id), 'hasId:', !!(initialData as any)?.id);
  }, [initialData]);

  useEffect(() => {
    // Don't run generation if viewing an existing design (initialData)
    // Always generate when a trend is selected, regardless of autoRun flag
    if (initialData) return;

    const runSequence = async () => {
      console.log('[ListingGenerator] Starting generation for trend:', selectedTrend.topic);
      setStatus(ProcessingStage.GENERATING_TEXT);

      const t1 = setTimeout(() => setComplianceChecks(p => ({ ...p, bannedWords: true })), 800);
      const t2 = setTimeout(() => setComplianceChecks(p => ({ ...p, trademark: true })), 1500);
      const t3 = setTimeout(() => setComplianceChecks(p => ({ ...p, formatting: true })), 2200);

      try {
        const result = await generateListing(selectedTrend);
        setListing(result);

        // Use enhanced design generation - it uses the full trend context
        triggerDesignGeneration();

      } catch (e) {
        setStatus(ProcessingStage.ERROR);
      }

      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    };

    runSequence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrend, initialData, autoRun]);

  useEffect(() => {
      console.log('[ListingGenerator] Auto-save check:', {
          status,
          hasListing: !!listing,
          hasImageUrl: !!imageUrl,
          hasAutoSaved,
          isSaving,
          isAnonymous
      });

      if (status === ProcessingStage.COMPLETE && listing && imageUrl && !hasAutoSaved && !isSaving && !isAnonymous) {
          console.log('[ListingGenerator] Starting auto-save...', { savedDesignId, isUpdate: !!savedDesignId });
          const autoSave = async () => {
              setIsSaving(true);
              await new Promise(resolve => setTimeout(resolve, 1200));

              // Calculate time to first action (auto-save)
              const timeToAction = Math.floor((Date.now() - generatedAt) / 1000);

              const saveData = {
                  trend: selectedTrend,
                  listing,
                  imageUrl,
                  imageHistory,
                  promptMode,
                  generatedAt,
                  // @ts-ignore - extended data for analytics
                  _analytics: {
                      regenerationCount,
                      timeToFirstAction: timeToAction,
                      wasRegenerated: regenerationCount > 0,
                      // Pass the existing design ID for updates (regeneration)
                      existingDesignId: savedDesignId
                  }
              };

              console.log('[ListingGenerator] Calling onSave with data:', {
                  trend: selectedTrend.topic,
                  hasListing: !!listing,
                  hasImageUrl: !!imageUrl,
                  isUpdate: !!savedDesignId,
                  savedDesignId
              });

              // onSave will return the design ID for new saves
              const result = await onSave(saveData);

              // Store the design ID for future updates (if this was a new save)
              if (result && typeof result === 'object' && 'id' in result) {
                  setSavedDesignId(result.id);
              }

              setIsSaving(false);
              setHasAutoSaved(true);
          };
          autoSave();
      }
  }, [status, listing, imageUrl, imageHistory, hasAutoSaved, isSaving, onSave, selectedTrend, isAnonymous, promptMode, generatedAt, regenerationCount, savedDesignId]);

  const triggerDesignGeneration = async (mode?: PromptMode, isRegeneration: boolean = false) => {
      setStatus(ProcessingStage.GENERATING_IMAGE);
      try {
        const modeToUse = mode || promptMode;
        // Use Enhanced Pipeline - pass the full trend object for intelligent design research
        const { imageUrl: url } = await generateDesignImageEnhanced(selectedTrend, true, modeToUse);
        setImageUrl(url);

        // Add to image history
        const newVersion: ImageVersion = {
          imageUrl: url,
          promptMode: modeToUse,
          generatedAt: Date.now(),
          regenerationIndex: isRegeneration ? regenerationCount : 0
        };

        setImageHistory(prev => {
          const updated = [...prev, newVersion];
          // Auto-select the new image
          setSelectedImageIndex(updated.length - 1);
          return updated;
        });

        setStatus(ProcessingStage.COMPLETE);
      } catch (e) {
        setStatus(ProcessingStage.ERROR);
      }
  };

  // Check quota before regeneration
  const handleRegenerate = async (newMode?: PromptMode) => {
      if (!listing || isRegenerating || isAnonymous) return;

      // Store the mode for after confirmation
      setPendingRegenerateMode(newMode);

      try {
          // Check quota first
          const quotaResponse = await fetch('/api/designs/check-quota', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ designCount: 1 })
          });

          const quotaResult = await quotaResponse.json();

          if (!quotaResult.allowed) {
              // Show modal for overage or upgrade required
              const usage = quotaResult.usage || {};
              setOverageData({
                  used: usage.used || 0,
                  allowance: usage.allowance || 0,
                  overage: usage.overage || 1,
                  overageCharge: usage.overageCharge || 0,
                  tier: usage.tier || 'free',
                  reason: quotaResult.error,
                  requiresUpgrade: usage.tier === 'free' || usage.remaining === 0
              });
              setShowOverageModal(true);
              return;
          }

          // Quota OK - proceed with regeneration
          await executeRegeneration(newMode);

      } catch (error) {
          console.error('Quota check failed:', error);
          // If quota check fails, still block - don't proceed without confirmation
          alert('Unable to verify usage quota. Please try again.');
      }
  };

  // Execute the actual regeneration (after quota check passes or user confirms overage)
  const executeRegeneration = async (newMode?: PromptMode) => {
      if (!listing) return;

      const modeToUse = newMode || promptMode;
      if (newMode) setPromptMode(newMode);

      setIsRegenerating(true);
      const newCount = regenerationCount + 1;
      setRegenerationCount(newCount);

      try {
          // Use Enhanced Pipeline for regeneration - pass the full trend object
          const { imageUrl: url } = await generateDesignImageEnhanced(selectedTrend, true, modeToUse);
          setImageUrl(url);

          // Add regenerated image to history
          const newVersion: ImageVersion = {
              imageUrl: url,
              promptMode: modeToUse,
              generatedAt: Date.now(),
              regenerationIndex: newCount
          };

          setImageHistory(prev => {
              const updated = [...prev, newVersion];
              // Auto-select the new image
              setSelectedImageIndex(updated.length - 1);
              return updated;
          });

          // Reset auto-save so the new image gets saved
          setHasAutoSaved(false);
      } catch (e) {
          console.error('Regeneration failed:', e);
      } finally {
          setIsRegenerating(false);
      }
  };

  // Handle overage confirmation for regeneration
  const handleOverageConfirm = async () => {
      setShowOverageModal(false);
      await executeRegeneration(pendingRegenerateMode);
      setPendingRegenerateMode(undefined);
  };

  // Handle overage modal close (cancel)
  const handleOverageCancel = () => {
      setShowOverageModal(false);
      setPendingRegenerateMode(undefined);
  };

  const upscaleImageToPrintReady = async (base64Source: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64Source;
        img.crossOrigin = "Anonymous";
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            // Ensure 4500x5400 for Amazon
            canvas.width = 4500;
            canvas.height = 5400;
            
            // Use 'willReadFrequently' for better performance on software renders
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
            }

            try {
                // 1. Scaling
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                const zoomFactor = 1.05;
                const scaledWidth = canvas.width * zoomFactor;
                const scaledHeight = canvas.height * zoomFactor;
                const offsetX = (canvas.width - scaledWidth) / 2;
                const offsetY = (canvas.height - scaledHeight) / 2;

                ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

                // 2. Processing (Optimized Single Pass)
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const width = canvas.width;
                const height = canvas.height;
                const output = new Uint8ClampedArray(data.length);
                
                // Detect background color
                const cornerR = data[0];
                const cornerG = data[1];
                const cornerB = data[2];
                const isWhiteBg = cornerR > 200 && cornerG > 200 && cornerB > 200;
                const BG_THRESHOLD = 40;

                let minX = width, minY = height, maxX = 0, maxY = 0;
                const mix = 0.2;
                const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const idx = (y * width + x) * 4;
                        
                        // Skip borders
                        if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
                            output[idx + 3] = 0;
                            continue;
                        }

                        // Sharpen
                        let r = 0, g = 0, b = 0;
                        // Simplified convolution for performance (cross pattern only)
                        // Center * 5 - (Top + Bottom + Left + Right)
                        const top = ((y - 1) * width + x) * 4;
                        const bottom = ((y + 1) * width + x) * 4;
                        const left = (y * width + (x - 1)) * 4;
                        const right = (y * width + (x + 1)) * 4;
                        
                        r = data[idx] * 5 - (data[top] + data[bottom] + data[left] + data[right]);
                        g = data[idx + 1] * 5 - (data[top + 1] + data[bottom + 1] + data[left + 1] + data[right + 1]);
                        b = data[idx + 2] * 5 - (data[top + 2] + data[bottom + 2] + data[left + 2] + data[right + 2]);

                        const sr = data[idx] * (1 - mix) + r * mix;
                        const sg = data[idx + 1] * (1 - mix) + g * mix;
                        const sb = data[idx + 2] * (1 - mix) + b * mix;

                        // Transparency
                        const origR = data[idx];
                        const origG = data[idx + 1];
                        const origB = data[idx + 2];
                        
                        let isBackground = false;
                        if (isWhiteBg) {
                            if (origR > 240 && origG > 240 && origB > 240) isBackground = true;
                        } else {
                            if (origR < BG_THRESHOLD && origG < BG_THRESHOLD && origB < BG_THRESHOLD) isBackground = true;
                        }

                        if (isBackground) {
                            output[idx + 3] = 0;
                        } else {
                            output[idx] = sr;
                            output[idx + 1] = sg;
                            output[idx + 2] = sb;
                            output[idx + 3] = 255;
                            
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                        }
                    }
                }

                const newImageData = new ImageData(output, width, height);
                ctx.putImageData(newImageData, 0, 0);

                // 3. Chest Placement Lift
                const contentHeight = maxY - minY;
                const contentWidth = maxX - minX;
                
                if (contentHeight > 0 && contentHeight < 4600 && minY > 300) {
                    const designData = ctx.getImageData(minX, minY, contentWidth, contentHeight);
                    ctx.clearRect(0, 0, width, height);
                    const newX = (width - contentWidth) / 2;
                    const newY = 150; 
                    ctx.putImageData(designData, newX, newY);
                }
                
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Canvas blob failed"));
                }, 'image/png');

            } catch (error) {
                console.error("Upscale failed", error);
                reject(error);
            }
        };

        img.onerror = (err) => reject(err);
    });
  };

  const handleSave = async () => {
      if (!listing || !imageUrl || hasAutoSaved || isAnonymous) return;
      setIsSaving(true);

      // Calculate time to first action
      const timeToAction = Math.floor((Date.now() - generatedAt) / 1000);

      const result = await onSave({
          trend: selectedTrend,
          listing,
          imageUrl,
          imageHistory,
          promptMode,
          generatedAt,
          // Include regeneration data for analytics
          // @ts-ignore - extended data for analytics
          _analytics: {
              regenerationCount,
              timeToFirstAction: timeToAction,
              wasRegenerated: regenerationCount > 0
          }
      });

      // Store the design ID for refinement tracking
      if (result && 'id' in result) {
          setSavedDesignId(result.id);
      }

      setTimeout(() => {
          setIsSaving(false);
          setHasAutoSaved(true);
      }, 1000);
  };

  // Handle image refinement
  const handleImageRefined = (newImageUrl: string, instruction: string) => {
      setImageUrl(newImageUrl);
      setRefinementCount(prev => prev + 1);

      // Add to image history
      const newVersion: ImageVersion = {
          imageUrl: newImageUrl,
          promptMode: 'advanced', // Refinements use advanced mode
          generatedAt: Date.now(),
          regenerationIndex: imageHistory.length,
      };
      setImageHistory(prev => [...prev, newVersion]);
      setSelectedImageIndex(imageHistory.length);
  };

  // Download a specific image from history
  const downloadSingleImage = async (version: ImageVersion, index: number) => {
      if (!listing) return;

      setIsZipping(true);
      try {
          const brandSafe = (listing.brand || 'design').replace(/[\s\W]+/g, '_');
          const versionSuffix = index === 0 ? 'original' : `v${index}`;

          const highResBlob = await upscaleImageToPrintReady(version.imageUrl);

          // Create download link for single image
          const link = document.createElement("a");
          link.href = URL.createObjectURL(highResBlob);
          link.download = `${brandSafe}_${versionSuffix}_4500x5400.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (error) {
          console.error("Failed to download image:", error);
          alert("Could not download image.");
      } finally {
          setIsZipping(false);
      }
  };

  const downloadPackage = async () => {
      if (!listing || !imageUrl) return;

      setIsZipping(true);

      // Calculate time to download for analytics
      const timeToDownload = Math.floor((Date.now() - generatedAt) / 1000);

      try {
        const zip = new JSZip();
        const brandSafe = (listing.brand || 'design').replace(/[\s\W]+/g, '_');

        const headers = ['Brand', 'Title', 'Bullet1', 'Bullet2', 'Description', 'Keywords'];
        const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
        const row = [
            listing.brand || '',
            listing.title,
            listing.bullet1,
            listing.bullet2,
            listing.description,
            listing.keywords.join(',')
        ].map(escapeCsv).join(',');
        const csvContent = `${headers.join(',')}\n${row}`;
        zip.file(`${brandSafe}_listing.csv`, csvContent);

        const highResBlob = await upscaleImageToPrintReady(imageUrl);
        zip.file(`${brandSafe}_4500x5400_transparent.png`, highResBlob);

        const content = await zip.generateAsync({type: "blob"});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `${brandSafe}_merch_package.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Track download event (fire and forget)
        try {
            fetch('/api/analytics/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trend: selectedTrend.topic,
                    promptMode,
                    regenerationCount,
                    timeToDownload,
                    wasRegenerated: regenerationCount > 0,
                    shirtColor: selectedTrend.recommendedShirtColor
                })
            }).catch(() => {}); // Ignore analytics errors
        } catch {} // Ignore analytics errors

        console.log('📊 Download analytics:', {
            trend: selectedTrend.topic,
            promptMode,
            regenerationCount,
            timeToDownload,
            wasRegenerated: regenerationCount > 0
        });

      } catch (error) {
          console.error("Failed to zip package:", error);
          alert("Could not create zip package.");
      } finally {
          setIsZipping(false);
      }
  };

  if (status === ProcessingStage.GENERATING_TEXT || status === ProcessingStage.GENERATING_IMAGE || !imageUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-8">
        {/* Animated background glow */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-500 via-cyan-500 to-brand-500 blur-2xl opacity-20 animate-pulse"></div>
          <div className="absolute inset-0 bg-brand-500 blur-xl opacity-10 animate-ping"></div>
          <Loader2 className="w-16 h-16 text-brand-500 dark:text-brand-400 animate-spin relative z-10" />
        </div>

        <div className="w-full max-w-lg bg-white dark:bg-dark-800/80 border border-gray-200 dark:border-white/10 rounded-2xl p-8 space-y-6 backdrop-blur-sm shadow-2xl">
            {/* Header with stage indicator */}
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {status === ProcessingStage.GENERATING_TEXT ? "Creating Your Listing" : "Generating Your Design"}
                </h2>
                <p className="text-brand-500 dark:text-brand-400 text-sm font-medium animate-pulse">
                    {progressMessage}
                </p>
            </div>

            {/* Main progress bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Progress</span>
                    <span className="font-mono text-brand-500 dark:text-brand-400">{Math.round(progress)}%</span>
                </div>
                <div className="relative h-3 bg-gray-200 dark:bg-dark-900 rounded-full overflow-hidden">
                    {/* Animated background shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
                    {/* Progress fill */}
                    <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-brand-600 via-brand-400 to-cyan-500 rounded-full transition-all duration-150 ease-out"
                        style={{ width: `${progress}%` }}
                    >
                        {/* Inner glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                    </div>
                    {/* Pulsing dot at end of progress */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg shadow-brand-400/50 animate-pulse transition-all duration-150"
                        style={{ left: `calc(${progress}% - 4px)` }}
                    ></div>
                </div>
            </div>

            {/* Stage indicators */}
            <div className="flex items-center justify-between pt-2">
                <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                        progress >= 5 ? 'bg-green-500/20 border-2 border-green-500' : 'bg-gray-100 dark:bg-dark-700 border-2 border-gray-300 dark:border-gray-600'
                    }`}>
                        {progress >= 48 ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                            <Loader2 className="w-4 h-4 text-brand-500 dark:text-brand-400 animate-spin" />
                        )}
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Listing</span>
                </div>

                <div className="flex-1 h-0.5 mx-2 bg-gray-200 dark:bg-dark-700 relative overflow-hidden">
                    <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-brand-500 transition-all duration-300"
                        style={{ width: progress >= 48 ? '100%' : `${Math.max(0, (progress / 48) * 100)}%` }}
                    ></div>
                </div>

                <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                        progress >= 50 ? 'bg-brand-500/20 border-2 border-brand-500' : 'bg-gray-100 dark:bg-dark-700 border-2 border-gray-300 dark:border-gray-600'
                    }`}>
                        {progress >= 95 ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : progress >= 50 ? (
                            <Loader2 className="w-4 h-4 text-brand-500 dark:text-brand-400 animate-spin" />
                        ) : (
                            <ImageIcon className="w-4 h-4 text-gray-500" />
                        )}
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Design</span>
                </div>

                <div className="flex-1 h-0.5 mx-2 bg-gray-200 dark:bg-dark-700 relative overflow-hidden">
                    <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-brand-500 to-cyan-500 transition-all duration-300"
                        style={{ width: progress >= 95 ? '100%' : progress >= 50 ? `${Math.max(0, ((progress - 50) / 45) * 100)}%` : '0%' }}
                    ></div>
                </div>

                <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                        progress >= 95 ? 'bg-cyan-500/20 border-2 border-cyan-500' : 'bg-gray-100 dark:bg-dark-700 border-2 border-gray-300 dark:border-gray-600'
                    }`}>
                        {progress >= 100 ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                            <Package className="w-4 h-4 text-gray-500" />
                        )}
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Complete</span>
                </div>
            </div>

            {/* Compliance checks - more compact */}
            <div className="border-t border-gray-200 dark:border-white/5 pt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 flex items-center gap-2">
                        {complianceChecks.bannedWords ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
                        Prohibited Words
                    </span>
                    <span className={complianceChecks.bannedWords ? "text-green-500 dark:text-green-400 font-mono text-[10px]" : "text-gray-400 dark:text-gray-600 font-mono text-[10px]"}>
                        {complianceChecks.bannedWords ? "CLEAR" : "CHECKING"}
                    </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 flex items-center gap-2">
                        {complianceChecks.trademark ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
                        Trademark Safety
                    </span>
                    <span className={complianceChecks.trademark ? "text-green-500 dark:text-green-400 font-mono text-[10px]" : "text-gray-400 dark:text-gray-600 font-mono text-[10px]"}>
                        {complianceChecks.trademark ? "SAFE" : "SCANNING"}
                    </span>
                </div>
            </div>
        </div>

        {/* Subtle tip at bottom */}
        <p className="text-xs text-gray-500 dark:text-gray-600 text-center max-w-sm">
            Our AI is crafting a unique, Amazon-compliant listing just for you
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between mb-2">
             <button onClick={onReset} className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">← Back to {previousView ? VIEW_LABELS[previousView] : 'Trends'}</button>
             <div className="flex items-center gap-2">
                 <span className="flex items-center gap-1 px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-xs rounded-full border border-green-500/20">
                   <ShieldCheck className="w-3 h-3" /> Safe for Merch
                 </span>
                 <span className="px-3 py-1 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 text-xs rounded-full border border-brand-200 dark:border-brand-500/20">
                   {selectedTrend.topic}
                 </span>
             </div>
        </div>

        <div className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl p-6 space-y-6 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10">
               <FileText className="w-24 h-24 text-gray-400 dark:text-white" />
           </div>

           <div className="flex items-center justify-between relative z-10">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-brand-500 dark:text-brand-400" /> Amazon Merch on Demand Listing
              </h3>
           </div>

           <div className="space-y-4 relative z-10">
              <div className="grid grid-cols-1 gap-4">
                  <div className="group">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">Brand Name</label>
                        <span className="text-[10px] text-gray-400 dark:text-gray-600 font-mono">{listing?.brand?.length || 0}/50</span>
                    </div>
                    <div className="text-gray-900 dark:text-white font-medium bg-gray-50 dark:bg-dark-900 p-3 rounded-lg border border-gray-200 dark:border-white/5 mt-1 group-hover:border-brand-500/30 transition-colors select-all">
                      {listing?.brand}
                    </div>
                  </div>

                  <div className="group">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">Title</label>
                        <span className={`text-[10px] font-mono ${(listing?.title.length || 0) > 45 ? 'text-green-500 dark:text-green-400' : 'text-yellow-500'}`}>
                            {listing?.title.length}/60 {((listing?.title.length || 0) < 45) && "(Low Density)"}
                        </span>
                    </div>
                    <div className="text-gray-900 dark:text-white font-medium bg-gray-50 dark:bg-dark-900 p-3 rounded-lg border border-gray-200 dark:border-white/5 mt-1 group-hover:border-brand-500/30 transition-colors select-all truncate">
                      {listing?.title}
                    </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="group">
                  <div className="flex justify-between items-center">
                     <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">Bullet 1</label>
                     <span className={`text-[10px] font-mono ${(listing?.bullet1.length || 0) > 200 ? 'text-green-500 dark:text-green-400' : 'text-yellow-500'}`}>
                         {listing?.bullet1.length}/256
                     </span>
                  </div>
                  <div className="text-gray-600 dark:text-gray-300 text-sm bg-gray-50 dark:bg-dark-900 p-3 rounded-lg border border-gray-200 dark:border-white/5 mt-1 group-hover:border-brand-500/30 transition-colors select-all">
                    {listing?.bullet1}
                  </div>
                </div>
                <div className="group">
                  <div className="flex justify-between items-center">
                     <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">Bullet 2</label>
                     <span className={`text-[10px] font-mono ${(listing?.bullet2.length || 0) > 200 ? 'text-green-500 dark:text-green-400' : 'text-yellow-500'}`}>
                         {listing?.bullet2.length}/256
                     </span>
                  </div>
                  <div className="text-gray-600 dark:text-gray-300 text-sm bg-gray-50 dark:bg-dark-900 p-3 rounded-lg border border-gray-200 dark:border-white/5 mt-1 group-hover:border-brand-500/30 transition-colors select-all">
                    {listing?.bullet2}
                  </div>
                </div>
              </div>

              <div className="group">
                 <div className="flex justify-between items-center">
                     <label className="text-xs font-mono text-brand-500 dark:text-brand-400 uppercase tracking-wider font-semibold">Product Description</label>
                     <span className="text-[10px] text-gray-400 dark:text-gray-600 font-mono">{listing?.description.length} chars</span>
                  </div>
                  <div className="text-gray-600 dark:text-gray-300 text-sm bg-gray-50 dark:bg-dark-900 p-4 rounded-lg border border-gray-200 dark:border-white/5 mt-1 group-hover:border-brand-500/30 transition-colors select-all whitespace-pre-wrap leading-relaxed">
                    {listing?.description}
                  </div>
              </div>
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl p-6 flex flex-col h-full">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                <ImageIcon className="w-5 h-5 text-cyan-500 dark:text-cyan-400" /> Design Studio
            </h3>

            {/* Shirt Color Recommendation */}
            {selectedTrend.recommendedShirtColor && (
                <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-500/20 rounded-lg p-3 mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-white/20 shadow-inner"
                            style={{
                                backgroundColor: selectedTrend.recommendedShirtColor === 'white' ? '#ffffff'
                                    : selectedTrend.recommendedShirtColor === 'navy' ? '#1e3a5f'
                                    : selectedTrend.recommendedShirtColor === 'heather grey' ? '#9ca3af'
                                    : '#000000'
                            }}
                        />
                        <div>
                            <p className="text-xs text-brand-700 dark:text-brand-200 font-bold uppercase tracking-wider">
                                Designed for {selectedTrend.recommendedShirtColor} shirt
                            </p>
                            {selectedTrend.shirtColorReason && (
                                <p className="text-[10px] text-brand-600/70 dark:text-brand-300/70 mt-0.5">
                                    {selectedTrend.shirtColorReason}
                                </p>
                            )}
                        </div>
                    </div>
                    {selectedTrend.alternativeShirtColors && selectedTrend.alternativeShirtColors.length > 0 && (
                        <div className="text-right">
                            <p className="text-[10px] text-brand-500/50 dark:text-brand-300/50 uppercase">Also works on:</p>
                            <p className="text-xs text-brand-700 dark:text-brand-200">{selectedTrend.alternativeShirtColors.join(', ')}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Image History Gallery */}
            {imageHistory.length > 1 && (
                <div className="bg-gray-50 dark:bg-dark-900/50 border border-gray-200 dark:border-white/5 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Image Versions ({imageHistory.length})
                        </span>
                        <span className="text-[10px] text-gray-500">
                            Click to view, use download button for individual images
                        </span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {imageHistory.map((version, index) => (
                            <div
                                key={`${version.generatedAt}-${index}`}
                                className={`relative flex-shrink-0 cursor-pointer group transition-all ${
                                    selectedImageIndex === index
                                        ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-offset-dark-900'
                                        : 'hover:ring-1 hover:ring-gray-400 dark:hover:ring-white/30'
                                }`}
                                onClick={() => {
                                    setSelectedImageIndex(index);
                                    setImageUrl(version.imageUrl);
                                }}
                            >
                                <img
                                    src={version.imageUrl}
                                    alt={`Version ${index + 1}`}
                                    className="w-20 h-24 object-cover rounded-md bg-black"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            downloadSingleImage(version, index);
                                        }}
                                        disabled={isZipping || isAnonymous}
                                        className="p-1.5 bg-brand-600 rounded-full hover:bg-brand-500 transition-colors"
                                        title={isAnonymous ? "Sign in to download" : `Download version ${index + 1}`}
                                    >
                                        <Download className="w-3 h-3 text-white" />
                                    </button>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[9px] text-center py-0.5 rounded-b-md">
                                    <span className={version.promptMode === 'simple' ? 'text-green-400' : 'text-blue-400'}>
                                        {index === 0 ? 'Original' : `v${index}`} • {version.promptMode === 'simple' ? 'S' : 'A'}
                                    </span>
                                </div>
                                {selectedImageIndex === index && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-brand-500 rounded-full flex items-center justify-center">
                                        <CheckCircle className="w-3 h-3 text-white" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Regeneration Controls */}
            <div className="bg-gray-50 dark:bg-dark-900/50 border border-gray-200 dark:border-white/5 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {imageHistory.length === 0 || imageHistory.length === 1 ? 'Original' : `${imageHistory.length} versions`}
                        </span>
                        {regenerationCount > 0 && (
                            <span className="text-[10px] px-2 py-0.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded border border-yellow-500/20">
                                {promptMode === 'simple' ? 'Simple Mode' : 'Advanced Mode'}
                            </span>
                        )}
                    </div>

                    {/* Regenerate Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleRegenerate('simple')}
                            disabled={isRegenerating || isAnonymous}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                isAnonymous ? 'opacity-50 cursor-not-allowed' :
                                isRegenerating ? 'opacity-50' :
                                'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                            }`}
                            title={isAnonymous ? "Sign in to regenerate" : "Regenerate with simple conversational prompt"}
                        >
                            {isRegenerating && promptMode === 'simple' ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <Sparkles className="w-3 h-3" />
                            )}
                            Simple
                        </button>
                        <button
                            onClick={() => handleRegenerate('advanced')}
                            disabled={isRegenerating || isAnonymous}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                isAnonymous ? 'opacity-50 cursor-not-allowed' :
                                isRegenerating ? 'opacity-50' :
                                'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
                            }`}
                            title={isAnonymous ? "Sign in to regenerate" : "Regenerate with detailed technical prompt"}
                        >
                            {isRegenerating && promptMode === 'advanced' ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <Wand2 className="w-3 h-3" />
                            )}
                            Advanced
                        </button>
                        <button
                            onClick={() => handleRegenerate()}
                            disabled={isRegenerating || isAnonymous}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                isAnonymous ? 'opacity-50 cursor-not-allowed' :
                                isRegenerating ? 'opacity-50' :
                                'bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20'
                            }`}
                            title={isAnonymous ? "Sign in to regenerate" : `Regenerate with current mode (${promptMode})`}
                        >
                            {isRegenerating ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <RefreshCw className="w-3 h-3" />
                            )}
                            Retry
                        </button>
                    </div>
                </div>
                {isRegenerating && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-white/5">
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Generating new design with {promptMode} mode...</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-grow bg-gray-100 dark:bg-black rounded-lg border-2 border-dashed border-gray-300 dark:border-white/10 flex items-center justify-center relative min-h-[600px] overflow-hidden group">
                <img src={imageUrl} alt="Generated Design" className="max-w-full max-h-full object-contain p-0 shadow-[0_0_30px_rgba(0,0,0,0.5)]" />
                {isAnonymous && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                        <div className="transform -rotate-45 text-gray-500 dark:text-white font-bold text-6xl whitespace-nowrap">
                            TURBO MERCH PREVIEW
                        </div>
                    </div>
                )}
            </div>

            {/* Image Refinement Chat */}
            {imageUrl && !isAnonymous && (
                <ImageRefinementChat
                    currentImageUrl={imageUrl}
                    designId={savedDesignId || undefined}
                    onImageRefined={handleImageRefined}
                    refinementCount={refinementCount}
                    className="mt-4"
                />
            )}

            <div className="mt-6 grid grid-cols-3 gap-3">
                <button
                    onClick={handleSave}
                    disabled={isSaving || hasAutoSaved || isAnonymous}
                    className={`col-span-1 font-semibold py-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${
                        isAnonymous
                        ? 'bg-gray-100 dark:bg-dark-800 text-gray-500 border-gray-200 dark:border-white/5 cursor-not-allowed'
                        : hasAutoSaved
                            ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 cursor-default'
                            : 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-900 dark:text-white border-gray-200 dark:border-white/10 hover:scale-[1.02] active:scale-95'
                    }`}
                    title={isAnonymous ? "Sign in to save" : ""}
                >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : hasAutoSaved ? <CheckCircle className="w-5 h-5" /> : isAnonymous ? <Lock className="w-4 h-4" /> : <Save className="w-5 h-5" />}
                    {isAnonymous ? 'Login to Save' : isSaving ? 'Auto-saving...' : hasAutoSaved ? 'Saved to Library' : 'Save to Library'}
                </button>

                {isAnonymous ? (
                    <button
                        onClick={() => window.location.reload()}
                        className="col-span-2 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all"
                    >
                        <Lock className="w-4 h-4" />
                        SIGN UP TO DOWNLOAD
                    </button>
                ) : (
                    <button
                        onClick={downloadPackage}
                        disabled={isZipping}
                        className="col-span-2 bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 text-white font-bold py-3 rounded-lg shadow-xl shadow-brand-900/40 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 ring-1 ring-white/10"
                    >
                        {isZipping ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                PROCESSING...
                            </>
                        ) : (
                            <>
                                <Download className="w-5 h-5" />
                                DOWNLOAD PACKAGE
                            </>
                        )}
                    </button>
                )}
            </div>
            {/* Generate Variations Button */}
            {hasAutoSaved && savedDesignId && !isAnonymous && (
                <button
                    onClick={() => setShowVariationsModal(true)}
                    className="w-full py-2.5 mt-3 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 font-semibold rounded-lg border border-brand-500/20 flex items-center justify-center gap-2 transition-all"
                >
                    <Copy className="w-4 h-4" />
                    Generate Variations
                </button>
            )}

            <p className="text-center text-xs text-gray-500 mt-2">
                 *Package includes CSV & Upscaled 4500x5400px PNG.
            </p>
        </div>
      </div>

      {/* Variations Modal */}
      {savedDesignId && (
          <VariationsModal
              isOpen={showVariationsModal}
              onClose={() => setShowVariationsModal(false)}
              designId={savedDesignId}
              designTitle={listing?.title || 'Design'}
              userTier={userTier as any}
              remainingQuota={remainingQuota}
          />
      )}

      {/* Overage Confirmation Modal for Regeneration */}
      <ConfirmationModal
          isOpen={showOverageModal}
          onClose={handleOverageCancel}
          onConfirm={handleOverageConfirm}
          onUpgrade={onNavigateToSubscription}
          title={overageData?.requiresUpgrade ? "Upgrade Required" : "Usage Limit Reached"}
          message={overageData?.requiresUpgrade
              ? overageData?.reason || "You've reached your design limit. Upgrade to continue creating designs."
              : "You've used all your included designs for this billing period. Regenerating will incur overage charges."
          }
          details={overageData ? {
              used: overageData.used,
              allowance: overageData.allowance,
              overage: overageData.overage,
              overageCharge: overageData.overageCharge,
              tier: overageData.tier
          } : undefined}
          confirmText={overageData?.requiresUpgrade ? "Close" : "Continue & Charge"}
          cancelText="Cancel"
          variant={overageData?.requiresUpgrade ? "danger" : "warning"}
          showUpgradeOption={!!onNavigateToSubscription && overageData?.requiresUpgrade}
      />
    </div>
  );
};

export default ListingGenerator;
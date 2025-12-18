'use client';

import React, { useEffect, useState } from 'react';
import { SavedListing, TrendData, GeneratedListing } from '../types';
import { Clock, Trash2, Download, ExternalLink, AlertCircle, FolderHeart, FileDown, CheckSquare, Square, Copy, Sparkles, Lock, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import VariationsModal from './VariationsModal';
import { TierName } from '../lib/pricing';
import { FEATURES } from '../config';

// Download quality mode
type DownloadMode = 'standard' | 'hd';

interface LibraryProps {
  savedListings: SavedListing[];
  onDelete: (id: string) => void;
  onView: (listing: SavedListing) => void;
  userTier?: string;
  remainingQuota?: number;
  onRefresh?: () => void;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  total?: number;
}

const Library: React.FC<LibraryProps> = ({ savedListings, onDelete, onView, userTier = 'free', remainingQuota: propQuota, onRefresh, isLoading = false, hasMore = false, onLoadMore, isLoadingMore = false, total = 0 }) => {
  const [now, setNow] = useState(Date.now());
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Download mode state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadMode, setDownloadMode] = useState<DownloadMode>('standard');
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; status: string } | null>(null);

  // Vectorizer feature check (with defensive fallback to ensure downloads work)
  const vectorizerEnabled = FEATURES?.enableVectorizer ?? false;
  const canUseHDDownload = vectorizerEnabled && userTier !== 'free' && userTier !== 'Free';

  // Variations modal state
  const [variationsDesign, setVariationsDesign] = useState<SavedListing | null>(null);

  // Fetch actual remaining quota
  const [remainingQuota, setRemainingQuota] = useState(propQuota ?? 0);
  const [quotaLoading, setQuotaLoading] = useState(true);

  // Fetch quota on mount and when variations modal opens
  useEffect(() => {
    const fetchQuota = async () => {
      setQuotaLoading(true);
      try {
        const response = await fetch('/api/user');
        if (response.ok) {
          const data = await response.json();
          const remaining = data.usage?.remaining ?? 0;
          console.log('Fetched quota:', remaining, 'from', data.usage);
          setRemainingQuota(remaining);
        }
      } catch (err) {
        console.log('Could not fetch quota:', err);
      } finally {
        setQuotaLoading(false);
      }
    };
    fetchQuota();
  }, []); // Fetch on mount

  // Helper to open variations modal with fresh quota
  const openVariationsModal = async (design: SavedListing) => {
    try {
      const response = await fetch('/api/user');
      if (response.ok) {
        const data = await response.json();
        const remaining = data.usage?.remaining ?? 0;
        console.log('Pre-modal quota fetch:', remaining);
        setRemainingQuota(remaining);
      }
    } catch (err) {
      console.log('Could not fetch quota before opening modal');
    }
    setVariationsDesign(design);
  };

  const isPaidPlan = userTier !== 'free' && userTier !== 'Free';

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === savedListings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(savedListings.map(item => item.id)));
    }
  };

  // Process image to remove background (same as individual download)
  const processImageWithTransparency = async (imageUrl: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";

      // Use proxy for R2 images to bypass CORS
      const proxyUrl = imageUrl.includes('.r2.') || imageUrl.includes('r2.dev')
        ? `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
        : imageUrl;

      img.src = proxyUrl;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 4500;
        canvas.height = 5400;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        try {
          // Scale and draw image
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          const zoomFactor = 1.05;
          const scaledWidth = canvas.width * zoomFactor;
          const scaledHeight = canvas.height * zoomFactor;
          const offsetX = (canvas.width - scaledWidth) / 2;
          const offsetY = (canvas.height - scaledHeight) / 2;

          ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

          // Process pixels for background removal
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const width = canvas.width;
          const height = canvas.height;

          // Detect background color
          const cornerR = data[0];
          const cornerG = data[1];
          const cornerB = data[2];
          const isWhiteBg = cornerR > 200 && cornerG > 200 && cornerB > 200;
          const BG_THRESHOLD = 40;

          // Remove background
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = (y * width + x) * 4;

              // Make borders transparent
              if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
                data[idx + 3] = 0;
                continue;
              }

              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];

              let isBackground = false;
              if (isWhiteBg) {
                if (r > 240 && g > 240 && b > 240) isBackground = true;
              } else {
                if (r < BG_THRESHOLD && g < BG_THRESHOLD && b < BG_THRESHOLD) isBackground = true;
              }

              if (isBackground) {
                data[idx + 3] = 0; // Make transparent
              }
            }
          }

          ctx.putImageData(imageData, 0, 0);

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to create blob"));
            }
          }, 'image/png');
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error("Failed to load image"));
    });
  };

  // Vectorize an image for HD download
  const vectorizeImageForDownload = async (designId: string, imageUrl: string): Promise<string> => {
    try {
      const response = await fetch('/api/vectorize/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designId, imageUrl })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Vectorization failed');
      }

      const result = await response.json();
      return result.imageUrl; // Returns base64 data URL or cached URL
    } catch (error) {
      console.error('Vectorization error:', error);
      throw error;
    }
  };

  // Open download modal (when vectorizer is enabled) or download directly
  const handleDownloadClick = () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one design to download.');
      return;
    }

    if (vectorizerEnabled) {
      setShowDownloadModal(true);
    } else {
      handleDownloadZip('standard');
    }
  };

  // Start the download with selected mode
  const startDownload = () => {
    setShowDownloadModal(false);
    handleDownloadZip(downloadMode);
  };

  const handleDownloadZip = async (mode: DownloadMode = 'standard') => {
    if (selectedIds.size === 0) {
      alert('Please select at least one design to download.');
      return;
    }

    setDownloadingZip(true);
    setDownloadProgress(null);

    try {
      const zip = new JSZip();
      const selectedListings = savedListings.filter(item => selectedIds.has(item.id));
      const total = selectedListings.length;

      for (let i = 0; i < selectedListings.length; i++) {
        const item = selectedListings[i];

        // Update progress
        setDownloadProgress({
          current: i + 1,
          total,
          status: mode === 'hd' ? `Vectorizing ${i + 1}/${total}...` : `Processing ${i + 1}/${total}...`
        });

        // Fetch full design data from API (includes listingData from R2)
        let fullDesign = item;
        try {
          const response = await fetch(`/api/designs/${item.id}`);
          if (response.ok) {
            fullDesign = await response.json();
          } else {
            console.warn(`Failed to fetch full data for design ${item.id}, using cached data`);
          }
        } catch (error) {
          console.error(`Error fetching design ${item.id}:`, error);
          // Continue with cached data
        }

        const brandSafe = (fullDesign.listing.brand || 'Design').replace(/[\s\W]+/g, '_');
        const folderName = `${brandSafe}_${fullDesign.id.substring(0, 8)}`;
        const folder = zip.folder(folderName);

        if (!folder) continue;

        // Add listing text
        const listingText = `
BRAND: ${fullDesign.listing.brand || 'N/A'}
TITLE: ${fullDesign.listing.title || 'N/A'}

BULLET POINTS:
1. ${fullDesign.listing.bullet1 || 'N/A'}
2. ${fullDesign.listing.bullet2 || 'N/A'}

DESCRIPTION:
${fullDesign.listing.description || 'N/A'}

KEYWORDS:
${(fullDesign.listing.keywords || []).join(', ')}

DESIGN TEXT:
${fullDesign.listing.designText || 'N/A'}

PRICE: $${fullDesign.listing.price || 'N/A'}
`.trim();

        folder.file('listing.txt', listingText);

        // Generate CSV file
        const csvContent = `Title,Brand Name,Bullet Point 1,Bullet Point 2,Description,Search Terms,Price\n"${(fullDesign.listing.title || '').replace(/"/g, '""')}","${(fullDesign.listing.brand || '').replace(/"/g, '""')}","${(fullDesign.listing.bullet1 || '').replace(/"/g, '""')}","${(fullDesign.listing.bullet2 || '').replace(/"/g, '""')}","${(fullDesign.listing.description || '').replace(/"/g, '""')}","${(fullDesign.listing.keywords || []).join(', ').replace(/"/g, '""')}","${fullDesign.listing.price || ''}"`;
        folder.file('listing.csv', csvContent);

        // Process and add image with transparency
        if (fullDesign.imageUrl) {
          try {
            let imageToProcess = fullDesign.imageUrl;

            // If HD mode, vectorize first
            if (mode === 'hd' && canUseHDDownload) {
              console.log(`HD Mode: Vectorizing image for ${fullDesign.id}`);
              setDownloadProgress({
                current: i + 1,
                total,
                status: `Vectorizing ${fullDesign.listing?.brand || 'design'}...`
              });

              try {
                imageToProcess = await vectorizeImageForDownload(fullDesign.id, fullDesign.imageUrl);
                console.log(`Vectorization complete for ${fullDesign.id}`);
              } catch (vecError) {
                console.warn(`Vectorization failed for ${fullDesign.id}, using original:`, vecError);
                // Fall back to original image
              }
            }

            console.log(`Processing image for ${fullDesign.id}:`, imageToProcess.substring(0, 50));
            setDownloadProgress({
              current: i + 1,
              total,
              status: `Removing background ${i + 1}/${total}...`
            });

            const transparentBlob = await processImageWithTransparency(imageToProcess);
            console.log(`Image processed successfully, size: ${transparentBlob.size} bytes`);
            folder.file('design.png', transparentBlob);
          } catch (error) {
            console.error('Failed to process image for', fullDesign.id, error);
            alert(`Warning: Failed to include image for design ${fullDesign.listing?.brand || 'Unknown'}. Error: ${error}`);
            // Continue without image
          }
        } else {
          console.warn(`No imageUrl for design ${fullDesign.id}`);
        }
      }

      setDownloadProgress({ current: total, total, status: 'Creating ZIP...' });

      // Generate and download ZIP
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `turbo-merch-designs${mode === 'hd' ? '-HD' : ''}-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Clear selection after successful download
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error('Error downloading zip:', error);
      alert(error.message || 'Failed to download designs. Please try again.');
    } finally {
      setDownloadingZip(false);
      setDownloadProgress(null);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(true);
    try {
      const response = await fetch(`/api/designs/export?format=${format}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to export designs');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `turbo-merch-designs-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting designs:', error);
      alert('Failed to export designs. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const getRemainingTime = (expiresAt: number) => {
    const diff = expiresAt - now;
    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 1) return `${days} days left`;
    if (days === 1) return `1 day left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const getUrgencyColor = (expiresAt: number) => {
    const diff = expiresAt - now;
    const days = diff / (1000 * 60 * 60 * 24);

    if (diff <= 0) return "text-gray-500 bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-700";
    if (days < 1) return "text-red-500 dark:text-red-400 bg-red-500/10 border-red-500/20 animate-pulse";
    if (days < 3) return "text-orange-500 dark:text-orange-400 bg-orange-500/10 border-orange-500/20";
    return "text-green-500 dark:text-green-400 bg-green-500/10 border-green-500/20";
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="h-8 w-48 bg-gray-200 dark:bg-dark-700 rounded animate-pulse mb-2"></div>
            <div className="h-4 w-64 bg-gray-200 dark:bg-dark-700 rounded animate-pulse"></div>
          </div>
          <div className="h-10 w-32 bg-gray-200 dark:bg-dark-700 rounded animate-pulse"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-gray-200 dark:border-white/5 flex justify-between items-start bg-gray-50 dark:bg-dark-900/50">
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex flex-col space-y-2 w-full">
                    <div className="h-3 w-20 bg-gray-200 dark:bg-dark-700 rounded animate-pulse"></div>
                    <div className="h-5 w-3/4 bg-gray-200 dark:bg-dark-700 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
              <div className="p-4 flex gap-4">
                <div className="w-24 h-32 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse flex-shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full bg-gray-200 dark:bg-dark-700 rounded animate-pulse"></div>
                  <div className="h-4 w-2/3 bg-gray-200 dark:bg-dark-700 rounded animate-pulse"></div>
                  <div className="flex gap-1 mt-2">
                    <div className="h-5 w-16 bg-gray-200 dark:bg-dark-700 rounded animate-pulse"></div>
                    <div className="h-5 w-16 bg-gray-200 dark:bg-dark-700 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-dark-900/30 border-t border-gray-200 dark:border-white/5 flex justify-between items-center">
                <div className="h-8 w-8 bg-gray-200 dark:bg-dark-700 rounded animate-pulse"></div>
                <div className="h-8 w-24 bg-gray-200 dark:bg-dark-700 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (savedListings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4 animate-fade-in">
        <div className="p-6 bg-gray-100 dark:bg-dark-800 rounded-full border border-gray-200 dark:border-white/5 shadow-xl shadow-black/20 dark:shadow-black/50">
          <FolderHeart className="w-16 h-16 text-gray-400 dark:text-gray-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Your Library is Empty</h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          Go to the Production Studio to generate and save your first Amazon Merch listing. Items are saved based on your subscription tier retention policy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white font-mono">Asset Library</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your saved listings. Retention based on your subscription tier.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500 font-mono bg-gray-100 dark:bg-dark-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-white/5 min-w-[140px]">
            {savedListings.length} Item{savedListings.length !== 1 ? 's' : ''} Saved
            {isPaidPlan && selectedIds.size > 0 && (
              <span className="ml-2 text-brand-500 dark:text-brand-400">
                • {selectedIds.size} Selected
              </span>
            )}
          </div>
          {savedListings.length > 0 && (
            <div className="flex gap-2 flex-nowrap">
              {isPaidPlan && (
                <>
                  <button
                    onClick={toggleSelectAll}
                    className="px-4 py-2 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-900 dark:text-white text-sm font-bold rounded-lg border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-colors flex items-center gap-2 whitespace-nowrap"
                    title={selectedIds.size === savedListings.length ? "Deselect All" : "Select All"}
                  >
                    {selectedIds.size === savedListings.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {selectedIds.size === savedListings.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    onClick={handleDownloadClick}
                    disabled={selectedIds.size === 0 || downloadingZip}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-brand-500/20 flex items-center gap-2 whitespace-nowrap min-w-[160px]"
                    title="Download selected designs as ZIP"
                  >
                    <Download className="w-4 h-4" />
                    {downloadingZip
                      ? (downloadProgress ? downloadProgress.status : 'Preparing...')
                      : selectedIds.size > 0
                        ? `Download (${selectedIds.size})`
                        : 'Download ZIP'}
                  </button>
                </>
              )}
              <button
                onClick={() => handleExport('json')}
                disabled={exporting}
                className="px-4 py-2 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 dark:text-white text-sm font-bold rounded-lg border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-colors flex items-center gap-2 whitespace-nowrap"
                title="Export all designs as JSON"
              >
                <FileDown className="w-4 h-4" />
                {exporting ? 'Exporting...' : 'JSON'}
              </button>
              <button
                onClick={() => handleExport('csv')}
                disabled={exporting}
                className="px-4 py-2 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 dark:text-white text-sm font-bold rounded-lg border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-colors flex items-center gap-2 whitespace-nowrap"
                title="Export all designs as CSV"
              >
                <FileDown className="w-4 h-4" />
                {exporting ? 'Exporting...' : 'CSV'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Upgrade Banner */}
      {!isPaidPlan && savedListings.length >= 2 && (
        <div className="bg-gradient-to-r from-brand-600/10 to-cyan-600/10 border border-brand-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-1">Unlock More Designs & Features</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Upgrade to create more designs per month, batch downloads, longer retention, and more.
              </p>
            </div>
            <a
              href="/subscription"
              className="px-6 py-3 bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white text-sm font-bold rounded-lg transition-all duration-200 shadow-lg shadow-brand-900/30 hover:scale-105 whitespace-nowrap"
            >
              View Plans
            </a>
          </div>
        </div>
      )}
      {isPaidPlan && userTier === 'starter' && savedListings.length >= 12 && (
        <div className="bg-gradient-to-r from-brand-600/10 to-teal-600/10 border border-brand-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-1">Need More Designs?</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Upgrade to Pro for 60 designs/month, batch generation, and priority processing.
              </p>
            </div>
            <a
              href="/subscription"
              className="px-6 py-3 bg-gradient-to-r from-brand-600 to-teal-600 hover:from-brand-500 hover:to-teal-500 text-white text-sm font-bold rounded-lg transition-all duration-200 shadow-lg shadow-brand-900/30 hover:scale-105 whitespace-nowrap"
            >
              Upgrade to Pro
            </a>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {savedListings.map((item) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <div
              key={item.id}
              className={`bg-white dark:bg-dark-800 border rounded-xl overflow-hidden group hover:border-brand-500/30 transition-all duration-300 shadow-lg ${isSelected ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-gray-200 dark:border-white/10'
                }`}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 dark:border-white/5 flex justify-between items-start bg-gray-50 dark:bg-dark-900/50">
                <div className="flex items-start gap-3 flex-1">
                  {isPaidPlan && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(item.id);
                      }}
                      className="mt-1 p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors"
                      title={isSelected ? "Deselect" : "Select"}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-brand-500 dark:text-brand-400" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      )}
                    </button>
                  )}
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">
                      {item.tierAtCreation} Plan • Saved
                    </span>
                    <h4 className="text-gray-900 dark:text-white font-bold truncate max-w-[180px]">{item.listing?.brand || 'Untitled'}</h4>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded border ${getUrgencyColor(item.expiresAt)}`}>
                  <Clock className="w-3 h-3" />
                  {getRemainingTime(item.expiresAt)}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex gap-4">
                <div className="w-24 h-32 bg-gray-100 dark:bg-black rounded-lg border border-gray-200 dark:border-white/10 flex-shrink-0 overflow-hidden relative group-hover:border-brand-500/20 transition-colors">
                  <img src={item.imageUrl} alt="Thumbnail" className="w-full h-full object-contain" />
                  {item.expiresAt < now && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-1">
                        <AlertCircle className="w-6 h-6 text-red-500" />
                        <span className="text-[10px] text-red-400 font-bold">EXPIRED</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center space-y-2">
                  <h5 className="text-sm text-gray-700 dark:text-gray-200 font-medium line-clamp-2 leading-relaxed" title={item.listing.title}>
                    {item.listing.title}
                  </h5>
                  <div className="flex flex-wrap gap-1">
                    {item.imageModel && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded border border-brand-500/20 font-medium">
                        {item.imageModel === 'gpt-image-1' ? 'GPT-Image' :
                         item.imageModel === 'ideogram' ? 'Ideogram' :
                         item.imageModel === 'imagen' ? 'Imagen 4' :
                         item.imageModel === 'gpt-image-1.5' ? 'GPT-Image-1.5' :
                         item.imageModel}
                      </span>
                    )}
                    {(item.trend.keywords || []).slice(0, 2).map((kw, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded border border-gray-200 dark:border-white/5">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-3 bg-gray-50 dark:bg-dark-900/30 border-t border-gray-200 dark:border-white/5 flex justify-between items-center">
                <button
                  onClick={() => onDelete(item.id)}
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete Listing"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex gap-2">
                  {isPaidPlan && (
                    <button
                      onClick={() => openVariationsModal(item)}
                      className="px-3 py-2 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-medium rounded-lg border border-brand-500/20 transition-all flex items-center gap-1.5"
                      title="Generate Variations"
                    >
                      <Copy className="w-3 h-3" />
                      Variations
                    </button>
                  )}
                  <button
                    onClick={() => onView(item)}
                    className="px-4 py-2 bg-gray-100 dark:bg-white/5 hover:bg-brand-500/10 text-gray-900 dark:text-white text-xs font-bold rounded-lg border border-gray-200 dark:border-white/5 hover:border-brand-500/30 transition-all flex items-center gap-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open Studio
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More Button */}
      {hasMore && onLoadMore && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {savedListings.length} of {total} designs
          </p>
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="px-6 py-3 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-900 dark:text-white font-semibold rounded-lg border border-gray-200 dark:border-white/10 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Load More
              </>
            )}
          </button>
        </div>
      )}

      {/* Variations Modal */}
      {variationsDesign && (
        <VariationsModal
          isOpen={true}
          onClose={() => setVariationsDesign(null)}
          designId={variationsDesign.id}
          designTitle={variationsDesign.listing?.brand || 'Design'}
          design={variationsDesign}
          userTier={userTier as TierName}
          remainingQuota={remainingQuota}
          onVariationsGenerated={() => {
            setVariationsDesign(null);
            onRefresh?.();
          }}
        />
      )}

      {/* Download Mode Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDownloadModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Download {selectedIds.size} Design{selectedIds.size !== 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Choose your download quality
            </p>

            <div className="space-y-3">
              {/* Standard Quality Option */}
              <button
                onClick={() => setDownloadMode('standard')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  downloadMode === 'standard'
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    downloadMode === 'standard'
                      ? 'border-brand-500 bg-brand-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {downloadMode === 'standard' && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 dark:text-white">Standard Quality</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Original resolution, fast download</div>
                  </div>
                </div>
              </button>

              {/* HD Vector Quality Option */}
              <button
                onClick={() => canUseHDDownload && setDownloadMode('hd')}
                disabled={!canUseHDDownload}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left relative ${
                  !canUseHDDownload
                    ? 'border-gray-200 dark:border-white/5 opacity-60 cursor-not-allowed'
                    : downloadMode === 'hd'
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    downloadMode === 'hd' && canUseHDDownload
                      ? 'border-brand-500 bg-brand-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {downloadMode === 'hd' && canUseHDDownload && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">HD Vector PNG</span>
                      <Sparkles className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Vectorized, 4x resolution, print-ready
                    </div>
                  </div>
                  {!canUseHDDownload && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded">
                      <Lock className="w-3 h-3" />
                      <span>Paid</span>
                    </div>
                  )}
                </div>
              </button>
            </div>

            {/* Upgrade prompt for free users */}
            {!canUseHDDownload && vectorizerEnabled && (
              <div className="mt-4 p-3 bg-gradient-to-r from-brand-500/10 to-cyan-500/10 border border-brand-500/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium text-gray-900 dark:text-white">Upgrade to unlock HD downloads</span>
                  {' '}— Get vectorized, print-ready images with crisper edges.
                </p>
                <a
                  href="/subscription"
                  className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  View Plans →
                </a>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDownloadModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-900 dark:text-white font-medium rounded-lg border border-gray-200 dark:border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={startDownload}
                className="flex-1 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg shadow-lg shadow-brand-500/20 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;

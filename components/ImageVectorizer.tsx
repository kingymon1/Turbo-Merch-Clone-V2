'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Wand2, Upload, Download, AlertTriangle, Loader2, Check, X, RefreshCw, Image as ImageIcon, FileType } from 'lucide-react';

type OutputFormat = 'svg' | 'png' | 'pdf' | 'eps' | 'dxf';

interface UserUsage {
  used: number;
  allowance: number;
  remaining: number;
}

interface ImageVectorizerProps {
  onNavigateToSubscription?: () => void;
}

const OUTPUT_FORMATS: { value: OutputFormat; label: string; description: string }[] = [
  { value: 'svg', label: 'SVG', description: 'Scalable vector' },
  { value: 'png', label: 'PNG', description: 'High-res image' },
  { value: 'pdf', label: 'PDF', description: 'Print ready' },
  { value: 'eps', label: 'EPS', description: 'Adobe compatible' },
  { value: 'dxf', label: 'DXF', description: 'CAD format' },
];

const ImageVectorizer: React.FC<ImageVectorizerProps> = ({ onNavigateToSubscription }) => {
  // Upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings state
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('png');
  const [transparentBackground, setTransparentBackground] = useState(false);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultFormat, setResultFormat] = useState<OutputFormat | null>(null);

  // Credit/usage state
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Fetch user usage on mount
  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const response = await fetch('/api/user');
      if (response.ok) {
        const data = await response.json();
        setUsage(data.usage);
      }
    } catch (err) {
      console.error('Failed to fetch usage:', err);
    }
  };

  // File handling
  const handleFileSelect = useCallback((file: File) => {
    setError(null);
    setResultImage(null);

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Unsupported file type. Please use PNG, JPG, WEBP, BMP, or GIF.');
      return;
    }

    // Validate file size (30MB max)
    if (file.size > 30 * 1024 * 1024) {
      setError('File size exceeds 30MB limit.');
      return;
    }

    // Read file as data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
      setUploadedFileName(file.name);
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  // Vectorization
  const handleVectorize = async () => {
    if (!uploadedImage) return;

    // Check if user has credits
    if (usage && usage.remaining <= 0) {
      setShowConfirmModal(true);
      return;
    }

    // Show confirmation modal
    setShowConfirmModal(true);
  };

  const confirmVectorize = async () => {
    setShowConfirmModal(false);
    setIsProcessing(true);
    setError(null);

    try {
      // First, track the usage
      const trackResponse = await fetch('/api/designs/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designCount: 1 }),
      });

      if (!trackResponse.ok) {
        const trackError = await trackResponse.json();
        if (trackResponse.status === 403) {
          setError(`Credit limit reached: ${trackError.error}`);
          setIsProcessing(false);
          return;
        }
      }

      // Call vectorize API
      const response = await fetch('/api/vectorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: uploadedImage,
          outputFormat: outputFormat,
          mode: 'production',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Vectorization failed');
      }

      const data = await response.json();

      // Auto-download the result immediately
      const link = document.createElement('a');
      link.href = data.imageUrl;
      const originalName = uploadedFileName?.replace(/\.[^.]+$/, '') || 'vectorized';
      link.download = `${originalName}_vectorized.${outputFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Set result state to show success view
      setResultImage(data.imageUrl);
      setResultFormat(outputFormat);

      // Refresh usage after successful vectorization
      fetchUsage();
    } catch (err) {
      console.error('Vectorization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to vectorize image');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download result
  const handleDownload = () => {
    if (!resultImage || !resultFormat) return;

    const link = document.createElement('a');
    link.href = resultImage;

    // Generate filename
    const originalName = uploadedFileName?.replace(/\.[^.]+$/, '') || 'vectorized';
    link.download = `${originalName}_vectorized.${resultFormat}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset to start over
  const handleReset = () => {
    setUploadedImage(null);
    setUploadedFileName(null);
    setResultImage(null);
    setResultFormat(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-brand-500 to-cyan-500 rounded-xl">
            <Wand2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Image Vectorizer</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Convert raster images to crisp vector graphics</p>
          </div>
        </div>

        {/* Credit Warning Banner */}
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Each vectorization uses 1 credit
              </p>
              {usage && (
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                  You have {usage.remaining} of {usage.allowance} credits remaining this month
                </p>
              )}
            </div>
            {usage && usage.remaining <= 0 && onNavigateToSubscription && (
              <button
                onClick={onNavigateToSubscription}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Upgrade
              </button>
            )}
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
          {/* Upload Section */}
          {!resultImage && (
            <div className="p-6">
              {/* File Upload Zone */}
              <div
                onClick={!uploadedImage ? openFilePicker : undefined}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  relative border-2 border-dashed rounded-xl transition-all duration-200
                  ${isDragging
                    ? 'border-brand-500 bg-brand-500/5'
                    : uploadedImage
                      ? 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-dark-900'
                      : 'border-gray-300 dark:border-white/20 hover:border-brand-500 hover:bg-gray-50 dark:hover:bg-dark-900 cursor-pointer'
                  }
                `}
              >
                {!uploadedImage ? (
                  <div className="flex flex-col items-center justify-center py-12 px-6">
                    <div className="p-4 bg-gray-100 dark:bg-dark-700 rounded-full mb-4">
                      <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    </div>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Drag & drop your image here
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      or click to browse
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      PNG, JPG, WEBP, BMP, GIF - Max 30MB
                    </p>
                  </div>
                ) : (
                  <div className="p-6">
                    <div className="flex items-start gap-6">
                      {/* Image Preview */}
                      <div className="relative flex-shrink-0">
                        <img
                          src={uploadedImage}
                          alt="Uploaded preview"
                          className="w-48 h-48 object-contain rounded-lg bg-gray-100 dark:bg-dark-700"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReset();
                          }}
                          className="absolute -top-2 -right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <ImageIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {uploadedFileName}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                          Ready to vectorize
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openFilePicker();
                          }}
                          className="text-sm text-brand-500 hover:text-brand-600 font-medium"
                        >
                          Choose different image
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/bmp,image/gif"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              {/* Error Display */}
              {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                </div>
              )}

              {/* Settings Section */}
              {uploadedImage && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/10">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">
                    Settings
                  </h3>

                  {/* Output Format */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Output Format
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {OUTPUT_FORMATS.map((format) => (
                        <button
                          key={format.value}
                          onClick={() => setOutputFormat(format.value)}
                          className={`
                            px-4 py-2 rounded-lg font-medium text-sm transition-all
                            ${outputFormat === format.value
                              ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                              : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                            }
                          `}
                        >
                          <span className="flex items-center gap-2">
                            <FileType className="w-4 h-4" />
                            {format.label}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {OUTPUT_FORMATS.find(f => f.value === outputFormat)?.description}
                    </p>
                  </div>

                  {/* Transparent Background - Only show for formats that support it */}
                  {(outputFormat === 'png' || outputFormat === 'svg') && (
                    <div className="mb-6">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div
                          className={`
                            w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                            ${transparentBackground
                              ? 'bg-brand-500 border-brand-500'
                              : 'border-gray-300 dark:border-white/20 group-hover:border-brand-500'
                            }
                          `}
                          onClick={() => setTransparentBackground(!transparentBackground)}
                        >
                          {transparentBackground && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Transparent Background
                        </span>
                      </label>
                      <p className="mt-1 ml-8 text-xs text-gray-500 dark:text-gray-400">
                        Remove the background from your vectorized image
                      </p>
                    </div>
                  )}

                  {/* Vectorize Button */}
                  <button
                    onClick={handleVectorize}
                    disabled={isProcessing || !uploadedImage}
                    className={`
                      w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3
                      ${isProcessing
                        ? 'bg-gray-300 dark:bg-dark-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30'
                      }
                    `}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Vectorizing...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5" />
                        Vectorize Image (1 Credit)
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Result Section */}
          {resultImage && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Vectorization Complete!
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Your {resultFormat?.toUpperCase()} file has been downloaded.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <button
                  onClick={handleDownload}
                  className="flex-1 py-3 px-6 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download Again
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Vectorize Another
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 shadow-2xl max-w-sm mx-4 text-center">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 bg-brand-500/20 rounded-full animate-ping" />
                <div className="relative bg-brand-500 rounded-full w-full h-full flex items-center justify-center">
                  <Wand2 className="w-8 h-8 text-white animate-pulse" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Vectorizing Your Image
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This may take up to a minute for complex images...
              </p>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 shadow-2xl max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/10 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Confirm Vectorization
                </h3>
              </div>

              <p className="text-gray-600 dark:text-gray-300 mb-4">
                This will use <span className="font-bold text-brand-500">1 credit</span> from your account.
              </p>

              {usage && (
                <div className="p-3 bg-gray-100 dark:bg-dark-700 rounded-lg mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Current credits:</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      {usage.remaining} / {usage.allowance}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500 dark:text-gray-400">After vectorization:</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      {Math.max(0, usage.remaining - 1)} / {usage.allowance}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-3 px-4 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmVectorize}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-brand-500/25"
                >
                  Vectorize
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageVectorizer;

'use client';

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import DashboardContent from './components/DashboardContent';
import OverageDialog from './components/OverageDialog';
import SuccessModal from './components/SuccessModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppView, TrendData, MerchPackage, SavedListing } from './types';
import { StorageService } from './services/storage';
import { Shirt, Menu } from 'lucide-react';
import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { SUBSCRIPTION_CONFIG, STORAGE_CONFIG } from './config';

// Code-split heavy components for better performance
const TrendScanner = lazy(() => import('./components/TrendScanner'));
const TrendLab = lazy(() => import('./components/TrendLab'));
const ImageVectorizer = lazy(() => import('./components/ImageVectorizer'));
const ListingGenerator = lazy(() => import('./components/ListingGenerator'));
const PricingPlans = lazy(() => import('./components/PricingPlans'));
const Library = lazy(() => import('./components/Library'));
const IdeasVault = lazy(() => import('./components/IdeasVault'));
const LegalDocs = lazy(() => import('./components/LegalDocs'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const MerchGenerator = lazy(() => import('./components/MerchGenerator'));
const SimpleAutopilot = lazy(() => import('./components/SimpleAutopilot'));

// Loading component for Suspense fallback
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-brand-500"></div>
  </div>
);

const Dashboard: React.FC<{ onAction: (view: AppView, autoStart?: boolean) => void; refreshKey?: number }> = ({ onAction, refreshKey }) => {
  const { user } = useUser();
  const firstName = user?.firstName || 'Creator';

  return <DashboardContent userName={firstName} onAction={onAction} refreshKey={refreshKey} />;
};

interface MainAppLayoutProps {
  isAnonymous?: boolean;
}

const MainAppLayout: React.FC<MainAppLayoutProps> = ({ isAnonymous }) => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [previousView, setPreviousView] = useState<AppView>(AppView.DASHBOARD);
  const [selectedTrend, setSelectedTrend] = useState<TrendData | null>(null);
  const [autoRun, setAutoRun] = useState(false);
  const [initialAutoStart, setInitialAutoStart] = useState(false);
  const [preGenData, setPreGenData] = useState<MerchPackage | undefined>(undefined);
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [libraryHasMore, setLibraryHasMore] = useState(false);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [userTier, setUserTier] = useState<string>(SUBSCRIPTION_CONFIG.defaultTier);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [usageRefreshKey, setUsageRefreshKey] = useState(0);

  // Helper to navigate with scroll to top and track previous view
  const navigateTo = (view: AppView) => {
    setPreviousView(currentView);
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [overageDialogOpen, setOverageDialogOpen] = useState(false);
  const [overageDialogData, setOverageDialogData] = useState<{
    charge: number;
    count: number;
    pendingAction: () => void;
    isHardCap?: boolean;
  } | null>(null);
  const designSlotReservedRef = useRef(false);

  // Success modal state for subscription upgrades
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    title: string;
    message: string;
    tier?: string;
    features?: string[];
  } | null>(null);

  // Debug logging for preGenData changes
  useEffect(() => {
    console.log('[App] preGenData changed to:', preGenData ? `design ${(preGenData as any).id || 'new'}` : 'undefined');
  }, [preGenData]);

  // Handle Stripe checkout success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const canceled = params.get('canceled');

    if (sessionId) {
      console.log('[Stripe] Checkout successful, session:', sessionId);

      // Sync subscription directly from Stripe to ensure tier is updated
      const syncAndShowSuccess = async () => {
        try {
          // Call sync endpoint with the session ID
          const syncResponse = await fetch('/api/stripe/sync-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });

          const syncData = await syncResponse.json();
          console.log('[Stripe] Sync result:', syncData);

          if (syncData.success && syncData.user) {
            const newTier = syncData.user.subscriptionTier || 'starter';
            setUserTier(newTier);
            setUsageRefreshKey(prev => prev + 1);

            // Get tier-specific features for the modal
            const tierFeatures: Record<string, string[]> = {
              starter: ['15 designs per month', '30-day design history', 'Standard support'],
              pro: ['50 designs per month', '90-day design history', 'Priority support', 'Advanced analytics'],
              business: ['150 designs per month', '1-year design history', 'Dedicated support', 'Team collaboration'],
              enterprise: ['Unlimited designs', 'Unlimited history', 'Custom integrations', '24/7 premium support'],
            };

            // Show styled success modal
            setSuccessModalData({
              title: 'Welcome to TurboMerch!',
              message: `Your ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} plan is now active. Start creating amazing designs with your upgraded features.`,
              tier: newTier,
              features: tierFeatures[newTier] || tierFeatures.starter,
            });
            setSuccessModalOpen(true);
          } else {
            // Fallback: try regular user fetch
            const userResponse = await fetch('/api/user');
            if (userResponse.ok) {
              const userData = await userResponse.json();
              const tier = userData.user?.subscriptionTier || SUBSCRIPTION_CONFIG.defaultTier;
              setUserTier(tier);
              setUsageRefreshKey(prev => prev + 1);

              setSuccessModalData({
                title: 'Subscription Activated!',
                message: 'Your subscription is now active. Enjoy your new features!',
                tier: tier,
              });
              setSuccessModalOpen(true);
            }
          }
        } catch (err) {
          console.error('[Stripe] Error syncing subscription:', err);
          // Show a basic success modal even if sync fails
          setSuccessModalData({
            title: 'Payment Successful!',
            message: 'Your payment was processed. Your new features will be available shortly.',
          });
          setSuccessModalOpen(true);
        }
      };

      syncAndShowSuccess();

      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (canceled) {
      console.log('[Stripe] Checkout canceled');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  useEffect(() => {
    if (!isAnonymous) {
      // Load designs from database for authenticated users
      fetchSavedDesigns();
      fetchUserTier();

      // Also migrate any localStorage designs (in case user was anonymous before)
      migrateLocalStorageDesigns();
    } else {
      // Load from localStorage for anonymous users
      const saved = localStorage.getItem(STORAGE_CONFIG.keys.library);
      if (saved) {
        try {
          setSavedListings(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse saved listings:', e);
        }
      }
      setIsLibraryLoading(false);
    }
  }, [isAnonymous]);

  const fetchUserTier = async () => {
    try {
      const response = await fetch('/api/user');
      if (response.ok) {
        const data = await response.json();
        setUserTier(data.user.subscriptionTier || SUBSCRIPTION_CONFIG.defaultTier);
      }
    } catch (error) {
      console.error('Error fetching user tier:', error);
    }
  };

  const migrateLocalStorageDesigns = async () => {
    const saved = localStorage.getItem(STORAGE_CONFIG.keys.library);
    if (!saved) return;

    try {
      const localDesigns = JSON.parse(saved);
      if (!Array.isArray(localDesigns) || localDesigns.length === 0) return;

      console.log(`Migrating ${localDesigns.length} designs from localStorage to database...`);

      // Save each design to database
      let successCount = 0;
      for (const design of localDesigns) {
        try {
          const response = await fetch('/api/designs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trend: design.trend,
              listing: design.listing,
              imageUrl: design.imageUrl,
              tierAtCreation: design.tierAtCreation || 'free',
            }),
          });

          if (response.ok) {
            successCount++;
          }
        } catch (error) {
          console.error('Failed to migrate design:', error);
        }
      }

      // Clear localStorage after migration
      localStorage.removeItem(STORAGE_CONFIG.keys.library);
      console.log(`Migration complete: ${successCount}/${localDesigns.length} designs migrated`);
    } catch (error) {
      console.error('Error migrating designs:', error);
    }
  };

  const INITIAL_LIBRARY_LOAD = 9; // Load 9 designs initially for fast display

  const fetchSavedDesigns = async () => {
    setIsLibraryLoading(true);
    try {
      const response = await fetch(`/api/designs?limit=${INITIAL_LIBRARY_LOAD}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`[Library] Fetched ${data.designs?.length || 0} of ${data.total || 0} designs from database`);
        setSavedListings(data.designs || []);
        setLibraryHasMore(data.hasMore || false);
        setLibraryTotal(data.total || 0);
      } else {
        console.error('[Library] Failed to fetch designs:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[Library] Error fetching saved designs:', error);
    } finally {
      setIsLibraryLoading(false);
    }
  };

  const loadMoreDesigns = async () => {
    if (isLoadingMore || !libraryHasMore) return;

    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/designs?limit=${INITIAL_LIBRARY_LOAD}&offset=${savedListings.length}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`[Library] Loaded ${data.designs?.length || 0} more designs`);
        setSavedListings(prev => [...prev, ...(data.designs || [])]);
        setLibraryHasMore(data.hasMore || false);
      }
    } catch (error) {
      console.error('[Library] Error loading more designs:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const updateStorage = (newListings: SavedListing[]) => {
    setSavedListings(newListings);
    if (isAnonymous) {
      // Only use localStorage for anonymous users
      localStorage.setItem(STORAGE_CONFIG.keys.library, JSON.stringify(newListings));
    }
  };

  const handleNavigate = (view: AppView) => {
    setInitialAutoStart(false);
    navigateTo(view);
  };

  const handleDashboardAction = async (view: AppView, autoStart: boolean = false) => {
    // If starting auto-creation, check quota first to avoid wasting API costs
    if (autoStart && !isAnonymous) {
      try {
        const checkResponse = await fetch('/api/designs/check-quota', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ designCount: 1 }),
        });

        if (!checkResponse.ok) {
          const error = await checkResponse.json();
          if (checkResponse.status === 403) {
            // Hard cap reached - show styled dialog with only upgrade options
            setOverageDialogData({
              charge: 0, // Not used in hard cap mode
              count: error.usage?.overage || 0,
              pendingAction: () => { }, // Not used in hard cap mode
              isHardCap: true, // Flag to show hard cap UI
            });
            setOverageDialogOpen(true);
            return; // Don't start creation
          }
        } else {
          // Check if overage charges will apply
          const data = await checkResponse.json();
          console.log('[Overage Check] Usage data:', data.usage);

          // Show overage dialog if user is in overage OR will enter overage (will incur overage charge)
          if (data.usage.remaining === 0 || data.usage.inOverage) {
            console.log('[Overage Check] Showing overage dialog - user in overage or entering overage');
            // Extract charge from tier config
            const perDesignCharge = data.warning?.message?.match(/\$(\d+\.\d+)/)?.[1]
              ? parseFloat(data.warning.message.match(/\$(\d+\.\d+)/)[1])
              : 2.00;

            return new Promise<void>((resolve) => {
              setOverageDialogData({
                charge: perDesignCharge,
                count: (data.usage.overage || 0) + 1, // Next overage will be this count
                pendingAction: async () => {
                  // Reserve the design slot by recording usage BEFORE generation
                  try {
                    const trackResponse = await fetch('/api/designs/track', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ designCount: 1 }),
                    });

                    if (!trackResponse.ok) {
                      const error = await trackResponse.json();
                      alert(`Failed to reserve design slot: ${error.error}`);
                      resolve();
                      return;
                    }

                    console.log('[Overage Check] Design slot reserved, proceeding with generation');
                    designSlotReservedRef.current = true;
                  } catch (error) {
                    console.error('Failed to reserve design slot:', error);
                    alert('Failed to reserve design slot. Please try again.');
                    resolve();
                    return;
                  }

                  resolve();
                  setInitialAutoStart(autoStart);
                  if (view === AppView.TREND_RESEARCH) {
                    setPreGenData(undefined);
                  }
                  navigateTo(view);
                }
              });
              setOverageDialogOpen(true);
            });
          } else {
            // Not in overage - user has remaining free designs, proceed without reserving
            console.log('[Overage Check] User has remaining free designs, will track on save');
            // Don't reserve slot here - it will be tracked when design is saved
          }
        }
      } catch (error) {
        console.error('Failed to check quota:', error);
        // Continue anyway if check fails (offline mode)
      }
    }

    setInitialAutoStart(autoStart);
    // Clear preGenData when navigating to trend research (starting fresh)
    if (view === AppView.TREND_RESEARCH) {
      setPreGenData(undefined);
    }
    navigateTo(view);
  };

  const handleTrendSelect = async (trend: TrendData, shouldAutoRun = false, data?: MerchPackage) => {
    console.log('[App] handleTrendSelect called:', { trend: trend.topic, shouldAutoRun, hasData: !!data, dataId: (data as any)?.id });

    // Check quota if auto-running and not viewing existing design
    if (shouldAutoRun && !(data as any)?.id && !isAnonymous) {
      try {
        const checkResponse = await fetch('/api/designs/check-quota', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ designCount: 1 }),
        });

        if (!checkResponse.ok) {
          const error = await checkResponse.json();
          if (checkResponse.status === 403) {
            alert(`Design limit reached: ${error.error}\n\nYou have ${error.usage?.remaining || 0} designs remaining this month.`);
            return; // Don't start creation
          }
        } else {
          // Check if overage charges will apply
          const checkData = await checkResponse.json();
          console.log('[Overage Check - Trend] Usage data:', checkData.usage);

          // Show overage dialog if user is in overage OR will enter overage (will incur overage charge)
          if (checkData.usage.remaining === 0 || checkData.usage.inOverage) {
            console.log('[Overage Check - Trend] Showing overage dialog - user in overage or entering overage');
            // Extract charge from tier config
            const perDesignCharge = checkData.warning?.message?.match(/\$(\d+\.\d+)/)?.[1]
              ? parseFloat(checkData.warning.message.match(/\$(\d+\.\d+)/)[1])
              : 2.00;

            return new Promise<void>((resolve) => {
              setOverageDialogData({
                charge: perDesignCharge,
                count: (checkData.usage.overage || 0) + 1, // Next overage will be this count
                pendingAction: async () => {
                  // Reserve the design slot by recording usage BEFORE generation
                  try {
                    const trackResponse = await fetch('/api/designs/track', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ designCount: 1 }),
                    });

                    if (!trackResponse.ok) {
                      const error = await trackResponse.json();
                      alert(`Failed to reserve design slot: ${error.error}`);
                      resolve();
                      return;
                    }

                    console.log('[Overage Check - Trend] Design slot reserved, proceeding with generation');
                    designSlotReservedRef.current = true;
                  } catch (error) {
                    console.error('Failed to reserve design slot:', error);
                    alert('Failed to reserve design slot. Please try again.');
                    resolve();
                    return;
                  }

                  resolve();
                  setSelectedTrend(trend);
                  setAutoRun(shouldAutoRun);
                  setPreGenData(data);
                  navigateTo(AppView.LISTING_GENERATOR);
                }
              });
              setOverageDialogOpen(true);
            });
          } else {
            // Not in overage - user has remaining free designs, proceed without reserving
            console.log('[Overage Check - Trend] User has remaining free designs, will track on save');
            // Don't reserve slot here - it will be tracked when design is saved
          }
        }
      } catch (error) {
        console.error('Failed to check quota:', error);
        // Continue anyway if check fails (offline mode)
      }
    }

    setSelectedTrend(trend);
    setAutoRun(shouldAutoRun);
    setPreGenData(data);
    console.log('[App] preGenData set to:', data ? `existing design (${(data as any).id || 'new'})` : 'undefined (new design)');
    navigateTo(AppView.LISTING_GENERATOR);
  };

  const handleSaveListing = async (data: MerchPackage): Promise<{ id: string } | void> => {
    // Check if this is an UPDATE (regeneration) vs CREATE (new design)
    const existingDesignId = (data as any)?._analytics?.existingDesignId;
    const isUpdate = !!existingDesignId;

    console.log('[SaveListing] Mode:', isUpdate ? 'UPDATE' : 'CREATE', { existingDesignId });

    if (isAnonymous) {
      // Anonymous users: save to localStorage only
      const now = Date.now();
      if (isUpdate) {
        // Update existing design in localStorage
        const updated = savedListings.map(item =>
          item.id === existingDesignId
            ? { ...item, imageUrl: data.imageUrl, listing: data.listing }
            : item
        );
        updateStorage(updated);
        return { id: existingDesignId };
      } else {
        // Create new design
        const newId = crypto.randomUUID();
        const newListing: SavedListing = {
          ...data,
          id: newId,
          createdAt: now,
          expiresAt: now + (7 * 24 * 60 * 60 * 1000), // 7 days for anonymous
          tierAtCreation: 'free'
        };
        updateStorage([newListing, ...savedListings]);
        return { id: newId };
      }
    }

    const currentTier = userTier;

    // For UPDATES (regeneration): Update with full image history, no quota tracking needed
    if (isUpdate) {
      console.log('[SaveListing] Updating existing design (regeneration):', existingDesignId);
      try {
        const updateResponse = await fetch(`/api/designs/${existingDesignId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: data.imageUrl,
            imageHistory: data.imageHistory, // Full history of all image versions
            // Update analytics fields
            regenerationCount: (data as any)?._analytics?.regenerationCount || 0,
            wasRegenerated: true,
            promptMode: data.promptMode
          }),
        });

        if (updateResponse.ok) {
          const result = await updateResponse.json();
          console.log('[SaveListing] Design updated successfully with', data.imageHistory?.length || 0, 'image versions');

          // Update local state with full image history
          setSavedListings(prev => prev.map(item =>
            item.id === existingDesignId
              ? { ...item, imageUrl: data.imageUrl, imageHistory: data.imageHistory }
              : item
          ));

          return { id: existingDesignId };
        } else {
          console.error('[SaveListing] Failed to update design');
        }
      } catch (error) {
        console.error('[SaveListing] Update error:', error);
      }
      return { id: existingDesignId };
    }

    // For NEW designs: Track usage and create new record
    console.log('[SaveListing] Creating new design. designSlotReserved:', designSlotReservedRef.current);

    if (!designSlotReservedRef.current) {
      console.log('[SaveListing] Tracking design usage...');
      try {
        const trackResponse = await fetch('/api/designs/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            designCount: 1,
          }),
        });

        if (!trackResponse.ok) {
          const error = await trackResponse.json();
          console.error('[SaveListing] Failed to track design generation:', error);

          // If quota exceeded (403), show error and prevent save
          if (trackResponse.status === 403) {
            alert(`Design limit reached: ${error.error}\n\nYou have ${error.usage?.remaining || 0} designs remaining this month.`);
            return;
          }
          // For other errors, still continue with save (offline mode)
        } else {
          console.log('[SaveListing] Successfully tracked design usage');
        }
      } catch (error) {
        console.error('[SaveListing] Failed to track design generation:', error);
        // Continue with save even if tracking fails (offline mode)
      }
    } else {
      console.log('[SaveListing] Skipping track API - design slot already reserved during overage confirmation');
      designSlotReservedRef.current = false; // Reset flag for next design
    }

    // Save design to database
    try {
      const saveResponse = await fetch('/api/designs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trend: data.trend,
          listing: data.listing,
          imageUrl: data.imageUrl,
          imageHistory: data.imageHistory, // Full history of all image versions
          tierAtCreation: currentTier,
          promptMode: data.promptMode
        }),
      });

      if (saveResponse.ok) {
        const result = await saveResponse.json();
        console.log('[SaveListing] Design saved to database successfully, id:', result.design?.id);

        // Update local state with the saved design
        setSavedListings([result.design, ...savedListings]);

        // Trigger sidebar refresh to update usage counter
        setUsageRefreshKey(prev => prev + 1);

        return { id: result.design?.id };
      } else {
        const error = await saveResponse.json();
        console.error('Failed to save design to database:', error);
        // Fallback to localStorage if database save fails
        const now = Date.now();
        const newId = crypto.randomUUID();
        const newListing: SavedListing = {
          ...data,
          id: newId,
          createdAt: now,
          expiresAt: now + (30 * 24 * 60 * 60 * 1000),
          tierAtCreation: currentTier
        };
        updateStorage([newListing, ...savedListings]);
        return { id: newId };
      }
    } catch (error) {
      console.error('Failed to save design:', error);
      // Fallback to localStorage
      const now = Date.now();
      const newId = crypto.randomUUID();
      const newListing: SavedListing = {
        ...data,
        id: newId,
        createdAt: now,
        expiresAt: now + (30 * 24 * 60 * 60 * 1000),
        tierAtCreation: currentTier
      };
      updateStorage([newListing, ...savedListings]);
      return { id: newId };
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (isAnonymous) {
      // Anonymous users: delete from localStorage only
      updateStorage(savedListings.filter(item => item.id !== id));
      return;
    }

    // Authenticated users: delete from database
    try {
      const response = await fetch(`/api/designs/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log('Design deleted from database successfully');
        // Update local state
        setSavedListings(savedListings.filter(item => item.id !== id));
      } else {
        const error = await response.json();
        console.error('Failed to delete design from database:', error);
        // Fallback to localStorage delete
        updateStorage(savedListings.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete design:', error);
      // Fallback to localStorage delete
      updateStorage(savedListings.filter(item => item.id !== id));
    }
  };

  const handleViewListing = async (savedItem: SavedListing) => {
    // Fetch full design data if user is authenticated (data might be in R2)
    if (!isAnonymous) {
      try {
        const response = await fetch(`/api/designs/${savedItem.id}`);
        if (response.ok) {
          const fullDesign = await response.json();
          setSelectedTrend(fullDesign.trend);
          setPreGenData(fullDesign);
          navigateTo(AppView.LISTING_GENERATOR);
          return;
        }
      } catch (error) {
        console.error('Failed to fetch full design data:', error);
        // Fall through to use cached data
      }
    }

    // Fall back to cached data (anonymous users or if fetch failed)
    setSelectedTrend(savedItem.trend);
    setPreGenData(savedItem);
    navigateTo(AppView.LISTING_GENERATOR);
  };

  // Handle selecting an idea from the Ideas Vault
  const handleSelectIdea = (trend: TrendData, ideaId: string) => {
    // Mark idea as used in storage
    StorageService.markIdeaAsUsed(ideaId);
    // Navigate to listing generator with this trend
    setSelectedTrend(trend);
    setAutoRun(false);
    setPreGenData(undefined);
    navigateTo(AppView.LISTING_GENERATOR);
  };

  const renderContent = () => {
    switch (currentView) {
      case AppView.DASHBOARD:
        return isAnonymous ?
          <AnonymousDashboard onAction={handleDashboardAction} /> :
          <Dashboard onAction={handleDashboardAction} refreshKey={usageRefreshKey} />;
      case AppView.TREND_RESEARCH:
        return <TrendScanner onTrendSelect={handleTrendSelect} initialAutoRun={initialAutoStart} onNavigateToSubscription={() => navigateTo(AppView.SUBSCRIPTION)} />;
      case AppView.TREND_LAB:
        return <TrendLab onSelectIdea={(trend) => {
          setSelectedTrend(trend);
          setAutoRun(false);
          setPreGenData(undefined);
          navigateTo(AppView.LISTING_GENERATOR);
        }} />;
      case AppView.IMAGE_VECTORIZER:
        return <ImageVectorizer onNavigateToSubscription={() => navigateTo(AppView.SUBSCRIPTION)} />;
      case AppView.LISTING_GENERATOR:
        if (!selectedTrend && !preGenData) {
          return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6 animate-fade-in">
              <div className="p-6 bg-gray-100 dark:bg-dark-800 rounded-full border border-gray-200 dark:border-white/5 shadow-xl shadow-brand-900/20">
                <Shirt className="w-16 h-16 text-gray-400 dark:text-gray-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Production Studio Idle</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Select a trend to start generating listings, or load a saved project from your library.
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => navigateTo(AppView.TREND_RESEARCH)}
                  className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-brand-500/20"
                >
                  Find a Trend
                </button>
                <button
                  onClick={() => navigateTo(AppView.LIBRARY)}
                  className="px-6 py-3 bg-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-700 text-gray-900 dark:text-white font-bold rounded-lg border border-gray-200 dark:border-white/10 transition-all hover:border-gray-300 dark:hover:border-white/20"
                >
                  Open Library
                </button>
              </div>
            </div>
          );
        }
        console.log('[App] Rendering ListingGenerator with initialData:', preGenData ? `existing design (${(preGenData as any).id || 'new'})` : 'undefined (new design)');
        return (
          <ListingGenerator
            selectedTrend={selectedTrend || preGenData!.trend}
            autoRun={autoRun}
            initialData={preGenData}
            previousView={previousView}
            onReset={() => {
              console.log('[App] Reset clicked - clearing preGenData');
              setPreGenData(undefined);
              navigateTo(previousView === AppView.LISTING_GENERATOR ? AppView.TREND_RESEARCH : previousView);
            }}
            onSave={handleSaveListing}
            isAnonymous={isAnonymous}
            onNavigateToSubscription={() => navigateTo(AppView.SUBSCRIPTION)}
            userTier={userTier}
          />
        );
      case AppView.MERCH_GENERATOR:
        return <MerchGenerator />;
      case AppView.SIMPLE_AUTOPILOT:
        return <SimpleAutopilot />;
      case AppView.LIBRARY:
        return <Library savedListings={savedListings} onDelete={handleDeleteListing} onView={handleViewListing} userTier={userTier} onRefresh={fetchSavedDesigns} isLoading={isLibraryLoading} hasMore={libraryHasMore} onLoadMore={loadMoreDesigns} isLoadingMore={isLoadingMore} total={libraryTotal} />;
      case AppView.IDEAS_VAULT:
        return <IdeasVault onSelectIdea={handleSelectIdea} />;
      case AppView.SUBSCRIPTION:
        return <PricingPlans />;
      case AppView.REFUNDS:
      case AppView.TERMS:
      case AppView.PRIVACY:
      case AppView.CONTACT:
        return <LegalDocs view={currentView} onBack={() => navigateTo(AppView.DASHBOARD)} />;
      default:
        return <Dashboard onAction={handleDashboardAction} refreshKey={usageRefreshKey} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex font-sans text-gray-900 dark:text-gray-100 selection:bg-brand-500 selection:text-white">
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        isAnonymous={isAnonymous}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        refreshKey={usageRefreshKey}
      />

      <main className="flex-1 h-screen overflow-y-auto relative flex flex-col w-full">
        {/* Mobile hamburger menu */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-30 p-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors shadow-lg"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>

        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-brand-100 dark:from-brand-900/20 to-transparent pointer-events-none z-0" />
        <div className="relative z-10 pt-16 lg:pt-8 px-4 md:px-8 pb-4 md:pb-8 max-w-7xl mx-auto w-full flex-grow">
          <ErrorBoundary
            onError={(error, errorInfo) => {
              console.error('[App ErrorBoundary] Caught error:', error.message);
              console.error('[App ErrorBoundary] Component stack:', errorInfo.componentStack);
            }}
          >
            <Suspense fallback={<LoadingSpinner />}>
              {renderContent()}
            </Suspense>
          </ErrorBoundary>
        </div>
        <Footer onNavigate={handleNavigate} />
      </main>

      {/* Overage Dialog */}
      <OverageDialog
        isOpen={overageDialogOpen}
        onClose={() => {
          setOverageDialogOpen(false);
          setOverageDialogData(null);
        }}
        onContinue={() => {
          setOverageDialogOpen(false);
          if (overageDialogData?.pendingAction) {
            overageDialogData.pendingAction();
          }
          setOverageDialogData(null);
        }}
        onUpgrade={(tier: string) => {
          setOverageDialogOpen(false);
          setOverageDialogData(null);
          // Navigate to subscription page with selected tier
          setCurrentView(AppView.SUBSCRIPTION);
          // Store selected tier for pre-selection (optional enhancement)
          sessionStorage.setItem('selectedTier', tier);
        }}
        currentTier={userTier}
        overageCharge={overageDialogData?.charge || 0}
        overageCount={overageDialogData?.count || 1}
        isHardCap={overageDialogData?.isHardCap || false}
      />

      {/* Subscription Success Modal */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={() => {
          setSuccessModalOpen(false);
          setSuccessModalData(null);
        }}
        title={successModalData?.title || 'Success!'}
        message={successModalData?.message || ''}
        tier={successModalData?.tier}
        features={successModalData?.features}
      />
    </div>
  );
};

// Dashboard for Anonymous/Guest users
const AnonymousDashboard: React.FC<{ onAction: (view: AppView, autoStart?: boolean) => void }> = ({ onAction }) => {
  return <DashboardContent userName="Guest" onAction={onAction} />;
};

const App: React.FC = () => {
  const [guestMode, setGuestMode] = useState(false);

  // ClerkProvider is handled by app/layout.tsx in Next.js
  return (
    <>
      <SignedIn>
        <MainAppLayout isAnonymous={false} />
      </SignedIn>
      <SignedOut>
        {guestMode ? (
          <MainAppLayout isAnonymous={true} />
        ) : (
          <Suspense fallback={<LoadingSpinner />}>
            <LandingPage onNavigate={() => { }} />
            <div className="fixed bottom-4 right-4 z-50">
              <button
                onClick={() => setGuestMode(true)}
                className="px-4 py-2 bg-gray-800 text-white text-xs rounded-full opacity-50 hover:opacity-100 transition-opacity"
              >
                Dev: Guest Mode
              </button>
            </div>
          </Suspense>
        )}
      </SignedOut>
    </>
  );
};

export default App;
'use client';

import React, { useState, useEffect } from 'react';
import { AppView } from '../types';
import { BarChart3, Zap, Star, Sparkles, ArrowRight, TrendingUp } from 'lucide-react';

interface DashboardStat {
  label: string;
  value: string;
  change: string;
  icon: typeof Zap | typeof BarChart3 | typeof Star;
}

interface DashboardContentProps {
  userName?: string;
  stats?: DashboardStat[];
  onAction: (view: AppView, autoStart?: boolean) => void;
  refreshKey?: number; // Trigger refetch when this changes (e.g., after subscription sync)
}

interface UserData {
  user: {
    subscriptionTier: string;
    subscriptionStatus: string;
  };
  usage: {
    tier: string;
    allowance: number;
    used: number;
    remaining: number;
    overage: number;
    overageCharge: number;
  };
}

const DEFAULT_STATS: DashboardStat[] = [
  { label: 'Listings Created', value: '1,284', change: '+12%', icon: Zap },
  { label: 'Avg. Sales Rank', value: '45k', change: '-5%', icon: BarChart3 },
  { label: 'Credits Remaining', value: '3,750', change: 'Good', icon: Star },
];

const GUEST_STATS: DashboardStat[] = [
  { label: 'Listings Created', value: '0', change: '0%', icon: Zap },
  { label: 'Avg. Sales Rank', value: '--', change: '0%', icon: BarChart3 },
  { label: 'Credits Remaining', value: 'Unlimited (Preview)', change: 'Good', icon: Star },
];

/**
 * Shared dashboard content component
 * Used by both authenticated and anonymous dashboards
 */
const DashboardContent: React.FC<DashboardContentProps> = ({
  userName = 'Creator',
  stats,
  onAction,
  refreshKey
}) => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const isGuest = userName === 'Guest';

  useEffect(() => {
    if (!isGuest) {
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, [isGuest, refreshKey]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user');
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate dynamic stats based on real user data
  const generateUserStats = (): DashboardStat[] => {
    if (!userData?.usage) {
      return [];
    }

    const usagePercentage = Math.round((userData.usage.used / userData.usage.allowance) * 100);
    const remainingStatus = userData.usage.remaining > userData.usage.allowance * 0.5 ? 'Good' : 'Low';

    return [
      {
        label: 'Designs Used',
        value: userData.usage.used.toString(),
        change: `${usagePercentage}%`,
        icon: Zap
      },
      {
        label: 'Designs Remaining',
        value: userData.usage.remaining.toString(),
        change: remainingStatus,
        icon: Star
      },
      {
        label: 'Current Tier',
        value: userData.usage.tier.charAt(0).toUpperCase() + userData.usage.tier.slice(1),
        change: userData.user.subscriptionStatus === 'active' ? 'Active' : 'Inactive',
        icon: BarChart3
      },
    ];
  };

  const displayStats = stats || (isGuest ? GUEST_STATS : generateUserStats());
  const greeting = isGuest
    ? 'Welcome Guest. Try out the AI-powered Amazon Merch tool.'
    : `Welcome back, ${userName}. AI-powered Amazon Merch listings in minutes.`;

  // Calculate progress for progress bar
  const usageProgress = userData?.usage
    ? Math.min(100, Math.round((userData.usage.used / userData.usage.allowance) * 100))
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Section - Now at top */}
      <div className="relative bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-dark-800 dark:via-dark-800 dark:to-dark-900 border border-gray-200 dark:border-white/5 rounded-2xl p-8 md:p-10 overflow-hidden">
        {/* Background effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Left side - Text content */}
          <div className="flex-1 text-center lg:text-left space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-mono">
              <Sparkles className="w-3 h-3" />
              <span>AI-Powered Design Studio</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
              Ready to Create{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-cyan-500">
                Amazing Designs
              </span>
            </h1>

            <p className="text-gray-600 dark:text-gray-400 text-lg max-w-xl">
              {greeting}
            </p>

            <div className="pt-4 flex justify-center lg:justify-start">
              <button
                onClick={() => onAction(AppView.TREND_RESEARCH)}
                className="group inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl hover:from-brand-500 hover:to-brand-400 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(14,165,233,0.3)] transition-all duration-200"
              >
                LAUNCH
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          {/* Right side - Quick stats preview (desktop only) */}
          {!isGuest && userData?.usage && (
            <div className="hidden lg:block w-72 bg-white/80 dark:bg-dark-900/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">This Month</span>
                <span className="text-xs px-2 py-0.5 bg-brand-500/20 text-brand-600 dark:text-brand-400 rounded-full font-medium">
                  {userData.usage.tier}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Designs Created</span>
                    <span className="text-gray-900 dark:text-white font-bold">{userData.usage.used}</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usageProgress >= 90 ? 'bg-red-500' : usageProgress >= 70 ? 'bg-orange-500' : 'bg-brand-500'
                      }`}
                      style={{ width: `${usageProgress}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-sm pt-1">
                  <span className="text-gray-500">Remaining</span>
                  <span className="text-green-500 dark:text-green-400 font-bold">{userData.usage.remaining}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid - Compact row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading && !isGuest ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/5 p-5 rounded-xl animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="h-3 bg-gray-200 dark:bg-white/5 rounded w-20 mb-2"></div>
                    <div className="h-7 bg-gray-300 dark:bg-white/10 rounded w-14"></div>
                  </div>
                  <div className="p-2.5 bg-gray-100 dark:bg-white/5 rounded-lg">
                    <div className="w-4 h-4 bg-gray-200 dark:bg-white/10 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          displayStats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/5 p-5 rounded-xl hover:border-gray-300 dark:hover:border-white/10 transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</h3>
                  </div>
                  <div className={`p-2.5 rounded-lg ${
                    stat.change.includes('Low') || stat.change.includes('Inactive')
                      ? 'bg-orange-500/10'
                      : stat.change.includes('Good') || stat.change.includes('Active')
                        ? 'bg-green-500/10'
                        : 'bg-brand-500/10'
                  }`}>
                    <Icon className={`w-4 h-4 ${
                      stat.change.includes('Low') || stat.change.includes('Inactive')
                        ? 'text-orange-500'
                        : stat.change.includes('Good') || stat.change.includes('Active')
                          ? 'text-green-500'
                          : 'text-brand-500'
                    }`} />
                  </div>
                </div>
                <div className={`mt-2 text-xs font-medium ${
                  stat.change.includes('Low') || stat.change.includes('Inactive')
                    ? 'text-orange-500'
                    : stat.change.includes('Good') || stat.change.includes('Active')
                      ? 'text-green-500'
                      : 'text-brand-500'
                }`}>
                  {stat.change} {!stat.change.includes('Good') && !stat.change.includes('Low') && !stat.change.includes('Active') && !stat.change.includes('Inactive') && <span className="text-gray-400 dark:text-gray-600">used</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Usage Progress Bar - Mobile only (desktop has it in hero) */}
      {!isGuest && userData?.usage && (
        <div className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/5 p-5 rounded-xl lg:hidden">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h4 className="text-gray-900 dark:text-white font-medium text-sm">Monthly Usage</h4>
              <p className="text-gray-500 text-xs mt-0.5">
                {userData.usage.used} of {userData.usage.allowance} designs
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-900 dark:text-white">{usageProgress}%</div>
            </div>
          </div>
          <div className="relative h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
            <div
              className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
                usageProgress >= 90
                  ? 'bg-red-500'
                  : usageProgress >= 70
                    ? 'bg-orange-500'
                    : 'bg-brand-500'
              }`}
              style={{ width: `${usageProgress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
            </div>
          </div>
          {userData.usage.remaining === 0 && userData.usage.overage === 0 && userData.user.subscriptionTier !== 'enterprise' && (
            <button
              onClick={() => onAction(AppView.SUBSCRIPTION)}
              className="mt-4 w-full py-2 bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white text-sm font-bold rounded-lg transition-all"
            >
              Upgrade Plan
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardContent;

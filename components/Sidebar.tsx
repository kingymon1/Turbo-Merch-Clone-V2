'use client';

import React, { useState, useEffect } from 'react';
import { AppView } from '../types';
import { LayoutDashboard, Search, CreditCard, Activity, FolderHeart, User, LogIn, X, Lightbulb, Beaker, Wand2, Sparkles, Zap, TrendingUp, Target } from 'lucide-react';
import { UserButton, useUser } from "@clerk/clerk-react";
import ThemeToggle from './ThemeToggle';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  isAnonymous?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  refreshKey?: number; // Trigger refetch when this changes
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

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isAnonymous, isOpen = true, onClose, refreshKey }) => {
  const { user } = isAnonymous ? { user: null } : useUser();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  // Check for dev mode (localhost or ?dev=true)
  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const hasDevParam = new URLSearchParams(window.location.search).get('dev') === 'true';
    setIsDevMode(isLocalhost || hasDevParam);
  }, []);

  useEffect(() => {
    if (!isAnonymous) {
      fetchUserData();
    }
  }, [isAnonymous, refreshKey]);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user');
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const allMenuItems = [
    { id: AppView.DASHBOARD, label: 'Nexus Dashboard', icon: LayoutDashboard },
    { id: AppView.TREND_RESEARCH, label: 'Trend Scanner', icon: Search, devOnly: true },
    { id: AppView.TREND_LAB, label: 'Trend Lab', icon: Beaker, badge: 'LAB', devOnly: true },
    { id: AppView.EMERGING_TRENDS, label: 'Emerging Trends', icon: TrendingUp, badge: 'NEW' },
    { id: AppView.PROVEN_NICHES, label: 'Proven Niches', icon: Target, badge: 'NEW', devOnly: true },
    { id: AppView.SIMPLE_AUTOPILOT, label: 'Autopilot', icon: Zap, badge: 'NEW' },
    { id: AppView.MERCH_GENERATOR, label: 'Merch Generator', icon: Sparkles, devOnly: true },
    { id: AppView.IMAGE_VECTORIZER, label: 'Image Vectorizer', icon: Wand2 },
    { id: AppView.IDEAS_VAULT, label: 'Ideas Vault', icon: Lightbulb, devOnly: true },
    { id: AppView.LIBRARY, label: 'My Library', icon: FolderHeart },
    { id: AppView.SUBSCRIPTION, label: 'Subscription', icon: CreditCard },
  ];

  // Filter menu items based on dev mode
  const menuItems = allMenuItems.filter(item => !item.devOnly || isDevMode);

  const handleNavigation = (view: AppView) => {
    onNavigate(view);
    // Close sidebar on mobile after navigation
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        w-64 h-screen bg-gray-50 dark:bg-dark-800 border-r border-gray-200 dark:border-white/10 flex flex-col
        fixed lg:sticky top-0 z-50
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      <div className="p-6 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-brand-400" />
            <h1 className="text-xl font-bold font-mono tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-cyan-500">
              TURBO<span className="text-gray-900 dark:text-white">MERCH</span>
            </h1>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1 ml-8">Orchestrator v1.0</p>
        <div className="mt-3 ml-8">
          <ThemeToggle compact />
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item: any) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              aria-label={`Navigate to ${item.label}`}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive
                  ? 'bg-brand-500/10 text-brand-500 dark:text-brand-400 border border-brand-500/20 shadow-[0_0_15px_rgba(14,165,233,0.15)]'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-brand-500 dark:text-brand-400' : 'text-gray-500 group-hover:text-gray-900 dark:group-hover:text-white'}`} />
              <span className="font-medium">{item.label}</span>
              {item.badge && (
                <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-500 dark:text-purple-400 rounded">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-white/10">
        {isAnonymous ? (
            <div className="bg-gray-100 dark:bg-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-white/5">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center border border-gray-300 dark:border-white/10">
                        <User className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">Guest User</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">Preview Mode</span>
                    </div>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    aria-label="Sign in or sign up to access full features"
                    className="w-full flex items-center justify-center gap-2 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg transition-colors"
                >
                    <LogIn className="w-3 h-3" /> Sign In / Up
                </button>
            </div>
        ) : (
            <div className="bg-gray-100 dark:bg-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-white/5 flex items-center gap-3">
                <div className="scale-110">
                    <UserButton
                        appearance={{
                            elements: {
                                avatarBox: "w-9 h-9 border border-gray-300 dark:border-white/20"
                            }
                        }}
                    />
                </div>
                <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {user?.firstName || 'Creator'}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate capitalize">
                        {userData?.user?.subscriptionTier || 'Free'} Plan
                    </span>
                </div>
            </div>
        )}
        
        {!isAnonymous && userData?.usage && (
            <div className="mt-4 px-2">
                <div className="flex justify-between items-end mb-1">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Designs</span>
                    <span className="text-xs text-brand-500 dark:text-brand-400 font-mono">
                        {userData.usage.used}/{userData.usage.allowance}
                    </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-dark-900 h-1 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full ${
                            userData.usage.used / userData.usage.allowance > 0.8
                                ? 'bg-orange-500'
                                : userData.usage.used / userData.usage.allowance > 0.5
                                    ? 'bg-yellow-500'
                                    : 'bg-brand-500'
                        }`}
                        style={{ width: `${Math.min(100, (userData.usage.used / userData.usage.allowance) * 100)}%` }}
                    ></div>
                </div>
                {userData.usage.overage > 0 && (
                    <div className="mt-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-orange-500 dark:text-orange-400 uppercase tracking-wider font-bold">Overage</span>
                            <span className="text-xs text-orange-500 dark:text-orange-400 font-mono">
                                +{userData.usage.overage} (${userData.usage.overageCharge.toFixed(2)})
                            </span>
                        </div>
                    </div>
                )}
                {userData.usage.remaining === 0 && userData.usage.overage === 0 && userData.user.subscriptionTier !== 'enterprise' && (
                    <button
                        onClick={() => handleNavigation(AppView.SUBSCRIPTION)}
                        className="mt-3 w-full py-2 bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white text-xs font-bold rounded-lg transition-all duration-200 shadow-lg shadow-brand-900/30"
                    >
                        Upgrade Plan
                    </button>
                )}
            </div>
        )}
      </div>
    </div>
    </>
  );
};

export default Sidebar;
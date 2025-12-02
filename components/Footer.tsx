
import React from 'react';
import { AppView } from '../types';
import { Activity } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: AppView) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-gray-100 dark:bg-dark-900 border-t border-gray-200 dark:border-white/5 mt-auto py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-2">
             <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-brand-500 dark:text-brand-400" />
              <h2 className="text-lg font-bold font-mono tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-brand-500 dark:from-brand-400 to-cyan-500">
                TURBO<span className="text-gray-900 dark:text-white">MERCH</span>
              </h2>
            </div>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
              The ultimate AI orchestrator for Amazon Merch on Demand. Analyze trends, generate assets, and scale your POD business with enterprise-grade intelligence.
            </p>
          </div>

          <div>
            <h4 className="text-gray-900 dark:text-white font-bold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li><button onClick={() => onNavigate(AppView.TREND_RESEARCH)} className="hover:text-brand-500 dark:hover:text-brand-400 transition-colors text-left w-full py-1">Trend Scanner</button></li>
              <li><button onClick={() => onNavigate(AppView.LIBRARY)} className="hover:text-brand-500 dark:hover:text-brand-400 transition-colors text-left w-full py-1">Asset Library</button></li>
              <li><button onClick={() => onNavigate(AppView.SUBSCRIPTION)} className="hover:text-brand-500 dark:hover:text-brand-400 transition-colors text-left w-full py-1">Pricing</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-gray-900 dark:text-white font-bold mb-4">Legal & Support</h4>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li><button onClick={() => onNavigate(AppView.TERMS)} className="hover:text-brand-500 dark:hover:text-brand-400 transition-colors text-left w-full py-1">Terms of Service</button></li>
              <li><button onClick={() => onNavigate(AppView.PRIVACY)} className="hover:text-brand-500 dark:hover:text-brand-400 transition-colors text-left w-full py-1">Privacy Policy</button></li>
              <li><button onClick={() => onNavigate(AppView.REFUNDS)} className="hover:text-brand-500 dark:hover:text-brand-400 transition-colors text-left w-full py-1">Refund Policy</button></li>
              <li><button onClick={() => onNavigate(AppView.CONTACT)} className="hover:text-brand-500 dark:hover:text-brand-400 transition-colors text-left w-full py-1">Contact Us</button></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            © {currentYear} Turbo Merch AI. All rights reserved.
          </p>
          <div className="flex gap-4">
             <span className="text-xs text-gray-400 dark:text-gray-600">Powered by Google Gemini, Brave & Grok</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;


import React from 'react';
import { AppView } from '../types';
import { ArrowLeft, Mail, Shield, FileText, RefreshCw } from 'lucide-react';

interface LegalDocsProps {
  view: AppView;
  onBack: () => void;
}

const LegalDocs: React.FC<LegalDocsProps> = ({ view, onBack }) => {
  const renderContent = () => {
    switch (view) {
      case AppView.REFUNDS:
        return (
          <div className="space-y-6 text-gray-300">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <RefreshCw className="w-8 h-8 text-brand-400" /> Refund Policy
            </h2>
            <p><strong>Last updated: May 2024</strong></p>
            <p>At Turbo Merch, we strive to provide high-quality AI orchestration services. If you are not completely satisfied with your subscription, we are here to help.</p>
            
            <h3 className="text-xl font-bold text-white mt-8">1. Subscription Refunds</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>7-Day Money-Back Guarantee:</strong> If you are a new subscriber, you may request a full refund within 7 days of your initial purchase, provided you have not generated more than 5 designs.</li>
              <li><strong>After 7 Days:</strong> We do not offer refunds for partial months or unused credits after the initial 7-day period.</li>
              <li><strong>Cancellations:</strong> You may cancel your subscription at any time. Your access will continue until the end of your current billing cycle.</li>
            </ul>

            <h3 className="text-xl font-bold text-white mt-8">2. Digital Asset Quality</h3>
            <p>Due to the nature of AI generation, results may vary. We provide tools to regenerate and refine listings. Refunds are not issued based on subjective artistic preference alone, but technical failures (e.g., system errors, failed downloads) will be compensated with credit restoration.</p>

            <h3 className="text-xl font-bold text-white mt-8">3. How to Request</h3>
            <p>To request a refund, please contact our support team at <a href="mailto:refunds@turbomerch.ai" className="text-brand-400 hover:underline">refunds@turbomerch.ai</a> with your account email and reason for the request.</p>
          </div>
        );

      case AppView.TERMS:
        return (
          <div className="space-y-6 text-gray-300">
             <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <FileText className="w-8 h-8 text-brand-400" /> Terms of Service
            </h2>
            <p><strong>Last updated: May 2024</strong></p>
            
            <h3 className="text-xl font-bold text-white mt-8">1. Acceptance of Terms</h3>
            <p>By accessing and using Turbo Merch ("Service"), you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the Service.</p>

            <h3 className="text-xl font-bold text-white mt-8">2. Commercial Use Rights</h3>
            <p>Subscribers on paid tiers (Starter, Pro, Business, Enterprise) are granted full commercial rights to the designs and listing text generated during their active subscription period. You own the assets you create.</p>

            <h3 className="text-xl font-bold text-white mt-8">3. Platform Compliance</h3>
            <p>Turbo Merch provides tools to assist with compliance (e.g., trademark checks). However, <strong>YOU are ultimately responsible</strong> for ensuring your listings do not violate Amazon Merch on Demand content policies, copyrights, or trademarks. Turbo Merch accepts no liability for account suspensions.</p>

            <h3 className="text-xl font-bold text-white mt-8">4. Account Security</h3>
            <p>You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password.</p>
          </div>
        );

      case AppView.PRIVACY:
        return (
          <div className="space-y-6 text-gray-300">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <Shield className="w-8 h-8 text-brand-400" /> Privacy Policy
            </h2>
            <p><strong>Last updated: May 2024</strong></p>

            <h3 className="text-xl font-bold text-white mt-8">1. Information We Collect</h3>
            <p>We collect information you provide directly to us, such as email address and payment information (processed securely via Stripe). We also collect usage data (trends searched, designs generated) to improve our AI models.</p>

            <h3 className="text-xl font-bold text-white mt-8">2. How We Use Information</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide, maintain, and improve the Service.</li>
              <li>To process transactions and send related information.</li>
              <li>To send technical notices, updates, and support messages.</li>
            </ul>

            <h3 className="text-xl font-bold text-white mt-8">3. Data Security</h3>
            <p>We use industry-standard encryption and security measures to protect your personal information. Your generated assets are stored privately in your library.</p>
          </div>
        );

      case AppView.CONTACT:
        return (
          <div className="space-y-6 text-gray-300">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <Mail className="w-8 h-8 text-brand-400" /> Contact Support
            </h2>
            <p>We are here to help you scale your print-on-demand business.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div className="bg-dark-800 p-6 rounded-xl border border-white/10">
                    <h4 className="text-lg font-bold text-white mb-2">General Support</h4>
                    <p className="text-sm text-gray-400 mb-4">For account issues, bugs, or general questions.</p>
                    <a href="mailto:support@turbomerch.ai" className="text-brand-400 font-mono hover:underline">support@turbomerch.ai</a>
                </div>

                <div className="bg-dark-800 p-6 rounded-xl border border-white/10">
                    <h4 className="text-lg font-bold text-white mb-2">Billing & Refunds</h4>
                    <p className="text-sm text-gray-400 mb-4">For invoice questions or refund requests.</p>
                    <a href="mailto:refunds@turbomerch.ai" className="text-brand-400 font-mono hover:underline">refunds@turbomerch.ai</a>
                </div>

                 <div className="bg-dark-800 p-6 rounded-xl border border-white/10">
                    <h4 className="text-lg font-bold text-white mb-2">Enterprise Inquiries</h4>
                    <p className="text-sm text-gray-400 mb-4">For API access and agency plans.</p>
                    <a href="mailto:sales@turbomerch.ai" className="text-brand-400 font-mono hover:underline">sales@turbomerch.ai</a>
                </div>
            </div>
          </div>
        );

      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 animate-fade-in">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
      </button>
      
      <div className="bg-dark-800/50 border border-white/10 rounded-2xl p-8 md:p-12 shadow-xl">
        {renderContent()}
      </div>
    </div>
  );
};

export default LegalDocs;

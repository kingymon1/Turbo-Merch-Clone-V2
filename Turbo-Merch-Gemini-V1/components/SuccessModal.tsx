'use client';

import React from 'react';
import { CheckCircle, X, Sparkles, Zap } from 'lucide-react';

export interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    tier?: string;
    features?: string[];
}

const SuccessModal: React.FC<SuccessModalProps> = ({
    isOpen,
    onClose,
    title,
    message,
    tier,
    features,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-dark-800 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-fade-in">
                {/* Celebration background effect */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-20 -left-20 w-40 h-40 bg-brand-500/20 rounded-full blur-3xl" />
                    <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-green-500/20 rounded-full blur-3xl" />
                </div>

                {/* Header */}
                <div className="relative p-6 bg-gradient-to-br from-green-500/10 to-brand-500/10 border-b border-white/10">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="p-3 rounded-full bg-green-500/20 ring-4 ring-green-500/10">
                                <CheckCircle className="w-8 h-8 text-green-400" />
                            </div>
                            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">{title}</h3>
                            {tier && (
                                <div className="flex items-center gap-2 mt-1">
                                    <Zap className="w-3 h-3 text-brand-400" />
                                    <span className="text-sm text-brand-400 font-semibold uppercase tracking-wider">
                                        {tier} Plan Active
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="relative p-6 space-y-4">
                    <p className="text-gray-300 leading-relaxed">{message}</p>

                    {features && features.length > 0 && (
                        <div className="bg-dark-900/50 rounded-xl p-4 border border-white/5 space-y-2">
                            <span className="text-xs text-gray-500 uppercase tracking-wider">Now Unlocked</span>
                            <ul className="space-y-2">
                                {features.map((feature, index) => (
                                    <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Action */}
                <div className="relative p-6 pt-0">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-gradient-to-r from-green-600 to-brand-600 hover:from-green-500 hover:to-brand-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-900/30 flex items-center justify-center gap-2"
                    >
                        <Sparkles className="w-5 h-5" />
                        Start Creating
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SuccessModal;

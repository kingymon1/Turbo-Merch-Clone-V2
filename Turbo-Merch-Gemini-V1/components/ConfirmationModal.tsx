'use client';

import React from 'react';
import { AlertTriangle, X, CreditCard, ArrowUpCircle } from 'lucide-react';

export interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    onUpgrade?: () => void;
    title: string;
    message: string;
    details?: {
        used: number;
        allowance: number;
        overage?: number;
        overageCharge?: number;
        tier?: string;
    };
    confirmText?: string;
    cancelText?: string;
    variant?: 'warning' | 'danger' | 'info';
    showUpgradeOption?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    onUpgrade,
    title,
    message,
    details,
    confirmText = 'Continue',
    cancelText = 'Cancel',
    variant = 'warning',
    showUpgradeOption = true,
}) => {
    if (!isOpen) return null;

    const variantStyles = {
        warning: {
            icon: AlertTriangle,
            iconColor: 'text-orange-400',
            iconBg: 'bg-orange-500/10',
            border: 'border-orange-500/20',
            accent: 'orange',
        },
        danger: {
            icon: AlertTriangle,
            iconColor: 'text-red-400',
            iconBg: 'bg-red-500/10',
            border: 'border-red-500/20',
            accent: 'red',
        },
        info: {
            icon: AlertTriangle,
            iconColor: 'text-blue-400',
            iconBg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
            accent: 'blue',
        },
    };

    const style = variantStyles[variant];
    const Icon = style.icon;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-dark-800 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-fade-in">
                {/* Header */}
                <div className={`p-6 ${style.iconBg} border-b ${style.border}`}>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${style.iconBg}`}>
                            <Icon className={`w-8 h-8 ${style.iconColor}`} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">{title}</h3>
                            {details?.tier && (
                                <span className="text-xs text-gray-400 uppercase tracking-wider">
                                    {details.tier} Plan
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-gray-300 leading-relaxed">{message}</p>

                    {details && (
                        <div className="bg-dark-900/50 rounded-xl p-4 border border-white/5 space-y-3">
                            {/* Usage Bar */}
                            <div>
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>Monthly Usage</span>
                                    <span className={style.iconColor}>
                                        {details.used} / {details.allowance} designs
                                    </span>
                                </div>
                                <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full bg-${style.accent}-500 rounded-full transition-all`}
                                        style={{
                                            width: `${Math.min(100, (details.used / details.allowance) * 100)}%`,
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Overage Details */}
                            {details.overage !== undefined && details.overage > 0 && (
                                <div className={`flex justify-between items-center p-3 rounded-lg ${style.iconBg} border ${style.border}`}>
                                    <div className="flex items-center gap-2">
                                        <CreditCard className={`w-4 h-4 ${style.iconColor}`} />
                                        <span className="text-sm text-gray-300">Overage Charge</span>
                                    </div>
                                    <span className={`font-mono font-bold ${style.iconColor}`}>
                                        ${details.overageCharge?.toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 pt-0 space-y-3">
                    {showUpgradeOption && onUpgrade && (
                        <button
                            onClick={onUpgrade}
                            className="w-full py-3 bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-900/30"
                        >
                            <ArrowUpCircle className="w-5 h-5" />
                            Upgrade Plan
                        </button>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-dark-700 hover:bg-dark-600 text-gray-300 font-medium rounded-xl transition-all border border-white/5"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 py-3 bg-${style.accent}-600 hover:bg-${style.accent}-500 text-white font-bold rounded-xl transition-all`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;

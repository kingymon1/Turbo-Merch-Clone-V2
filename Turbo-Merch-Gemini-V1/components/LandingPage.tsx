
import React, { useState } from 'react';
import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import {
  Sparkles, TrendingUp, Zap, ShieldCheck, ArrowRight, LayoutDashboard,
  CheckCircle, Play, ChevronDown, ChevronUp, Target, Brain, Palette,
  Download, Award, Clock, Users, Star
} from 'lucide-react';
import Footer from './Footer';
import { AppView } from '../types';

interface LandingPageProps {
    onNavigate: (view: AppView) => void;
}

// FAQ Data
const faqs = [
  {
    question: "How does Turbo Merch find viral trends?",
    answer: "Our AI orchestrates multiple intelligence sources - Google Search, social media analysis via Grok, and Brave Search - to identify breakout niches before they hit the mainstream. We analyze real-time conversations, purchase signals, and cultural momentum to find opportunities with proven demand."
  },
  {
    question: "Are the designs safe to upload to Amazon Merch?",
    answer: "Yes! Every design goes through our built-in compliance system that checks for banned words, trademark risks, and Amazon policy violations. We help you stay safe while maximizing your creative output."
  },
  {
    question: "What's included in the free tier?",
    answer: "You get 3 full-resolution designs per month, complete with SEO-optimized listings, 4500x5400px print-ready PNGs, and CSV exports. No credit card required - just sign up and start creating."
  },
  {
    question: "How long does it take to generate a listing?",
    answer: "Our AI handles everything automatically - trend research, listing copywriting, and design generation. The full process typically takes 2-4 minutes as we thoroughly research each niche for optimal results."
  },
  {
    question: "Can I use my own design ideas?",
    answer: "Absolutely! Paid plans include 'Direct Mode' where you can input your own ideas and our AI will optimize them for Amazon Merch success. You get the same powerful listing generation and design creation for your custom concepts."
  },
  {
    question: "What makes Turbo Merch different from other tools?",
    answer: "Turbo Merch was built by a Tier 20,000 Amazon Merch seller with 6 years of experience. Every feature addresses real pain points from running a successful POD business. We don't just generate - we orchestrate multiple AI models to find what actually sells."
  }
];

// How It Works Steps
const steps = [
  {
    icon: Target,
    title: "Discover Viral Trends",
    description: "Our multi-source AI scans Google, X/Twitter, and Reddit to find breakout niches with proven buyer intent - before your competition."
  },
  {
    icon: Brain,
    title: "Generate Optimized Listings",
    description: "AI writes SEO-optimized titles, bullets, and descriptions using authentic customer language. Built-in compliance checks keep your account safe."
  },
  {
    icon: Palette,
    title: "Create Print-Ready Designs",
    description: "Professional 4500x5400px designs generated instantly. Typography, composition, and colors optimized for your target audience."
  },
  {
    icon: Download,
    title: "Download & Upload",
    description: "Export your complete package - listing CSV and transparent PNG - ready to upload directly to Amazon Merch on Demand."
  }
];

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col font-sans text-white selection:bg-brand-500 selection:text-white">

        {/* Navigation */}
        <nav className="max-w-7xl mx-auto w-full px-4 md:px-6 py-4 md:py-6 flex justify-between items-center z-50">
            <div className="flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 md:w-6 md:h-6 text-brand-400" />
                <h1 className="text-lg md:text-xl font-bold font-mono tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-cyan-500">
                    TURBO<span className="text-white">MERCH</span>
                </h1>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
                <SignInButton mode="modal">
                    <button className="text-xs md:text-sm font-medium text-gray-300 hover:text-white transition-colors px-2 py-1">
                        Log In
                    </button>
                </SignInButton>
                <SignUpButton mode="modal">
                    <button className="px-3 py-2 md:px-5 md:py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs md:text-sm font-bold rounded-lg transition-all shadow-lg shadow-brand-500/20">
                        Start Free Trial
                    </button>
                </SignUpButton>
            </div>
        </nav>

        {/* Hero Section */}
        <div className="relative flex-1 flex flex-col items-center justify-center text-center px-4 md:px-6 pt-8 md:pt-12 pb-16 md:pb-24 overflow-hidden">
             {/* Background Ambience */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none"></div>

             <div className="relative z-10 max-w-4xl mx-auto space-y-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-mono animate-fade-in-up">
                    <Sparkles className="w-3 h-3" />
                    <span>Built by a Tier 20K Amazon Merch Seller</span>
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-tight animate-fade-in-up delay-100">
                    Stop Guessing. <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-blue-500 to-cyan-500">Start Selling.</span>
                </h1>

                <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-200">
                    The AI-powered platform that finds viral trends, writes Amazon-optimized listings, and generates print-ready designs automatically. Built from 6 years of Merch by Amazon experience.
                </p>

                <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
                    <SignUpButton mode="modal">
                        <button className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-gradient-to-r from-brand-600 to-cyan-600 rounded-xl hover:from-brand-500 hover:to-cyan-500 hover:scale-105 hover:shadow-[0_0_40px_rgba(14,165,233,0.4)] w-full sm:w-auto">
                            <span>Start Free Trial</span>
                            <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                        </button>
                    </SignUpButton>
                    <button
                        onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                        className="inline-flex items-center justify-center px-6 py-4 text-sm font-medium text-gray-300 hover:text-white transition-colors gap-2"
                    >
                        <Play className="w-4 h-4" />
                        See How It Works
                    </button>
                </div>
                <p className="text-xs text-gray-500 text-center animate-fade-in-up delay-400">
                    3 free designs/month. No credit card required.
                </p>
            </div>
        </div>

        {/* Credibility Bar */}
        <div className="bg-dark-800/50 border-y border-white/5 py-8">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
                    <div className="space-y-1">
                        <div className="flex items-center justify-center gap-2">
                            <Award className="w-5 h-5 text-brand-400" />
                            <span className="text-2xl md:text-3xl font-bold text-white">Tier 20K</span>
                        </div>
                        <p className="text-xs text-gray-500">MBA Seller Experience</p>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-center gap-2">
                            <Clock className="w-5 h-5 text-brand-400" />
                            <span className="text-2xl md:text-3xl font-bold text-white">6 Years</span>
                        </div>
                        <p className="text-xs text-gray-500">POD Industry Knowledge</p>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-400" />
                            <span className="text-2xl md:text-3xl font-bold text-white">&lt;60s</span>
                        </div>
                        <p className="text-xs text-gray-500">Generation Time</p>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-green-400" />
                            <span className="text-2xl md:text-3xl font-bold text-white">100%</span>
                        </div>
                        <p className="text-xs text-gray-500">Compliance Checked</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Features Grid */}
        <div className="bg-dark-800 border-y border-white/5 py-16 md:py-24 relative z-10">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        Everything You Need to Scale
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        From trend discovery to upload-ready assets, Turbo Merch handles the entire workflow.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                    <div className="space-y-4 p-6 bg-dark-900/50 rounded-2xl border border-white/5 hover:border-blue-500/20 transition-colors">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                            <TrendingUp className="w-6 h-6 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Viral Trend Scanner</h3>
                        <p className="text-gray-400 leading-relaxed">
                            Multi-source AI scans Google, Reddit, and X to find breakout niches. Adjustable virality levels from mainstream to underground.
                        </p>
                        <ul className="space-y-2 text-sm text-gray-500">
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-blue-400" />
                                Real-time social listening
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-blue-400" />
                                Customer language extraction
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-blue-400" />
                                Purchase intent signals
                            </li>
                        </ul>
                    </div>
                    <div className="space-y-4 p-6 bg-dark-900/50 rounded-2xl border border-white/5 hover:border-cyan-500/20 transition-colors">
                        <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/20">
                            <Zap className="w-6 h-6 text-cyan-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Instant Listing Generation</h3>
                        <p className="text-gray-400 leading-relaxed">
                            AI writes SEO-optimized titles, bullets, descriptions, and keywords using authentic audience language.
                        </p>
                        <ul className="space-y-2 text-sm text-gray-500">
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-cyan-400" />
                                60-char optimized titles
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-cyan-400" />
                                256-char bullet points
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-cyan-400" />
                                20-30 targeted keywords
                            </li>
                        </ul>
                    </div>
                    <div className="space-y-4 p-6 bg-dark-900/50 rounded-2xl border border-white/5 hover:border-green-500/20 transition-colors">
                        <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/20">
                            <ShieldCheck className="w-6 h-6 text-green-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Print-Ready Designs</h3>
                        <p className="text-gray-400 leading-relaxed">
                            4500x5400px transparent PNGs with professional typography. Automatic background removal and contrast optimization.
                        </p>
                        <ul className="space-y-2 text-sm text-gray-500">
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-400" />
                                Amazon-spec resolution
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-400" />
                                Shirt color optimization
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-400" />
                                Compliance screening
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        {/* How It Works Section */}
        <div id="how-it-works" className="py-16 md:py-24 relative z-10">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        How It Works
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        From trend to upload-ready listing in four simple steps.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {steps.map((step, index) => (
                        <div key={index} className="relative">
                            {index < steps.length - 1 && (
                                <div className="hidden lg:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-brand-500/50 to-transparent"></div>
                            )}
                            <div className="bg-dark-800/50 border border-white/5 rounded-2xl p-6 hover:border-brand-500/20 transition-colors h-full">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-brand-500/10 rounded-xl flex items-center justify-center border border-brand-500/20 flex-shrink-0">
                                        <step.icon className="w-6 h-6 text-brand-400" />
                                    </div>
                                    <span className="text-4xl font-bold text-brand-500/20">{index + 1}</span>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">{step.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Video Demo Section (Placeholder) */}
        <div className="bg-dark-800/50 py-16 md:py-24 border-y border-white/5">
            <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    See Turbo Merch in Action
                </h2>
                <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
                    Watch how our AI finds viral trends and generates complete, upload-ready listings automatically.
                </p>

                {/* Video Placeholder */}
                <div className="relative aspect-video bg-dark-900 rounded-2xl border border-white/10 overflow-hidden group cursor-pointer hover:border-brand-500/30 transition-colors">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 bg-brand-600/90 rounded-full flex items-center justify-center group-hover:bg-brand-500 group-hover:scale-110 transition-all shadow-lg shadow-brand-500/30">
                            <Play className="w-8 h-8 text-white ml-1" />
                        </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 via-transparent to-transparent"></div>
                    <div className="absolute bottom-6 left-6 right-6 text-left">
                        <p className="text-white font-bold">Demo Video Coming Soon</p>
                        <p className="text-sm text-gray-400">Full walkthrough of the trend-to-listing workflow</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Founder Story Section */}
        <div className="py-16 md:py-24">
            <div className="max-w-4xl mx-auto px-4 md:px-6">
                <div className="bg-gradient-to-br from-brand-900/20 to-cyan-900/20 border border-brand-500/20 rounded-2xl p-8 md:p-12">
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-brand-500/20 rounded-full flex items-center justify-center flex-shrink-0 border border-brand-500/30">
                            <Award className="w-8 h-8 md:w-10 md:h-10 text-brand-400" />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-2xl md:text-3xl font-bold text-white">
                                Built by Someone Who Actually Does This
                            </h3>
                            <p className="text-gray-300 leading-relaxed">
                                I'm a Tier 20,000 Amazon Merch seller with 6 years of experience in the trenches. Every feature in Turbo Merch was designed to solve a real problem I faced while scaling my own POD business.
                            </p>
                            <p className="text-gray-400 leading-relaxed">
                                Trend research used to take hours. Writing listings was tedious. Finding reliable design help was expensive. Turbo Merch automates all of it - because I built the tool I wish I had when I started.
                            </p>
                            <div className="flex flex-wrap gap-4 pt-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    <span className="text-gray-300">20,000+ designs uploaded</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    <span className="text-gray-300">6 years of MBA experience</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    <span className="text-gray-300">Real seller, real problems solved</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-dark-800/50 py-16 md:py-24 border-y border-white/5">
            <div className="max-w-3xl mx-auto px-4 md:px-6">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        Frequently Asked Questions
                    </h2>
                    <p className="text-gray-400">
                        Everything you need to know about Turbo Merch.
                    </p>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <div
                            key={index}
                            className="bg-dark-900/50 border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors"
                        >
                            <button
                                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                                className="w-full px-6 py-4 flex items-center justify-between text-left"
                            >
                                <span className="font-medium text-white pr-4">{faq.question}</span>
                                {openFaq === index ? (
                                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                )}
                            </button>
                            {openFaq === index && (
                                <div className="px-6 pb-4">
                                    <p className="text-gray-400 leading-relaxed">{faq.answer}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Pricing Preview Section */}
        <div id="pricing" className="py-16 md:py-24 bg-dark-800/30">
            <div className="max-w-6xl mx-auto px-4 md:px-6">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        Simple, Transparent Pricing
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        Start free, upgrade when you're ready. No hidden fees.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Free Tier */}
                    <div className="bg-dark-900/50 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
                        <div className="text-sm font-medium text-gray-400 mb-2">Free</div>
                        <div className="flex items-baseline gap-1 mb-1">
                            <span className="text-4xl font-bold text-white">$0</span>
                            <span className="text-gray-500">/mo</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">Forever free</p>
                        <ul className="space-y-2 text-sm text-gray-400 mb-6">
                            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> 3 designs/month</li>
                            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Full-res downloads</li>
                            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> CSV exports</li>
                        </ul>
                        <SignUpButton mode="modal">
                            <button className="w-full py-2.5 border border-white/10 text-white rounded-lg hover:bg-white/5 transition-colors font-medium">
                                Get Started
                            </button>
                        </SignUpButton>
                    </div>

                    {/* Starter Tier */}
                    <div className="bg-dark-900/50 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
                        <div className="text-sm font-medium text-blue-400 mb-2">Starter</div>
                        <div className="flex items-baseline gap-1 mb-1">
                            <span className="text-4xl font-bold text-white">$19.99</span>
                            <span className="text-gray-500">/mo</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">or $199.90/year (save $40)</p>
                        <ul className="space-y-2 text-sm text-gray-400 mb-6">
                            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-blue-400" /> 15 designs/month</li>
                            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-blue-400" /> 30-day history</li>
                            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-blue-400" /> All markets (US, UK, DE)</li>
                        </ul>
                        <SignUpButton mode="modal">
                            <button className="w-full py-2.5 border border-white/10 text-white rounded-lg hover:bg-white/5 transition-colors font-medium">
                                Start Trial
                            </button>
                        </SignUpButton>
                    </div>

                    {/* Pro Tier - Popular */}
                    <div className="bg-gradient-to-b from-brand-900/30 to-dark-900/50 border border-brand-500/30 rounded-2xl p-6 relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-brand-600 text-white text-xs font-bold rounded-full">
                            MOST POPULAR
                        </div>
                        <div className="text-sm font-medium text-brand-400 mb-2">Pro</div>
                        <div className="flex items-baseline gap-1 mb-1">
                            <span className="text-4xl font-bold text-white">$59.99</span>
                            <span className="text-gray-500">/mo</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">or $599.90/year (save $120)</p>
                        <ul className="space-y-2 text-sm text-gray-400 mb-6">
                            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-brand-400" /> 60 designs/month</li>
                            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-brand-400" /> Batch generation (5x)</li>
                            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-brand-400" /> 90-day history</li>
                            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-brand-400" /> Priority processing</li>
                        </ul>
                        <SignUpButton mode="modal">
                            <button className="w-full py-2.5 bg-gradient-to-r from-brand-600 to-cyan-600 text-white rounded-lg hover:from-brand-500 hover:to-cyan-500 transition-colors font-bold">
                                Start Trial
                            </button>
                        </SignUpButton>
                    </div>

                    {/* Business Tier */}
                    <div className="bg-dark-900/50 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
                        <div className="text-sm font-medium text-teal-400 mb-2">Business</div>
                        <div className="flex items-baseline gap-1 mb-1">
                            <span className="text-4xl font-bold text-white">$99.99</span>
                            <span className="text-gray-500">/mo</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">or $999.90/year (save $200)</p>
                        <ul className="space-y-2 text-sm text-gray-400 mb-6">
                            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-teal-400" /> 110 designs/month</li>
                            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-teal-400" /> Batch generation (10x)</li>
                            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-teal-400" /> 1-year history</li>
                            <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-teal-400" /> Email reports</li>
                        </ul>
                        <SignUpButton mode="modal">
                            <button className="w-full py-2.5 border border-teal-500/30 text-teal-400 rounded-lg hover:bg-teal-500/10 transition-colors font-medium">
                                Start Trial
                            </button>
                        </SignUpButton>
                    </div>
                </div>

                <p className="text-center text-sm text-gray-500 mt-8">
                    All paid plans include a 7-day free trial. Cancel anytime. Save 2 months with yearly billing.
                </p>
            </div>
        </div>

        {/* Final CTA Section */}
        <div className="py-16 md:py-24 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-600/10 via-cyan-600/10 to-brand-600/10"></div>
            <div className="max-w-4xl mx-auto px-4 md:px-6 text-center relative z-10">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                    Ready to Dominate Amazon Merch?
                </h2>
                <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
                    Join sellers who are scaling smarter with AI-powered trend research and instant listing generation.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <SignUpButton mode="modal">
                        <button className="group inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-gradient-to-r from-brand-600 to-cyan-600 rounded-xl hover:from-brand-500 hover:to-cyan-500 hover:scale-105 hover:shadow-[0_0_40px_rgba(14,165,233,0.4)]">
                            <span>Start Free Trial</span>
                            <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                        </button>
                    </SignUpButton>
                    <button
                        onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                        className="inline-flex items-center justify-center px-6 py-4 text-sm font-medium text-gray-300 hover:text-white transition-colors border border-white/10 rounded-xl hover:border-white/20"
                    >
                        View Pricing
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-6">
                    3 free designs per month. No credit card required. Cancel anytime.
                </p>
            </div>
        </div>

        {/* Footer Section */}
        <Footer onNavigate={onNavigate} />
    </div>
  );
};

export default LandingPage;

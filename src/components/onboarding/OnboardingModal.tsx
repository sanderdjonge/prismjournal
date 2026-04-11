'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Link2, 
  TrendingUp, 
  Settings, 
  BookOpen,
  X
} from 'lucide-react';
import { cn } from '@/lib/cn';
import Link from 'next/link';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: (dontShowAgain?: boolean) => void;
}

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to PrismJournal',
    description: 'Your professional trading journal with automated MT5 sync, psychology tracking, and advanced analytics.',
    icon: TrendingUp,
    content: (
      <div className="space-y-4 text-center">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-tr from-[#00f2ff] to-[#7000ff] flex items-center justify-center">
          <span className="font-black text-black text-3xl">P</span>
        </div>
        <p className="text-gray-400 text-sm">
          Let&apos;s get you set up in just a few steps.
        </p>
      </div>
    ),
  },
  {
    id: 'accounts',
    title: 'Connect Your Account',
    description: 'Add a trading account to start syncing your trades automatically.',
    icon: Link2,
    content: (
      <div className="space-y-4">
        <div className="glass-card bg-white/5 border border-white/10 rounded-xl p-4">
          <h4 className="font-bold text-white text-sm mb-2">MT5 Auto-Sync</h4>
          <p className="text-gray-400 text-xs mb-3">
            Install our EA on your MT5 terminal to automatically sync all trades.
          </p>
          <Link
            href="/pages/accounts"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary text-xs font-black uppercase rounded-lg hover:bg-primary/20 transition-all"
          >
            Add Trading Account
            <ArrowRight size={12} />
          </Link>
        </div>
        <div className="glass-card bg-white/5 border border-white/10 rounded-xl p-4">
          <h4 className="font-bold text-white text-sm mb-2">Manual Entry</h4>
          <p className="text-gray-400 text-xs">
            You can also manually add trades from the Journal page.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'preferences',
    title: 'Set Your Preferences',
    description: 'Configure your currency, timezone, and notification settings.',
    icon: Settings,
    content: (
      <div className="space-y-3">
        <Link
          href="/settings?tab=preferences"
          className="flex items-center justify-between glass-card bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
        >
          <div>
            <h4 className="font-bold text-white text-sm">Currency & Timezone</h4>
            <p className="text-gray-400 text-xs">Set your base currency and timezone</p>
          </div>
          <ArrowRight size={16} className="text-gray-400" />
        </Link>
        <Link
          href="/settings?tab=notifications"
          className="flex items-center justify-between glass-card bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
        >
          <div>
            <h4 className="font-bold text-white text-sm">Notifications</h4>
            <p className="text-gray-400 text-xs">Configure Telegram and email alerts</p>
          </div>
          <ArrowRight size={16} className="text-gray-400" />
        </Link>
      </div>
    ),
  },
  {
    id: 'learn',
    title: 'Learn the Basics',
    description: 'Explore the key features to get the most out of PrismJournal.',
    icon: BookOpen,
    content: (
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card bg-white/5 border border-white/10 rounded-xl p-3 text-center">
          <TrendingUp size={20} className="mx-auto text-primary mb-2" />
          <h4 className="font-bold text-white text-xs">Dashboard</h4>
          <p className="text-gray-500 text-[10px]">Track performance</p>
        </div>
        <div className="glass-card bg-white/5 border border-white/10 rounded-xl p-3 text-center">
          <BookOpen size={20} className="mx-auto text-secondary mb-2" />
          <h4 className="font-bold text-white text-xs">Journal</h4>
          <p className="text-gray-500 text-[10px]">Review trades</p>
        </div>
        <div className="glass-card bg-white/5 border border-white/10 rounded-xl p-3 text-center">
          <TrendingUp size={20} className="mx-auto text-accent mb-2" />
          <h4 className="font-bold text-white text-xs">Analytics</h4>
          <p className="text-gray-500 text-[10px]">Deep insights</p>
        </div>
        <div className="glass-card bg-white/5 border border-white/10 rounded-xl p-3 text-center">
          <Settings size={20} className="mx-auto text-gray-400 mb-2" />
          <h4 className="font-bold text-white text-xs">Strategies</h4>
          <p className="text-gray-500 text-[10px]">Rule tracking</p>
        </div>
      </div>
    ),
  },
];

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose(dontShowAgain);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose(dontShowAgain);
  };

  if (!isOpen) return null;

  const step = STEPS[currentStep];
  const StepIcon = step.icon;
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4"
        onClick={handleSkip}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md glass-card bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <StepIcon size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">{step.title}</h2>
                <p className="text-[10px] text-gray-500">Step {currentStep + 1} of {STEPS.length}</p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-white/5">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-sm text-gray-400 mb-6">{step.description}</p>
            {step.content}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/5 space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/50"
              />
              <span className="text-xs text-gray-400">Don't show this again</span>
            </label>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      i === currentStep ? "bg-primary" : "bg-white/20"
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={handlePrev}
                    className="px-4 py-2 text-xs font-black uppercase text-gray-400 hover:text-white transition-all flex items-center gap-1"
                  >
                    <ArrowLeft size={12} />
                    Back
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="px-4 py-2 bg-primary/10 text-primary text-xs font-black uppercase rounded-lg hover:bg-primary/20 transition-all flex items-center gap-1"
                >
                  {isLastStep ? (
                    <>
                      <CheckCircle2 size={12} />
                      Get Started
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight size={12} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

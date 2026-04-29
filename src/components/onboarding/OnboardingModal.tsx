'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Link2, 
  TrendingUp, 
  Settings, 
  BookOpen,
  PenLine,
  BarChart3,
  Target,
  Brain,
  Bell,
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
        <p className="text-text-muted text-sm">
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
        <div className="glass-card bg-surface-elevated border border-border-color rounded-xl p-4">
          <h4 className="font-bold text-white text-sm mb-2">MT5 Auto-Sync</h4>
          <p className="text-text-muted text-xs mb-3">
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
        <div className="glass-card bg-surface-elevated border border-border-color rounded-xl p-4">
          <h4 className="font-bold text-white text-sm mb-2">Manual Entry</h4>
          <p className="text-text-muted text-xs">
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
          className="flex items-center justify-between glass-card bg-surface-elevated border border-border-color rounded-xl p-4 hover:bg-surface-hover transition-all"
        >
          <div>
            <h4 className="font-bold text-white text-sm">Currency & Timezone</h4>
            <p className="text-text-muted text-xs">Set your base currency and timezone</p>
          </div>
          <ArrowRight size={16} className="text-text-muted" />
        </Link>
        <Link
          href="/settings?tab=notifications"
          className="flex items-center justify-between glass-card bg-surface-elevated border border-border-color rounded-xl p-4 hover:bg-surface-hover transition-all"
        >
          <div>
            <h4 className="font-bold text-white text-sm">Notifications</h4>
            <p className="text-text-muted text-xs">Configure Telegram and email alerts</p>
          </div>
          <ArrowRight size={16} className="text-text-muted" />
        </Link>
      </div>
    ),
  },
  {
    id: 'first-trade',
    title: 'Journal Your First Trade',
    description: 'Log a trade with symbol, direction, prices, and notes to build your journal.',
    icon: PenLine,
    content: (
      <div className="space-y-3">
        <div className="glass-card bg-surface-elevated border border-border-color rounded-xl p-4">
          <h4 className="font-bold text-white text-sm mb-3">Trade Entry Fields</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">S</div>
              <div>
                <p className="text-white text-xs font-semibold">Symbol</p>
                <p className="text-text-muted text-[10px]">e.g. EURUSD, GBPJPY</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-profit/10 flex items-center justify-center text-profit text-[10px] font-bold">D</div>
              <div>
                <p className="text-white text-xs font-semibold">Direction</p>
                <p className="text-text-muted text-[10px]">LONG or SHORT</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-secondary/10 flex items-center justify-center text-secondary text-[10px] font-bold">E</div>
              <div>
                <p className="text-white text-xs font-semibold">Entry / Exit Price</p>
                <p className="text-text-muted text-[10px]">Where you entered and exited</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-accent/10 flex items-center justify-center text-accent text-[10px] font-bold">N</div>
              <div>
                <p className="text-white text-xs font-semibold">Notes</p>
                <p className="text-text-muted text-[10px]">Your thoughts and reasoning</p>
              </div>
            </div>
          </div>
        </div>
        <Link
          href="/journal"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary text-xs font-black uppercase rounded-lg hover:bg-primary/20 transition-all"
        >
          Open Journal
          <ArrowRight size={12} />
        </Link>
      </div>
    ),
  },
  {
    id: 'dashboard',
    title: 'Understand Your Dashboard',
    description: 'Your dashboard shows key performance metrics at a glance.',
    icon: BarChart3,
    content: (
      <div className="space-y-3">
        <div className="glass-card bg-surface-elevated border border-border-color rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-profit/10 flex items-center justify-center text-profit shrink-0">
              <TrendingUp size={16} />
            </div>
            <div>
              <p className="text-white text-xs font-bold">P&L</p>
              <p className="text-text-muted text-[10px]">Total profit or loss across all trades</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <BarChart3 size={16} />
            </div>
            <div>
              <p className="text-white text-xs font-bold">Win Rate</p>
              <p className="text-text-muted text-[10px]">Percentage of profitable trades</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
              <Target size={16} />
            </div>
            <div>
              <p className="text-white text-xs font-bold">Profit Factor</p>
              <p className="text-text-muted text-[10px]">Ratio of gross profit to gross loss</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-loss/10 flex items-center justify-center text-loss shrink-0">
              <TrendingUp size={16} className="rotate-180" />
            </div>
            <div>
              <p className="text-white text-xs font-bold">Drawdown</p>
              <p className="text-text-muted text-[10px]">Largest peak-to-trough equity decline</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'strategies',
    title: 'Explore Strategies',
    description: 'Create strategies with rules to measure your plan adherence and improve discipline.',
    icon: Target,
    content: (
      <div className="space-y-4">
        <div className="glass-card bg-surface-elevated border border-border-color rounded-xl p-4">
          <h4 className="font-bold text-white text-sm mb-2">How Strategies Work</h4>
          <p className="text-text-muted text-xs mb-2">
            Define a strategy with specific rules like max daily loss, minimum R:R ratio, or mandatory stop losses.
          </p>
          <p className="text-text-muted text-xs">
            Each trade is automatically checked against your rules, and violations are tracked so you can spot patterns.
          </p>
        </div>
        <div className="glass-card bg-surface-elevated border border-border-color rounded-xl p-4">
          <h4 className="font-bold text-white text-sm mb-2">Example Rules</h4>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 rounded-md bg-profit/10 text-profit text-[10px] font-bold">Max Daily Loss</span>
            <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold">Min R:R Ratio</span>
            <span className="px-2 py-1 rounded-md bg-secondary/10 text-secondary text-[10px] font-bold">No Overtrading</span>
            <span className="px-2 py-1 rounded-md bg-warning/10 text-warning text-[10px] font-bold">Mandatory SL</span>
          </div>
        </div>
        <Link
          href="/pages/strategies"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary text-xs font-black uppercase rounded-lg hover:bg-primary/20 transition-all"
        >
          Create Strategy
          <ArrowRight size={12} />
        </Link>
      </div>
    ),
  },
  {
    id: 'psychology',
    title: 'Track Your Psychology',
    description: 'Log your mood, follow your plan, and monitor your tiltmeter to manage emotions.',
    icon: Brain,
    content: (
      <div className="space-y-3">
        <div className="glass-card bg-surface-elevated border border-border-color rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-3">
            <Brain size={16} className="text-primary shrink-0" />
            <div>
              <p className="text-white text-xs font-bold">Mood Logging</p>
              <p className="text-text-muted text-[10px]">Tag each trade: CALM, CONFIDENT, NEUTRAL, ANXIOUS, FOMO, or REVENGE</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 size={16} className="text-profit shrink-0" />
            <div>
              <p className="text-white text-xs font-bold">Plan Compliance</p>
              <p className="text-text-muted text-[10px]">Rate whether you followed your trading plan on each trade</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <TrendingUp size={16} className="text-warning shrink-0" />
            <div>
              <p className="text-white text-xs font-bold">Tiltmeter</p>
              <p className="text-text-muted text-[10px]">Auto-calculated score (0–100) based on rule violations and loss streaks</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-1 rounded-md bg-[#4ade80]/10 text-[#4ade80] text-[10px] font-bold">🧘 CALM</span>
          <span className="px-2 py-1 rounded-md bg-[#f87171]/10 text-[#f87171] text-[10px] font-bold">😰 ANXIOUS</span>
          <span className="px-2 py-1 rounded-md bg-[#f59e0b]/10 text-[#f59e0b] text-[10px] font-bold">😤 REVENGE</span>
        </div>
      </div>
    ),
  },
  {
    id: 'notifications',
    title: 'Set Up Notifications',
    description: 'Get alerts via Telegram and email so you never miss important events.',
    icon: Bell,
    content: (
      <div className="space-y-3">
        <div className="glass-card bg-surface-elevated border border-border-color rounded-xl p-4">
          <h4 className="font-bold text-white text-sm mb-2">Telegram Bot</h4>
          <p className="text-text-muted text-xs mb-3">
            Get instant alerts for trade opens/closes, rule violations, and drawdown warnings.
          </p>
          <Link
            href="/settings?tab=notifications"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary text-xs font-black uppercase rounded-lg hover:bg-primary/20 transition-all"
          >
            Set Up Telegram
            <ArrowRight size={12} />
          </Link>
        </div>
        <div className="glass-card bg-surface-elevated border border-border-color rounded-xl p-4">
          <h4 className="font-bold text-white text-sm mb-2">Email Digest</h4>
          <p className="text-text-muted text-xs mb-3">
            Receive a weekly or daily summary of your performance, stats, and trends.
          </p>
          <Link
            href="/settings?tab=notifications"
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary text-xs font-black uppercase rounded-lg hover:bg-secondary/20 transition-all"
          >
            Enable Digest
            <ArrowRight size={12} />
          </Link>
        </div>
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
        <div className="glass-card bg-surface-elevated border border-border-color rounded-xl p-3 text-center">
          <TrendingUp size={20} className="mx-auto text-primary mb-2" />
          <h4 className="font-bold text-white text-xs">Dashboard</h4>
          <p className="text-text-muted text-[10px]">Track performance</p>
        </div>
        <div className="glass-card bg-surface-elevated border border-border-color rounded-xl p-3 text-center">
          <BookOpen size={20} className="mx-auto text-secondary mb-2" />
          <h4 className="font-bold text-white text-xs">Journal</h4>
          <p className="text-text-muted text-[10px]">Review trades</p>
        </div>
        <div className="glass-card bg-surface-elevated border border-border-color rounded-xl p-3 text-center">
          <TrendingUp size={20} className="mx-auto text-accent mb-2" />
          <h4 className="font-bold text-white text-xs">Analytics</h4>
          <p className="text-text-muted text-[10px]">Deep insights</p>
        </div>
        <div className="glass-card bg-surface-elevated border border-border-color rounded-xl p-3 text-center">
          <Settings size={20} className="mx-auto text-text-muted mb-2" />
          <h4 className="font-bold text-white text-xs">Strategies</h4>
          <p className="text-text-muted text-[10px]">Rule tracking</p>
        </div>
      </div>
    ),
  },
];

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

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
          className="w-full max-w-md glass-card bg-surface border border-border-color rounded-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <StepIcon size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">{step.title}</h2>
                <p className="text-[10px] text-text-muted">Step {currentStep + 1} of {STEPS.length}</p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="w-8 h-8 rounded-full hover:bg-surface-hover flex items-center justify-center text-text-muted hover:text-text-primary transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-surface-elevated">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-6 max-h-[50vh] overflow-y-auto">
            <p className="text-sm text-text-muted mb-6">{step.description}</p>
            {step.content}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border-subtle space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-border-color bg-surface-elevated text-primary focus:ring-primary/50"
              />
              <span className="text-xs text-text-muted">Don&apos;t show this again</span>
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
                    className="px-4 py-2 text-xs font-black uppercase text-text-muted hover:text-text-primary transition-all flex items-center gap-1"
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

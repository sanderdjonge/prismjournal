'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Image, TrendingUp, Loader2, Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ShareTradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    tradeId: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    pnl: number;
}

type Platform = 'discord' | 'twitter' | 'reddit' | 'general';

export function ShareTradeModal({ isOpen, onClose, tradeId, symbol, direction, pnl }: ShareTradeModalProps) {
    const [includeScreenshot, setIncludeScreenshot] = useState(true);
    const [showPrismScore, setShowPrismScore] = useState(false);
    const [isPublic, setIsPublic] = useState(false); // Cards are private by default
    const [platform, setPlatform] = useState<Platform>('general');
    const [discordWebhook, setDiscordWebhook] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
    const [cardId, setCardId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [shareSuccess, setShareSuccess] = useState(false);
    const [copied, setCopied] = useState(false);

    const isProfit = pnl >= 0;

    const handleGenerateCard = async () => {
        setIsGenerating(true);
        setError(null);
        setCardImageUrl(null);
        setCardId(null);

        try {
            const response = await fetch('/api/share/card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tradeId,
                    includeScreenshot,
                    showPrismScore,
                    isPublic,
                    platform,
                    comment: customMessage.trim() || undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to generate card');
            }

            const data = await response.json();
            setCardId(data.cardId);
            // Append timestamp to bust browser cache on regeneration
            setCardImageUrl(`${data.imageUrl}?t=${Date.now()}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate card');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleShareToDiscord = async () => {
        if (!cardId || !discordWebhook) return;

        setIsSharing(true);
        setError(null);

        try {
            const response = await fetch('/api/share/discord', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardId,
                    webhookUrl: discordWebhook,
                    message: customMessage || undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to share to Discord');
            }

            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to share to Discord');
        } finally {
            setIsSharing(false);
        }
    };

    const handleCopyLink = async () => {
        if (cardImageUrl) {
            // Strip the cache-busting timestamp before sharing
            const canonicalUrl = cardImageUrl.split('?')[0];
            const fullUrl = `${window.location.origin}${canonicalUrl}`;
            await navigator.clipboard.writeText(fullUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleClose = () => {
        setCardImageUrl(null);
        setCardId(null);
        setError(null);
        setShareSuccess(false);
        onClose();
    };

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const modal = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={handleClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-surface-card border border-border-color rounded-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <Share2 size={20} className="text-primary" />
                                <div>
                                    <h2 className="text-lg font-bold text-white">Share Trade</h2>
                                    <p className="text-sm text-gray-500">
                                        {symbol} {direction} • {isProfit ? '+' : ''}{pnl.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            {/* Options */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Image size={18} className="text-gray-500" />
                                        <span className="text-sm text-gray-300">Include screenshot</span>
                                    </div>
                                    <button
                                        onClick={() => setIncludeScreenshot(!includeScreenshot)}
                                        className={cn(
                                            "w-10 h-6 rounded-full transition-colors relative",
                                            includeScreenshot ? "bg-primary" : "bg-white/10"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                                            includeScreenshot ? "translate-x-5" : "translate-x-1"
                                        )} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp size={18} className="text-gray-500" />
                                        <span className="text-sm text-gray-300">Show Prism Score</span>
                                    </div>
                                    <button
                                        onClick={() => setShowPrismScore(!showPrismScore)}
                                        className={cn(
                                            "w-10 h-6 rounded-full transition-colors relative",
                                            showPrismScore ? "bg-primary" : "bg-white/10"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                                            showPrismScore ? "translate-x-5" : "translate-x-1"
                                        )} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Share2 size={18} className="text-gray-500" />
                                        <div>
                                            <span className="text-sm text-gray-300">Public link</span>
                                            <p className="text-[10px] text-gray-600">Anyone with the link can view</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsPublic(!isPublic)}
                                        className={cn(
                                            "w-10 h-6 rounded-full transition-colors relative",
                                            isPublic ? "bg-green-500" : "bg-white/10"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                                            isPublic ? "translate-x-5" : "translate-x-1"
                                        )} />
                                    </button>
                                </div>
                            </div>

                            {/* Platform Selection */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                                    Platform
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['discord', 'twitter', 'reddit', 'general'] as Platform[]).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setPlatform(p)}
                                            className={cn(
                                                "px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border",
                                                platform === p
                                                    ? "bg-primary text-black border-primary"
                                                    : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                                            )}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Discord Webhook URL */}
                            {platform === 'discord' && (
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                                        Discord Webhook URL
                                    </label>
                                    <input
                                        type="url"
                                        value={discordWebhook}
                                        onChange={e => setDiscordWebhook(e.target.value)}
                                        placeholder="https://discord.com/api/webhooks/..."
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/40"
                                    />
                                </div>
                            )}

                            {/* Custom Message */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                                    Comment on card (optional)
                                </label>
                                <textarea
                                    value={customMessage}
                                    onChange={e => setCustomMessage(e.target.value)}
                                    placeholder="Appears on the card image (max 200 chars)..."
                                    rows={2}
                                    maxLength={200}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/40 resize-none"
                                />
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Preview */}
                            {cardImageUrl && (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
                                        Preview
                                    </label>
                                    <div className="rounded-lg overflow-hidden border border-white/10">
                                        <img
                                            src={cardImageUrl}
                                            alt="Share card preview"
                                            className="w-full h-auto"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-white/10 flex items-center gap-3">
                            {!cardImageUrl ? (
                                <button
                                    onClick={handleGenerateCard}
                                    disabled={isGenerating}
                                    className="flex-1 px-4 py-2.5 bg-primary text-black font-bold rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Image size={16} />
                                            Generate Card
                                        </>
                                    )}
                                </button>
                            ) : (
                                <>
                                    {platform === 'discord' ? (
                                        <button
                                            onClick={handleShareToDiscord}
                                            disabled={isSharing || !discordWebhook}
                                            className="flex-1 px-4 py-2.5 bg-[#5865F2] text-white font-bold rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                        >
                                            {isSharing ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin" />
                                                    Sharing...
                                                </>
                                            ) : shareSuccess ? (
                                                <>
                                                    <Check size={16} />
                                                    Shared!
                                                </>
                                            ) : (
                                                <>
                                                    <Share2 size={16} />
                                                    Share to Discord
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleCopyLink}
                                            className="flex-1 px-4 py-2.5 bg-white/10 text-white font-bold rounded-lg hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                                        >
                                            {copied ? (
                                                <>
                                                    <Check size={16} />
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy size={16} />
                                                    Copy Image URL
                                                </>
                                            )}
                                        </button>
                                    )}
                                    <button
                                        onClick={handleGenerateCard}
                                        disabled={isGenerating}
                                        className="px-4 py-2.5 bg-white/5 text-gray-300 font-bold rounded-lg hover:bg-white/10 transition-all"
                                    >
                                        Regenerate
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    if (!mounted) return null;
    return createPortal(modal, document.body);
}
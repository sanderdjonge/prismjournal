'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Lightbox } from '../trade-analysis';

import type { MediaItem } from '@/types/trade'

interface ExistingScreenshotsProps {
    media: MediaItem[];
    onRemove?: (id: string) => void;
    readonly?: boolean;
}

export function ExistingScreenshots({ media, onRemove, readonly = false }: ExistingScreenshotsProps) {
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    if (media.length === 0) return null;

    return (
        <>
            {lightboxUrl && <Lightbox src={lightboxUrl} alt="Trade screenshot" onClose={() => setLightboxUrl(null)} />}
            <div className="grid grid-cols-5 gap-2">
                {media.map((item) => (
                    <div
                        key={item.id}
                        className="relative aspect-square rounded-lg overflow-hidden bg-surface-elevated group cursor-pointer"
                        onClick={() => setLightboxUrl(item.url)}
                    >
                        <img
                            src={item.url}
                            alt={`Screenshot ${item.timeframe}`}
                            className="w-full h-full object-cover"
                        />

                        {/* Remove Button (only if not readonly) */}
                        {!readonly && onRemove && (
                            <button
                                type="button"
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                        await fetch(`/api/media/${item.id}`, { method: 'DELETE' });
                                        onRemove(item.id);
                                    } catch {
                                        // silently ignore
                                    }
                                }}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={10} className="text-white" />
                            </button>
                        )}

                        {/* Timeframe Label */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                            <p className="text-[8px] text-white truncate">
                                {item.timeframe}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

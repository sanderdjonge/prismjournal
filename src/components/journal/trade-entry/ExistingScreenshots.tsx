'use client';

import React from 'react';
import { X, ExternalLink } from 'lucide-react';

interface MediaItem {
    id: string;
    url: string;
    timeframe: string;
}

interface ExistingScreenshotsProps {
    media: MediaItem[];
    onRemove?: (id: string) => void;
    readonly?: boolean;
}

export function ExistingScreenshots({ media, onRemove, readonly = false }: ExistingScreenshotsProps) {
    if (media.length === 0) return null;

    return (
        <div className="grid grid-cols-5 gap-2">
            {media.map((item) => (
                <div
                    key={item.id}
                    className="relative aspect-square rounded-lg overflow-hidden bg-white/5 group"
                >
                    <img
                        src={item.url}
                        alt={`Screenshot ${item.timeframe}`}
                        className="w-full h-full object-cover"
                    />
                    
                    {/* Open in new tab button */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(`${window.location.origin}${item.url}`, '_blank', 'noopener');
                        }}
                        className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <ExternalLink size={10} className="text-white" />
                    </button>

                    {/* Remove Button (only if not readonly) */}
                    {!readonly && onRemove && (
                        <button
                            type="button"
                            onClick={async (e) => {
                                e.stopPropagation();
                                // Delete from database
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
    );
}

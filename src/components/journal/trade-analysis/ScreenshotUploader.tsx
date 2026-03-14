'use client';

import React, { useRef } from 'react';
import { Image as ImageIcon, Upload, Loader2 } from 'lucide-react';

export interface Screenshot {
    url: string;
    timeframe: string;
}

interface ScreenshotUploaderProps {
    screenshots: Screenshot[];
    uploading: string | null;
    onUpload: (file: File, timeframe: string) => void;
    onLightbox: (url: string) => void;
}

export function ScreenshotUploader({ screenshots, uploading, onUpload, onLightbox }: ScreenshotUploaderProps) {
    const entryRef = useRef<HTMLInputElement>(null);
    const contextRef = useRef<HTMLInputElement>(null);

    const UploadSlot = ({ timeframe, label }: { timeframe: string; label: string }) => {
        const shot = screenshots.find(s => s.timeframe === timeframe);
        const isUploading = uploading === timeframe;
        const ref = timeframe === 'M5' ? entryRef : contextRef;

        return (
            <div className="aspect-video glass-card border-white/10 flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-white group hover:bg-white/5 transition-all relative overflow-hidden">
                <input
                    ref={ref} 
                    type="file" 
                    accept="image/*" 
                    className="hidden"
                    onChange={e => { 
                        const f = e.target.files?.[0]; 
                        if (f) onUpload(f, timeframe); 
                    }}
                />
                {shot ? (
                    <>
                        <img 
                            src={shot.url} 
                            alt={label}
                            className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
                            onClick={() => onLightbox(shot.url)} 
                        />
                        <button
                            onClick={(e) => { e.stopPropagation(); ref.current?.click(); }}
                            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 z-10"
                            title="Replace screenshot"
                        >
                            <Upload size={12} />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                            <span className="text-[8px] font-black uppercase tracking-widest text-white/70">{label}</span>
                        </div>
                    </>
                ) : isUploading ? (
                    <Loader2 size={24} className="animate-spin text-primary" />
                ) : (
                    <div className="cursor-pointer flex flex-col items-center gap-2" onClick={() => ref.current?.click()}>
                        <ImageIcon size={28} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <section>
            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-white/5 pb-2 mb-3 flex items-center gap-2">
                <ImageIcon size={12} /> Execution Evidence
            </h3>
            <div className="grid grid-cols-2 gap-3">
                <UploadSlot timeframe="M5" label="M5 Entry Chart" />
                <UploadSlot timeframe="H1" label="H1 Context Chart" />
            </div>
            <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest mt-2 text-center">
                Click to upload · PNG, JPG, WEBP
            </p>
        </section>
    );
}

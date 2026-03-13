'use client';

import React from 'react';
import { X } from 'lucide-react';

interface LightboxProps {
    src: string;
    alt: string;
    onClose: () => void;
}

export function Lightbox({ src, alt, onClose }: LightboxProps) {
    return (
        <div 
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-zoom-out"
            onClick={onClose}
        >
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all z-10"
            >
                <X size={20} />
            </button>
            <img 
                src={src} 
                alt={alt}
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                onClick={e => e.stopPropagation()} 
            />
        </div>
    );
}

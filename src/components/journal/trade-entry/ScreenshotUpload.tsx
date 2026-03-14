'use client';

import React, { useRef, useState } from 'react';
import { ImagePlus, X, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ScreenshotUploadProps {
    screenshots: File[];
    onScreenshotsChange: (files: File[]) => void;
    maxFiles?: number;
}

export function ScreenshotUpload({
    screenshots,
    onScreenshotsChange,
    maxFiles = 5,
}: ScreenshotUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);
    const [previews, setPreviews] = useState<string[]>([]);

    const handleFileSelect = (files: FileList | null) => {
        if (!files) return;

        const validFiles: File[] = [];
        const newPreviews: string[] = [];

        Array.from(files).forEach((file) => {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                return;
            }

            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                return;
            }

            validFiles.push(file);
            
            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setPreviews((prev) => [...prev, e.target!.result as string]);
                }
            };
            reader.readAsDataURL(file);
        });

        const totalFiles = screenshots.length + validFiles.length;
        if (totalFiles > maxFiles) {
            // Only take what we can
            const allowed = maxFiles - screenshots.length;
            onScreenshotsChange([...screenshots, ...validFiles.slice(0, allowed)]);
        } else {
            onScreenshotsChange([...screenshots, ...validFiles]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        handleFileSelect(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
    };

    const removeScreenshot = (index: number) => {
        const newScreenshots = screenshots.filter((_, i) => i !== index);
        const newPreviews = previews.filter((_, i) => i !== index);
        onScreenshotsChange(newScreenshots);
        setPreviews(newPreviews);
    };

    return (
        <div className="space-y-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-1.5">
                <ImagePlus size={10} /> Screenshots (Optional)
            </label>

            {/* Upload Area */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                    "relative border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all",
                    dragOver
                        ? "border-primary bg-primary/5"
                        : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
                )}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                />

                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                        <Upload size={18} className="text-gray-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-300">
                            Drop screenshots here or click to upload
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                            PNG, JPG up to 10MB • Max {maxFiles} files
                        </p>
                    </div>
                </div>
            </div>

            {/* Preview Grid */}
            {screenshots.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                    {screenshots.map((file, index) => (
                        <div
                            key={index}
                            className="relative aspect-square rounded-lg overflow-hidden bg-white/5 group"
                        >
                            {previews[index] ? (
                                <img
                                    src={previews[index]}
                                    alt={`Screenshot ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Loader2 size={16} className="text-gray-500 animate-spin" />
                                </div>
                            )}
                            
                            {/* Remove Button */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeScreenshot(index);
                                }}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={10} className="text-white" />
                            </button>

                            {/* File Name Tooltip */}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                                <p className="text-[8px] text-white truncate">
                                    {file.name}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

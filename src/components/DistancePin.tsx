import React from 'react';
import { clsx } from 'clsx';
import { Artwork } from '../lib/types';
import { Lock, MapPin } from 'lucide-react';

interface DistancePinProps {
    artwork: Artwork;
    distance: number; // in meters
    bearingInfo: { theta: number, phi: number } | null;
    // theta = horizontal angle from center of screen (-1 to 1 where 0 is dead center)
    // phi = vertical angle (-1 to 1)
    isUnlocked: boolean;
    onClick: (artwork: Artwork) => void;
}

export const DistancePin: React.FC<DistancePinProps> = ({
    artwork, distance, bearingInfo, isUnlocked, onClick
}) => {
    if (!bearingInfo) return null;

    // Calculate size and opacity based on distance
    // 100m = invisible/tiny, <10m = large
    const maxDist = 100;
    if (distance > maxDist) return null; // Too far

    // Size ranges from 40px to 200px
    const scale = Math.max(0.3, 1 - (distance / maxDist));
    const size = 60 + (100 * scale);

    // Opacity drops off after 80 meters
    const opacity = distance > 80 ? Math.max(0.2, 1 - ((distance - 80) / 20)) : 1;

    // Position on screen:
    // theta: -1 (left edge) to +1 (right edge)
    // phi: -1 (top edge) to +1 (bottom edge)
    // We apply some margin to keep pins from clipping entirely
    const xPercent = 50 + (bearingInfo.theta * 50);
    const yPercent = 50 + (bearingInfo.phi * 50);

    // If pin is drastically off-screen horizontally, we can optionally hide it
    if (xPercent < -50 || xPercent > 150 || yPercent < -50 || yPercent > 150) {
        return null;
    }

    const isTooFar = distance > 20;

    return (
        <div
            className={clsx(
                "absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-100 cursor-pointer pointer-events-auto",
                "flex flex-col items-center gap-2 group",
                isTooFar && "opacity-80 grayscale"
            )}
            style={{
                left: `${Math.max(-10, Math.min(110, xPercent))}%`,
                top: `${Math.max(10, Math.min(90, yPercent))}%`,
                opacity,
                zIndex: Math.round(1000 - distance) // Closer pins sit on top
            }}
            onClick={(e) => {
                e.stopPropagation();
                onClick(artwork);
            }}
        >
            <div
                className={clsx(
                    "rounded-full border-2 overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-110",
                    isUnlocked ? "border-accent shadow-accent/20" : "border-white/40 border-dashed"
                )}
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                }}
            >
                {artwork.mediaType === 'image' && (
                    <img src={artwork.mediaUrl} alt={artwork.title} className="w-full h-full object-cover" />
                )}
                {(artwork.mediaType === 'video' || artwork.mediaType === 'audio') && (
                    <div className="w-full h-full bg-black flex items-center justify-center">
                        <div className="w-full h-full bg-gradient-to-tr from-accent/20 to-purple-500/20" />
                    </div>
                )}
                {(artwork.mediaType === '3d' || artwork.mediaType === 'model3d') && (
                    <div className="w-full h-full bg-gradient-to-br from-purple-900 to-black flex items-center justify-center">
                        <span className="text-2xl">🧊</span>
                    </div>
                )}
                {(artwork.mediaType === 'voice') && (
                    <div className="w-full h-full bg-gradient-to-br from-blue-900 to-black flex items-center justify-center">
                        <span className="text-2xl">🎙️</span>
                    </div>
                )}
            </div>

            <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2 max-w-[150px]">
                {!isUnlocked && <Lock size={12} className="text-white/50 shrink-0" />}
                <span className="text-xs font-bold text-white truncate">{artwork.title}</span>
                <span className="text-[10px] text-accent shrink-0">{Math.round(distance)}m</span>
            </div>
        </div>
    );
};
